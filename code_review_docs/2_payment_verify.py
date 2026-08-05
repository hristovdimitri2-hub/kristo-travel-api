async def rpc_call(method: str, params: list = None) -> Any:
    if params is None:
        params = []
    payload = {
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1
    }
    try:
        response = await http_client.post(BASE_RPC_URL, json=payload)
        response.raise_for_status()
        data = response.json()
        if "error" in data:
            logger.error(f"RPC Error ({method}): {data['error']}")
            raise HTTPException(status_code=502, detail=f"RPC error: {data['error'].get('message')}")
        return data.get("result")
    except httpx.HTTPError as e:
        logger.error(f"RPC Connection error ({method}): {e}")
        raise HTTPException(status_code=502, detail=f"Failed to communicate with Base RPC: {str(e)}")

# Helper to Extract Transaction Hash from X-PAYMENT header
def extract_tx_hash(raw_header: str) -> str:
    raw = raw_header.strip()
    if raw.startswith("{") and raw.endswith("}"):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                for k in ["tx_hash", "txHash", "hash", "transactionHash", "payment_hash"]:
                    if k in parsed and isinstance(parsed[k], str):
                        return parsed[k].strip().strip('"').strip("'")
        except Exception:
            pass
    return raw.strip('"').strip("'")

# Check if endpoint is freemium (free with rate limiting)
FREEMIUM_ENDPOINTS_SET = {"/crypto/token-prices", "/crypto/gas-oracle"}

async def verify_payment(request: Request) -> dict:
    endpoint_path = request.url.path

    # FREEMIUM: token-prices and gas-oracle are free (rate-limited)
    if endpoint_path in FREEMIUM_ENDPOINTS_SET:
        return {"freemium": True, "endpoint": endpoint_path, "payer_address": None, "amount_usdc": 0.0}

    # Determine effective price (volume discount check)
    effective_price = PRICE_USDC
    referral_header = request.headers.get("X-REFERRAL") or request.headers.get("x-referral")
    payer_for_discount = None

    payment_header = request.headers.get("X-PAYMENT") or request.headers.get("x-payment")

    # If we have a payment header, extract the tx hash to get payer address for trial check
    # But first check: if no payment header, check if this wallet has trial credits
    if not payment_header:
        # No payment header — return 402 with payment info
        payment_info = {
            "x402_version": 1,
            "accepts": {
                "scheme": "exact",
                "network": "base",
                "chain_id": CHAIN_ID,
                "asset": "USDC",
                "asset_address": USDC_ADDRESS,
                "amount": str(PRICE_USDC),
                "amount_raw": str(PRICE_RAW),
                "payTo": WALLET_ADDRESS,
                "description": f"Payment required for Kristo Intelligence API endpoint: {request.url.path}",
                "trial_credits_available": TRIAL_FREE_CALLS,
                "volume_discount_after": VOLUME_DISCOUNT_THRESHOLD,
                "volume_discount_price": VOLUME_DISCOUNT_PRICE,
                "referral_bonus_percent": REFERRAL_BONUS_PERCENT,
                "referral_instructions": "Add X-REFERRAL header with referrer wallet address to give them 20% of your payment"
            },
            "error": f"Payment required. Send {PRICE_USDC} USDC on Base to the payTo address, then retry with X-PAYMENT header containing the tx hash. First {TRIAL_FREE_CALLS} calls are FREE with X-TRIAL-WALLET header."
        }
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"detail": "Payment Required", "x402_payment_info": payment_info},
            headers={"X-PAYMENT-REQUIRED": json.dumps(payment_info)}
        )
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail={"detail": "Payment Required", "x402_payment_info": payment_info},
            headers={"X-PAYMENT-REQUIRED": json.dumps(payment_info)}
        )

    tx_hash = extract_tx_hash(payment_header)
    
    # Validate Tx Hash Format (66 hex chars, 0x prefix)
    if not re.match(r"^0x[a-fA-F0-9]{64}$", tx_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid transaction hash format. Must be a 66-character hex string starting with 0x."
        )

    # Replay Protection: Check SQLite
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT tx_hash FROM used_txs WHERE tx_hash = ?", (tx_hash,))
        if cursor.fetchone():
            raise HTTPException(
                status_code=status.HTTP_402_PAYMENT_REQUIRED,
                detail="Transaction hash already used (replay attack prevented)."
            )

    # Fetch Receipt via RPC
    receipt = await rpc_call("eth_getTransactionReceipt", [tx_hash])
    if not receipt:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Transaction receipt not found or transaction not yet confirmed on Base network."
        )

    if receipt.get("status") != "0x1":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Transaction execution failed on-chain (status = 0x0)."
        )

    # Find matching USDC Transfer log
    valid_transfer = False
    payer_address = None
    transferred_amount = 0.0

    logs = receipt.get("logs", [])
    for l in logs:
        log_address = l.get("address", "").lower()
        topics = l.get("topics", [])
        if log_address == USDC_ADDRESS.lower() and len(topics) >= 3:
            topic0 = topics[0].lower()
            if topic0 == TRANSFER_TOPIC_B4EF:
                recipient = "0x" + topics[2][-40:].lower()
                if recipient == WALLET_ADDRESS.lower():
                    raw_amount = int(l.get("data", "0x0"), 16)
                    if raw_amount >= PRICE_RAW:
                        valid_transfer = True
                        payer_address = "0x" + topics[1][-40:].lower()
                        transferred_amount = raw_amount / 1e6
                        break

    if not valid_transfer:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=f"Transaction does not contain a valid USDC transfer of >= {PRICE_USDC} USDC to target wallet {WALLET_ADDRESS}."
        )

    # Record in SQLite (used_txs and sales)
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO used_txs (tx_hash, endpoint, amount_usdc, payer_address) VALUES (?, ?, ?, ?)",
            (tx_hash, request.url.path, transferred_amount, payer_address)
        )
        cursor.execute(
            "INSERT INTO sales (tx_hash, endpoint, amount_usdc, payer_address) VALUES (?, ?, ?, ?)",
            (tx_hash, request.url.path, transferred_amount, payer_address)
        )
        conn.commit()

    return {
        "tx_hash": tx_hash,
        "payer_address": payer_address,
        "amount_usdc": transferred_amount,
        "endpoint": request.url.path
    }

# =====================================================================
# 4 FREE ENDPOINTS
# =====================================================================

@app.get("/", summary="Root Metadata")

async def root_endpoint():
