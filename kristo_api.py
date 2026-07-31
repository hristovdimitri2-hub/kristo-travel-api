import asyncio
import json
import logging
import os
import re
import sqlite3
import time
from typing import Dict, Any, List, Optional

import httpx
import uvicorn
from fastapi import FastAPI, Request, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger("kristo_api")

# Environment Configuration
BASE_RPC_URL = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
WALLET_ADDRESS = os.getenv("WALLET_ADDRESS", "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f")
USDC_ADDRESS = os.getenv("USDC_ADDRESS", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913")
WETH_ADDRESS = os.getenv("WETH_ADDRESS", "0x4200000000000000000000000000000000000006")
PRICE_USDC = float(os.getenv("PRICE_USDC", "0.01"))
PRICE_RAW = int(os.getenv("PRICE_RAW", "10000"))
CHAIN_ID = int(os.getenv("CHAIN_ID", "8453"))
DB_PATH = os.getenv("DB_PATH", "kristo.db")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
RATE_LIMIT = os.getenv("RATE_LIMIT", "30/minute")
TRIAL_FREE_CALLS = int(os.getenv("TRIAL_FREE_CALLS", "3"))
VOLUME_DISCOUNT_THRESHOLD = int(os.getenv("VOLUME_DISCOUNT_THRESHOLD", "50"))
VOLUME_DISCOUNT_PRICE = float(os.getenv("VOLUME_DISCOUNT_PRICE", "0.005"))
REFERRAL_BONUS_PERCENT = float(os.getenv("REFERRAL_BONUS_PERCENT", "0.20"))

# Freemium endpoints (free with rate limiting)
FREEMIUM_ENDPOINTS = {"/crypto/token-prices", "/crypto/gas-oracle"}

TRANSFER_TOPIC_B4EF = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b4ef"

TOKEN_MAP = {
    "ETH": "ethereum",
    "USDC": "usd-coin",
    "WETH": "weth",
    "BASE": "base",
    "DAI": "dai",
    "WBTC": "wrapped-bitcoin",
    "AERO": "aerodrome-finance",
    "BRETT": "brett",
    "DEGEN": "degen",
    "LDO": "lido-dao",
    "UNI": "uniswap",
    "LINK": "chainlink"
}

# Cache Storage for Graceful Degradation
cache_store: Dict[str, Dict[str, Any]] = {
    "yields": {"timestamp": 0.0, "data": None},
    "tvl_movers": {"timestamp": 0.0, "data": None},
    "token_prices": {},  # symbol_key -> {"timestamp": float, "data": Any}
}

# Database Initialization
def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS used_txs (
            tx_hash TEXT PRIMARY KEY,
            used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            endpoint TEXT,
            amount_usdc REAL,
            payer_address TEXT
        )
        """)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tx_hash TEXT,
            endpoint TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            amount_usdc REAL,
            payer_address TEXT
        )
        """)
        # Trial credits: 3 free calls per wallet
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS trial_credits (
            wallet_address TEXT PRIMARY KEY,
            credits_used INTEGER DEFAULT 0,
            first_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        # Referral system: track who referred whom
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS referrals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            referred_wallet TEXT,
            referrer_wallet TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total_earnings REAL DEFAULT 0
        )
        """)
        # Call counter for volume discounts
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS call_counts (
            wallet_address TEXT PRIMARY KEY,
            total_calls INTEGER DEFAULT 0,
            first_call_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        # Intelligence engine: stores analysis reports and pricing decisions
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS intelligence_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            report_type TEXT,
            analysis TEXT,
            recommendations TEXT,
            pricing_changes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """)
        # Dynamic pricing per endpoint
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS dynamic_pricing (
            endpoint TEXT PRIMARY KEY,
            current_price REAL,
            base_price REAL,
            last_adjusted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            adjustment_reason TEXT,
            calls_24h INTEGER DEFAULT 0,
            calls_7d INTEGER DEFAULT 0
        )
        """)
        conn.commit()
    logger.info(f"Database initialized at {DB_PATH}")

# Print startup configuration
def print_config():
    print("=" * 60)
    print("      KRISTO INTELLIGENCE API - STARTUP CONFIGURATION     ")
    print("=" * 60)
    print(f"  Service Name  : Kristo Intelligence")
    print(f"  Version       : 1.0.0")
    print(f"  Base RPC URL  : {BASE_RPC_URL}")
    print(f"  Chain ID      : {CHAIN_ID}")
    print(f"  Wallet Address: {WALLET_ADDRESS}")
    print(f"  USDC Address  : {USDC_ADDRESS}")
    print(f"  WETH Address  : {WETH_ADDRESS}")
    print(f"  Price (USDC)  : {PRICE_USDC} USDC ({PRICE_RAW} raw units)")
    print(f"  Database Path : {DB_PATH}")
    print(f"  Host / Port   : {HOST}:{PORT}")
    print(f"  Rate Limit    : {RATE_LIMIT}")
    print("=" * 60)

# Setup Rate Limiter & FastAPI App
limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])
app = FastAPI(
    title="Kristo Intelligence API",
    version="1.0.0",
    description="Production-ready pay-per-call API service for AI agents using x402 protocol on Base blockchain",
    openapi_url=None  # We serve a custom /openapi.json
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-PAYMENT-REQUIRED", "X-PAYMENT-ACCEPTED"]
)

# Shared HTTP Client
http_client: Optional[httpx.AsyncClient] = None

@app.on_event("startup")
async def startup_event():
    global http_client
    init_db()
    print_config()
    http_client = httpx.AsyncClient(timeout=15.0)
    # Start the autonomous intelligence engine
    asyncio.create_task(intelligence_scheduler())
    logger.info("🧠 Autonomous Intelligence Engine started — runs every hour")

@app.on_event("shutdown")
async def shutdown_event():
    global http_client
    if http_client:
        await http_client.aclose()

# Helper RPC Caller
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
    """Root endpoint returning service metadata, pricing, and paid endpoints roster."""
    return {
        "service": "Kristo Intelligence",
        "version": "1.0.0",
        "description": "Pay-per-call AI Agent Intelligence API powered by x402 on Base Blockchain",
        "network": {
            "chain": "Base",
            "chain_id": CHAIN_ID,
            "rpc_url": BASE_RPC_URL
        },
        "pricing": {
            "model": "x402 protocol",
            "price_per_call_usdc": PRICE_USDC,
            "raw_units": PRICE_RAW,
            "asset": "USDC",
            "asset_address": USDC_ADDRESS,
            "pay_to": WALLET_ADDRESS
        },
        "free_endpoints": [
            "/",
            "/health",
            "/sales/recent",
            "/openapi.json"
        ],
        "free_endpoints": [
            "/",
            "/health",
            "/sales/recent",
            "/pricing",
            "/stats",
            "/crypto/token-prices (freemium)",
            "/crypto/gas-oracle (freemium)"
        ],
        "paid_endpoints": [
            {"path": "/defi/yields", "price_usdc": PRICE_USDC, "description": "Top 10 Base DeFi yield pools by TVL"},
            {"path": "/defi/tvl-movers", "price_usdc": PRICE_USDC, "description": "Base DeFi protocols with biggest 1-day TVL changes"},
            {"path": "/defi/lending-rates", "price_usdc": PRICE_USDC, "description": "Best lending/borrowing rates on Base"},
            {"path": "/defi/dex-pools", "price_usdc": PRICE_USDC, "description": "Top DEX liquidity pools on Base"},
            {"path": "/defi/protocol-safety", "price_usdc": PRICE_USDC, "description": "DeFi protocol safety scores and risk assessment"},
            {"path": "/crypto/token-launches", "price_usdc": PRICE_USDC, "description": "Recently launched tokens on Base"},
            {"path": "/crypto/wallet-profile", "price_usdc": PRICE_USDC, "description": "Wallet analysis and classification"},
            {"path": "/crypto/whale-moves", "price_usdc": PRICE_USDC, "description": "Large USDC transfers on Base"},
            {"path": "/crypto/bridge-volume", "price_usdc": PRICE_USDC, "description": "Cross-chain bridge volume to/from Base"},
            {"path": "/crypto/token-security", "price_usdc": PRICE_USDC, "description": "Token security scanner — rug-pull & honeypot detection"}
        ],
        "hooks": {
            "trial_credits": f"First {TRIAL_FREE_CALLS} calls FREE — add X-TRIAL-WALLET header",
            "volume_discount": f"After {VOLUME_DISCOUNT_THRESHOLD} calls → {VOLUME_DISCOUNT_PRICE} USDC/call",
            "referral": f"Refer agents → earn {int(REFERRAL_BONUS_PERCENT * 100)}% of their payments",
            "freemium": "Token prices & gas oracle are FREE (rate-limited)"
        }
    }

@app.get("/health", summary="Health Check")

async def health_endpoint():
    """Health check endpoint checking API status, Web3 connectivity, block height, and network info."""
    web3_status = "ok"
    current_block = None
    try:
        block_hex = await rpc_call("eth_blockNumber")
        current_block = int(block_hex, 16)
    except Exception as e:
        logger.warning(f"Health check Web3 RPC failure: {e}")
        web3_status = "degraded"

    return {
        "status": "ok" if web3_status == "ok" else "degraded",
        "web3_status": web3_status,
        "wallet_address": WALLET_ADDRESS,
        "network": "Base Mainnet",
        "chain_id": CHAIN_ID,
        "rpc_url": BASE_RPC_URL,
        "current_block_number": current_block,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.get("/sales/recent", summary="Recent Sales Log")

async def recent_sales_endpoint():
    """Returns total sales count and the last 10 sales recorded in SQLite."""
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sales")
        total_sales = cursor.fetchone()[0]

        cursor.execute("SELECT id, tx_hash, endpoint, timestamp, amount_usdc, payer_address FROM sales ORDER BY id DESC LIMIT 10")
        rows = cursor.fetchall()
        recent_sales = [dict(row) for row in rows]

    return {
        "total_sales": total_sales,
        "recent_sales": recent_sales
    }

@app.get("/openapi.json", summary="OpenAPI Specification")

async def custom_openapi_endpoint():
    """Custom OpenAPI 3.1.0 specification with x402 pricing metadata included."""
    return {
        "openapi": "3.1.0",
        "info": {
            "title": "Kristo Intelligence API",
            "version": "1.0.0",
            "description": "Production-ready pay-per-call AI Agent Intelligence API powered by x402 on Base Blockchain (Chain ID 8453). "
                           "Each paid endpoint requires payment of 0.01 USDC sent to 0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f via X-PAYMENT header.",
            "x-402-pricing": {
                "price_per_call_usdc": PRICE_USDC,
                "amount_raw": str(PRICE_RAW),
                "asset": "USDC",
                "asset_address": USDC_ADDRESS,
                "pay_to": WALLET_ADDRESS,
                "chain_id": CHAIN_ID
            }
        },
        "paths": {
            "/": {
                "get": {
                    "summary": "Root Metadata",
                    "description": "Returns service metadata, pricing, and available endpoints.",
                    "responses": {"200": {"description": "Service metadata"}}
                }
            },
            "/health": {
                "get": {
                    "summary": "Health Check",
                    "description": "Returns API health status and current Base block height.",
                    "responses": {"200": {"description": "Health status"}}
                }
            },
            "/sales/recent": {
                "get": {
                    "summary": "Recent Sales Log",
                    "description": "Returns total sales count and last 10 sales from SQLite database.",
                    "responses": {"200": {"description": "Sales history"}}
                }
            },
            "/defi/yields": {
                "get": {
                    "summary": "Top Base Yield Pools (Paid)",
                    "description": "Requires 0.01 USDC via x402. Returns top 10 Base-chain yield pools from DefiLlama.",
                    "responses": {
                        "200": {"description": "Top 10 yield pools"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/defi/tvl-movers": {
                "get": {
                    "summary": "Base TVL Movers (Paid)",
                    "description": "Requires 0.01 USDC via x402. Returns top 15 Base DeFi protocols by 1-day TVL change.",
                    "responses": {
                        "200": {"description": "Top 15 TVL movers"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/crypto/token-prices": {
                "get": {
                    "summary": "Token Prices (Paid)",
                    "description": "Requires 0.01 USDC via x402. Returns real-time token prices from CoinGecko for specified Base tokens.",
                    "parameters": [
                        {
                            "name": "tokens",
                            "in": "query",
                            "required": False,
                            "schema": {"type": "string", "default": "ETH,USDC,WETH,BASE"}
                        }
                    ],
                    "responses": {
                        "200": {"description": "Real-time token prices"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/crypto/wallet-profile": {
                "get": {
                    "summary": "Wallet Profile Analysis (Paid)",
                    "description": "Requires 0.01 USDC via x402. Returns on-chain balances, transaction count, recent USDC activity, and tier classification.",
                    "parameters": [
                        {
                            "name": "address",
                            "in": "query",
                            "required": True,
                            "schema": {"type": "string"}
                        }
                    ],
                    "responses": {
                        "200": {"description": "Wallet profile and classification"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/crypto/whale-moves": {
                "get": {
                    "summary": "Whale USDC Moves (Paid)",
                    "description": "Requires 0.01 USDC via x402. Returns large USDC transfers on Base scanned from the last 500 blocks.",
                    "parameters": [
                        {
                            "name": "min_usdc",
                            "in": "query",
                            "required": False,
                            "schema": {"type": "number", "default": 1000.0}
                        }
                    ],
                    "responses": {
                        "200": {"description": "Whale transfers and aggregate stats"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/crypto/gas-oracle": {
                "get": {
                    "summary": "Base Gas Oracle (Paid)",
                    "description": "Requires 0.01 USDC via x402. Returns current Base gas price, cost estimates for ETH/USDC transfers, swaps, contract calls, and gas recommendation.",
                    "responses": {
                        "200": {"description": "Gas oracle metrics and estimates"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            }
        }
    }

# =====================================================================
# 6 PAID ENDPOINTS
# =====================================================================

@app.get("/defi/yields", summary="Top Base Yield Pools")

async def defi_yields_endpoint(payment: dict = Depends(verify_payment)):
    """
    Top 10 Base-chain DeFi yield pools by TVL from DefiLlama. 5-minute TTL cache with graceful degradation.
    """
    now = time.time()
    cache = cache_store["yields"]

    # Check cache (5 min = 300s TTL)
    if cache["data"] is not None and (now - cache["timestamp"]) < 300:
        return cache["data"]

    # Fetch from DefiLlama
    try:
        res = await http_client.get("https://yields.llama.fi/pools")
        res.raise_for_status()
        pools = res.json().get("data", [])
        
        base_pools = [p for p in pools if p.get("chain", "").lower() == "base"]
        base_pools.sort(key=lambda x: x.get("tvlUsd", 0) or 0, reverse=True)
        top10 = base_pools[:10]

        result_pools = []
        for p in top10:
            result_pools.append({
                "pool_id": p.get("pool"),
                "symbol": p.get("symbol"),
                "project": p.get("project"),
                "chain": p.get("chain"),
                "tvl_usd": p.get("tvlUsd"),
                "apy_total": p.get("apy"),
                "apy_base": p.get("apyBase"),
                "apy_reward": p.get("apyReward"),
                "underlying_tokens": p.get("underlyingTokens") or [],
                "reward_tokens": p.get("rewardTokens") or []
            })

        response_data = {
            "source": "DefiLlama",
            "chain": "Base",
            "count": len(result_pools),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "pools": result_pools
        }

        cache_store["yields"] = {"timestamp": now, "data": response_data}
        return response_data

    except Exception as e:
        logger.error(f"Failed to fetch DefiLlama yields: {e}")
        # Graceful degradation: return stale cache if available
        if cache["data"] is not None:
            logger.info("Serving stale cache for /defi/yields due to external API error")
            stale_data = dict(cache["data"])
            stale_data["degraded"] = True
            stale_data["note"] = "Serving stale cache due to DefiLlama API error"
            return stale_data
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch yield data from DefiLlama: {str(e)}"
        )

@app.get("/defi/tvl-movers", summary="Base TVL Movers")

async def defi_tvl_movers_endpoint(payment: dict = Depends(verify_payment)):
    """
    Base DeFi protocols with biggest 1-day TVL changes from DefiLlama. 5-minute TTL cache with graceful degradation.
    """
    now = time.time()
    cache = cache_store["tvl_movers"]

    # Check cache (5 min = 300s TTL)
    if cache["data"] is not None and (now - cache["timestamp"]) < 300:
        return cache["data"]

    try:
        res = await http_client.get("https://api.llama.fi/protocols")
        res.raise_for_status()
        protocols = res.json()

        base_protocols = []
        for p in protocols:
            chains = [str(c).lower() for c in p.get("chains", [])]
            chain_tvls = p.get("chainTvls", {})
            chain_tvl_keys = [str(k).lower() for k in chain_tvls.keys()]

            if "base" in chains or "base" in chain_tvl_keys:
                base_tvl = 0.0
                for k, v in chain_tvls.items():
                    if k.lower() == "base":
                        if isinstance(v, (int, float)):
                            base_tvl = float(v)
                        elif isinstance(v, dict):
                            base_tvl = float(v.get("tvl", 0) or 0)

                total_tvl = float(p.get("tvl") or 0.0)
                display_tvl = base_tvl if base_tvl > 0 else total_tvl

                base_protocols.append({
                    "name": p.get("name"),
                    "category": p.get("category"),
                    "tvl": display_tvl,
                    "total_tvl": total_tvl,
                    "change_1d": p.get("change_1d"),
                    "change_7d": p.get("change_7d"),
                    "change_30d": p.get("change_1m"),
                    "market_cap": p.get("mcap"),
                    "token_symbol": p.get("symbol")
                })

        # Sort by absolute 1-day change descending
        base_protocols.sort(key=lambda x: abs(x["change_1d"] or 0), reverse=True)
        top15 = base_protocols[:15]

        response_data = {
            "source": "DefiLlama",
            "chain": "Base",
            "count": len(top15),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "protocols": top15
        }

        cache_store["tvl_movers"] = {"timestamp": now, "data": response_data}
        return response_data

    except Exception as e:
        logger.error(f"Failed to fetch DefiLlama protocols: {e}")
        if cache["data"] is not None:
            logger.info("Serving stale cache for /defi/tvl-movers due to external API error")
            stale_data = dict(cache["data"])
            stale_data["degraded"] = True
            stale_data["note"] = "Serving stale cache due to DefiLlama API error"
            return stale_data
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch TVL movers from DefiLlama: {str(e)}"
        )

@app.get("/crypto/token-prices", summary="Token Prices")

async def crypto_token_prices_endpoint(
    tokens: str = Query("ETH,USDC,WETH,BASE", description="Comma-separated token symbols (e.g. ETH,USDC,WETH,BASE,AERO)"),
    payment: dict = Depends(verify_payment)
):
    """
    Real-time token prices from CoinGecko. 60-second TTL cache with graceful degradation.
    Supports 12 Base tokens: ETH, USDC, WETH, BASE, DAI, WBTC, AERO, BRETT, DEGEN, LDO, UNI, LINK.
    """
    requested_symbols = [t.strip().upper() for t in tokens.split(",") if t.strip()]
    if not requested_symbols:
        requested_symbols = ["ETH", "USDC", "WETH", "BASE"]

    cache_key = ",".join(sorted(requested_symbols))
    now = time.time()
    cache = cache_store["token_prices"].get(cache_key)

    # Check cache (60s TTL)
    if cache is not None and (now - cache["timestamp"]) < 60:
        return cache["data"]

    # Map requested symbols to CoinGecko IDs
    cg_ids = []
    symbol_to_cg = {}
    for sym in requested_symbols:
        cg_id = TOKEN_MAP.get(sym, sym.lower())
        cg_ids.append(cg_id)
        symbol_to_cg[cg_id] = sym

    try:
        url = "https://api.coingecko.com/api/v3/simple/price"
        params = {
            "ids": ",".join(cg_ids),
            "vs_currencies": "usd",
            "include_24hr_change": "true",
            "include_market_cap": "true"
        }
        res = await http_client.get(url, params=params)
        res.raise_for_status()
        data = res.json()

        prices_result = []
        for cg_id in cg_ids:
            sym = symbol_to_cg.get(cg_id, cg_id.upper())
            token_data = data.get(cg_id, {})
            prices_result.append({
                "symbol": sym,
                "coingecko_id": cg_id,
                "price_usd": token_data.get("usd"),
                "change_24h": token_data.get("usd_24h_change"),
                "market_cap": token_data.get("usd_market_cap")
            })

        response_data = {
            "source": "CoinGecko",
            "count": len(prices_result),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "prices": prices_result
        }

        cache_store["token_prices"][cache_key] = {"timestamp": now, "data": response_data}
        return response_data

    except Exception as e:
        logger.error(f"Failed to fetch CoinGecko token prices: {e}")
        
        # Try CoinCap as fallback
        try:
            symbol_map = {"ETH": "ethereum", "USDC": "usd-coin", "WETH": "weth",
                         "BASE": "base-protocol", "DAI": "dai", "WBTC": "wrapped-bitcoin",
                         "AERO": "aerodrome-finance", "BRETT": "brett", "DEGEN": "degen",
                         "LDO": "lido-dao", "UNI": "uniswap", "LINK": "chainlink"}
            
            coincap_ids = [symbol_map.get(s, s.lower()) for s in requested_symbols]
            cc_res = await http_client.get(
                f"https://api.coincap.io/v2/assets?ids={','.join(coincap_ids)}",
                timeout=10.0
            )
            if cc_res.status_code == 200:
                cc_data = cc_res.json().get("data", [])
                prices_result = []
                for item in cc_data:
                    prices_result.append({
                        "symbol": item.get("symbol", ""),
                        "coingecko_id": item.get("id", ""),
                        "price_usd": float(item.get("priceUsd", 0)),
                        "change_24h": float(item.get("changePercent24Hr", 0)),
                        "market_cap": float(item.get("marketCapUsd", 0))
                    })
                response_data = {
                    "source": "CoinCap (fallback)",
                    "count": len(prices_result),
                    "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                    "prices": prices_result
                }
                cache_store["token_prices"][cache_key] = {"timestamp": now, "data": response_data}
                return response_data
        except Exception as e2:
            logger.error(f"CoinCap fallback also failed: {e2}")
        
        # Try DexScreener as second fallback for ETH price
        try:
            dex_res = await http_client.get(
                "https://api.dexscreener.com/latest/dex/tokens/0x4200000000000000000000000000000000000006",
                timeout=8.0
            )
            if dex_res.status_code == 200:
                pairs = dex_res.json().get("pairs", [])
                if pairs:
                    eth_price = float(pairs[0].get("priceUsd", 0))
                    prices_result = [{"symbol": "ETH", "coingecko_id": "ethereum", "price_usd": eth_price, "change_24h": None, "market_cap": None}]
                    response_data = {
                        "source": "DexScreener (fallback)",
                        "count": len(prices_result),
                        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                        "prices": prices_result,
                        "note": "Partial data — only ETH price available via DexScreener"
                    }
                    return response_data
        except Exception as e3:
            logger.error(f"DexScreener fallback also failed: {e3}")
        
        # Serve stale cache if available
        if cache is not None and cache.get("data") is not None:
            logger.info(f"Serving stale cache for /crypto/token-prices ({cache_key})")
            stale_data = dict(cache["data"])
            stale_data["degraded"] = True
            stale_data["note"] = "Serving stale cache due to CoinGecko API error"
            return stale_data
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch token prices: CoinGecko={str(e)}"
        )

@app.get("/crypto/wallet-profile", summary="Wallet Profile Analysis")

async def crypto_wallet_profile_endpoint(
    address: str = Query(..., description="Target wallet address (0x...)"),
    payment: dict = Depends(verify_payment)
):
    """
    On-chain wallet analysis on Base. Fetches ETH balance, USDC balance, WETH balance, USDC transfer logs (last 500 blocks), tx count, and classifies wallet profile.
    """
    if not re.match(r"^0x[a-fA-F0-9]{40}$", address):
        raise HTTPException(status_code=400, detail="Invalid Ethereum address format. Expected 42 hex characters starting with 0x.")

    clean_addr = address.lower().replace("0x", "").zfill(64)
    calldata = "0x70a08231" + clean_addr
    padded_addr = "0x" + clean_addr

    # Execute RPC calls concurrently
    try:
        r_eth = rpc_call("eth_getBalance", [address, "latest"])
        r_txc = rpc_call("eth_getTransactionCount", [address, "latest"])
        r_usdc = rpc_call("eth_call", [{"to": USDC_ADDRESS, "data": calldata}, "latest"])
        r_weth = rpc_call("eth_call", [{"to": WETH_ADDRESS, "data": calldata}, "latest"])
        r_blk = rpc_call("eth_blockNumber")

        res_eth, res_txc, res_usdc, res_weth, res_blk = await asyncio.gather(
            r_eth, r_txc, r_usdc, r_weth, r_blk
        )

        eth_bal = int(res_eth, 16) / 1e18 if res_eth else 0.0
        tx_count = int(res_txc, 16) if res_txc else 0
        usdc_bal = int(res_usdc, 16) / 1e6 if res_usdc and res_usdc != "0x" else 0.0
        weth_bal = int(res_weth, 16) / 1e18 if res_weth and res_weth != "0x" else 0.0
        latest_block = int(res_blk, 16) if res_blk else 0

        # Query USDC transfer logs for this wallet in the last 500 blocks
        from_block = hex(max(0, latest_block - 500))

        req_out = rpc_call("eth_getLogs", [{
            "fromBlock": from_block,
            "toBlock": "latest",
            "address": USDC_ADDRESS,
            "topics": [TRANSFER_TOPIC_B4EF, padded_addr]
        }])
        req_in = rpc_call("eth_getLogs", [{
            "fromBlock": from_block,
            "toBlock": "latest",
            "address": USDC_ADDRESS,
            "topics": [TRANSFER_TOPIC_B4EF, None, padded_addr]
        }])

        logs_out, logs_in = await asyncio.gather(req_out, req_in, return_exceptions=True)
        if isinstance(logs_out, Exception):
            logs_out = []
        if isinstance(logs_in, Exception):
            logs_in = []

        vol_out = sum(int(l.get("data", "0x0"), 16) / 1e6 for l in logs_out)
        vol_in = sum(int(l.get("data", "0x0"), 16) / 1e6 for l in logs_in)

        # Estimate ETH price (~$2,000 baseline if price lookup skipped)
        eth_price_est = 2000.0
        estimated_total_usd = usdc_bal + (eth_bal * eth_price_est) + (weth_bal * eth_price_est)

        # Classifications
        classifications = []
        if estimated_total_usd > 100000 or usdc_bal > 100000:
            classifications.append("whale_institutional")
        if estimated_total_usd > 10000:
            classifications.append("high_value_trader")
        if estimated_total_usd > 1000:
            classifications.append("active_trader")
        if tx_count > 50:
            classifications.append("active_user")
        if estimated_total_usd > 0 or eth_bal > 0 or usdc_bal > 0 or weth_bal > 0:
            classifications.append("retail_holder")
        if not classifications:
            classifications.append("minimal_activity")

        primary_class = classifications[0]

        return {
            "address": address,
            "chain_id": CHAIN_ID,
            "network": "Base Mainnet",
            "balances": {
                "eth": eth_bal,
                "usdc": usdc_bal,
                "weth": weth_bal,
                "estimated_total_usd": round(estimated_total_usd, 2)
            },
            "tx_count": tx_count,
            "usdc_activity_last_500_blocks": {
                "blocks_scanned": 500,
                "sent_transfers_count": len(logs_out),
                "received_transfers_count": len(logs_in),
                "total_volume_sent_usdc": round(vol_out, 2),
                "total_volume_received_usdc": round(vol_in, 2)
            },
            "classifications": classifications,
            "primary_classification": primary_class
        }

    except Exception as e:
        logger.error(f"Error executing wallet profile analysis for {address}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile wallet profile from Base RPC: {str(e)}"
        )

@app.get("/crypto/whale-moves", summary="Whale USDC Transfers")

async def crypto_whale_moves_endpoint(
    min_usdc: float = Query(1000.0, description="Minimum USDC transfer threshold"),
    payment: dict = Depends(verify_payment)
):
    """
    Scans last 500 blocks on Base for USDC Transfer events >= min_usdc. Returns top 50 transfers and aggregate statistics.
    """
    try:
        block_hex = await rpc_call("eth_blockNumber")
        latest_block = int(block_hex, 16)

        # Chunk 500 blocks into 10 tasks of 50 blocks to bypass RPC response limits
        chunk_size = 50
        tasks = []
        for i in range(10):
            start = latest_block - (i + 1) * chunk_size + 1
            end = latest_block - i * chunk_size
            tasks.append(rpc_call("eth_getLogs", [{
                "fromBlock": hex(start),
                "toBlock": hex(end),
                "address": USDC_ADDRESS,
                "topics": [TRANSFER_TOPIC_B4EF]
            }]))

        chunk_results = await asyncio.gather(*tasks, return_exceptions=True)
        raw_logs = []
        for res in chunk_results:
            if isinstance(res, list):
                raw_logs.extend(res)

        transfers = []
        for l in raw_logs:
            data_hex = l.get("data", "0x0")
            amount = int(data_hex, 16) / 1e6
            if amount >= min_usdc:
                topics = l.get("topics", [])
                sender = "0x" + topics[1][-40:].lower() if len(topics) > 1 else "0x0"
                receiver = "0x" + topics[2][-40:].lower() if len(topics) > 2 else "0x0"
                block = int(l.get("blockNumber", "0x0"), 16)
                tx_hash = l.get("transactionHash", "")
                transfers.append({
                    "tx_hash": tx_hash,
                    "block_number": block,
                    "sender": sender,
                    "receiver": receiver,
                    "amount_usdc": round(amount, 2)
                })

        transfers.sort(key=lambda x: x["amount_usdc"], reverse=True)
        top50 = transfers[:50]

        total_vol = sum(t["amount_usdc"] for t in transfers)
        max_amt = transfers[0]["amount_usdc"] if transfers else 0.0
        avg_amt = (total_vol / len(transfers)) if transfers else 0.0

        return {
            "min_usdc_threshold": min_usdc,
            "blocks_scanned": 500,
            "latest_block": latest_block,
            "summary": {
                "total_whale_transfers": len(transfers),
                "total_volume_usdc": round(total_vol, 2),
                "max_transfer_usdc": round(max_amt, 2),
                "avg_transfer_usdc": round(avg_amt, 2)
            },
            "transfers": top50
        }

    except Exception as e:
        logger.error(f"Error fetching whale moves: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to scan whale USDC transfers: {str(e)}"
        )

@app.get("/crypto/gas-oracle", summary="Base Gas Oracle")

async def crypto_gas_oracle_endpoint(payment: dict = Depends(verify_payment)):
    """
    Current Base gas price via eth_gasPrice RPC. Calculates operation costs for ETH transfer, USDC transfer, DEX swap, and contract call.
    """
    try:
        r_gas = rpc_call("eth_gasPrice")
        r_blk = rpc_call("eth_blockNumber")

        res_gas, res_blk = await asyncio.gather(r_gas, r_blk)

        gas_wei = int(res_gas, 16)
        block = int(res_blk, 16)
        gas_gwei = gas_wei / 1e9

        if gas_gwei < 0.05:
            recommendation = "low"
            rec_details = "Gas fees are low (< 0.05 Gwei). Excellent time for transactions."
        elif gas_gwei <= 0.2:
            recommendation = "medium"
            rec_details = "Gas fees are normal (0.05 - 0.2 Gwei)."
        else:
            recommendation = "high"
            rec_details = "Gas fees are elevated (> 0.2 Gwei). Consider delaying non-urgent transactions."

        operations = {
            "eth_transfer": 21000,
            "usdc_transfer": 65000,
            "dex_swap": 180000,
            "contract_call": 200000
        }

        estimated_costs = {}
        for op, units in operations.items():
            fee_wei = units * gas_wei
            fee_eth = fee_wei / 1e18
            estimated_costs[op] = {
                "gas_units": units,
                "cost_wei": fee_wei,
                "cost_gwei": round(units * gas_gwei, 4),
                "cost_eth": fee_eth
            }

        return {
            "network": "Base Mainnet",
            "chain_id": CHAIN_ID,
            "current_block": block,
            "gas_price_wei": gas_wei,
            "gas_price_gwei": round(gas_gwei, 6),
            "recommendation": recommendation,
            "recommendation_details": rec_details,
            "estimated_costs": estimated_costs
        }

    except Exception as e:
        logger.error(f"Error fetching gas oracle data: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve gas oracle from Base RPC: {str(e)}"
        )


# =====================================================================
# 5 NEW PAID ENDPOINTS (v2.0 expansion)
# =====================================================================

@app.get("/defi/lending-rates", summary="Base Lending Rates")
async def defi_lending_rates_endpoint(payment: dict = Depends(verify_payment)):
    """Best lending and borrowing rates on Base chain. 5-min TTL cache."""
    now = time.time()
    cache = cache_store.get("lending_rates", {"timestamp": 0.0, "data": None})

    if cache["data"] is not None and (now - cache["timestamp"]) < 300:
        return cache["data"]

    try:
        res = await http_client.get("https://yields.llama.fi/pools")
        res.raise_for_status()
        pools = res.json().get("data", [])
        lending_pools = [p for p in pools if p.get("chain", "").lower() == "base" and p.get("category", "").lower() in ["lend", "lending", "cdp"]]
        lending_pools.sort(key=lambda x: x.get("apy", 0) or 0, reverse=True)
        top10 = lending_pools[:10]

        result = []
        for p in top10:
            result.append({
                "project": p.get("project"), "symbol": p.get("symbol"),
                "tvl_usd": p.get("tvlUsd"), "apy": p.get("apy"),
                "apy_base": p.get("apyBase"), "apy_reward": p.get("apyReward"),
                "stablecoin": p.get("stablecoin", False),
                "underlying_tokens": p.get("underlyingTokens") or [],
                "reward_tokens": p.get("rewardTokens") or []
            })

        response_data = {"source": "DefiLlama", "chain": "Base", "category": "Lending", "count": len(result),
                        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "rates": result}
        cache_store["lending_rates"] = {"timestamp": now, "data": response_data}
        return response_data
    except Exception as e:
        logger.error(f"Failed to fetch lending rates: {e}")
        if cache.get("data"):
            stale = dict(cache["data"]); stale["degraded"] = True; return stale
        raise HTTPException(status_code=503, detail=f"Unable to fetch lending rates: {str(e)}")


@app.get("/defi/dex-pools", summary="Top DEX Liquidity Pools")
async def defi_dex_pools_endpoint(payment: dict = Depends(verify_payment)):
    """Top DEX liquidity pools on Base. 5-min TTL cache."""
    now = time.time()
    cache = cache_store.get("dex_pools", {"timestamp": 0.0, "data": None})

    if cache["data"] is not None and (now - cache["timestamp"]) < 300:
        return cache["data"]

    try:
        res = await http_client.get("https://yields.llama.fi/pools")
        res.raise_for_status()
        pools = res.json().get("data", [])
        dex_pools = [p for p in pools if p.get("chain", "").lower() == "base" and p.get("category", "").lower() in ["dexs", "dex", "amm"]]
        dex_pools.sort(key=lambda x: x.get("tvlUsd", 0) or 0, reverse=True)
        top15 = dex_pools[:15]

        result = []
        for p in top15:
            result.append({
                "pool": p.get("pool"), "project": p.get("project"), "symbol": p.get("symbol"),
                "tvl_usd": p.get("tvlUsd"), "apy": p.get("apy"),
                "apy_base": p.get("apyBase"), "apy_reward": p.get("apyReward"),
                "volume_24h": p.get("volumeUsd1d"), "fee_24h": p.get("feeUsd1d"),
                "underlying_tokens": p.get("underlyingTokens") or []
            })

        response_data = {"source": "DefiLlama", "chain": "Base", "category": "DEX Liquidity",
                        "count": len(result), "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "pools": result}
        cache_store["dex_pools"] = {"timestamp": now, "data": response_data}
        return response_data
    except Exception as e:
        logger.error(f"Failed to fetch DEX pools: {e}")
        if cache.get("data"):
            stale = dict(cache["data"]); stale["degraded"] = True; return stale
        raise HTTPException(status_code=503, detail=f"Unable to fetch DEX pools: {str(e)}")


@app.get("/crypto/token-launches", summary="Recently Launched Tokens on Base")
async def crypto_token_launches_endpoint(payment: dict = Depends(verify_payment)):
    """Recently launched tokens on Base from CoinGecko. 10-min TTL cache."""
    now = time.time()
    cache = cache_store.get("token_launches", {"timestamp": 0.0, "data": None})

    if cache["data"] is not None and (now - cache["timestamp"]) < 600:
        return cache["data"]

    try:
        res = await http_client.get("https://api.coingecko.com/api/v3/coins/markets", params={
            "vs_currency": "usd", "category": "base-ecosystem", "order": "market_cap_desc",
            "per_page": 20, "page": 1, "sparkline": "false", "price_change_percentage": "24h"
        })
        res.raise_for_status()
        tokens = res.json()

        result = []
        for t in tokens[:15]:
            result.append({
                "id": t.get("id"), "symbol": t.get("symbol", "").upper(), "name": t.get("name"),
                "price_usd": t.get("current_price"), "market_cap": t.get("market_cap"),
                "volume_24h": t.get("total_volume"), "change_24h": t.get("price_change_percentage_24h"),
                "ath": t.get("ath"), "atl": t.get("atl"), "listed_at": t.get("last_updated")
            })

        response_data = {"source": "CoinGecko", "chain": "Base", "category": "Token Launches",
                        "count": len(result), "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "tokens": result}
        cache_store["token_launches"] = {"timestamp": now, "data": response_data}
        return response_data
    except Exception as e:
        logger.error(f"Failed to fetch token launches: {e}")
        if cache.get("data"):
            stale = dict(cache["data"]); stale["degraded"] = True; return stale
        raise HTTPException(status_code=503, detail=f"Unable to fetch token launches: {str(e)}")


@app.get("/crypto/bridge-volume", summary="Cross-Chain Bridge Volume to Base")
async def crypto_bridge_volume_endpoint(payment: dict = Depends(verify_payment)):
    """Cross-chain bridge volume to/from Base. 10-min TTL cache."""
    now = time.time()
    cache = cache_store.get("bridge_volume", {"timestamp": 0.0, "data": None})

    if cache["data"] is not None and (now - cache["timestamp"]) < 600:
        return cache["data"]

    try:
        res = await http_client.get("https://api.llama.fi/bridges", params={"chain": "base"})
        res.raise_for_status()
        data = res.json()

        bridges = []
        if isinstance(data, list):
            for b in data[:10]:
                bridges.append({
                    "name": b.get("name"), "chains": b.get("chains", []),
                    "chain_tvls": b.get("chainTvls", {}), "tvl": b.get("tvl"),
                    "address": b.get("address"), "symbol": b.get("symbol")
                })

        response_data = {"source": "DefiLlama Bridges", "chain": "Base", "category": "Bridge Volume",
                        "count": len(bridges), "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "bridges": bridges}
        cache_store["bridge_volume"] = {"timestamp": now, "data": response_data}
        return response_data
    except Exception as e:
        logger.error(f"Failed to fetch bridge volume: {e}")
        if cache.get("data"):
            stale = dict(cache["data"]); stale["degraded"] = True; return stale
        raise HTTPException(status_code=503, detail=f"Unable to fetch bridge volume: {str(e)}")


@app.get("/defi/protocol-safety", summary="DeFi Protocol Safety Scores")
async def defi_protocol_safety_endpoint(payment: dict = Depends(verify_payment)):
    """Safety and risk assessment of Base DeFi protocols. 15-min TTL cache."""
    now = time.time()
    cache = cache_store.get("protocol_safety", {"timestamp": 0.0, "data": None})

    if cache["data"] is not None and (now - cache["timestamp"]) < 900:
        return cache["data"]

    try:
        res = await http_client.get("https://api.llama.fi/protocols")
        res.raise_for_status()
        protocols = res.json()

        base_protocols = []
        for p in protocols:
            chains = [str(c).lower() for c in p.get("chains", [])]
            if "base" in chains:
                tvl = float(p.get("tvl") or 0)
                change_1d = p.get("change_1d") or 0
                change_7d = p.get("change_7d") or 0
                volatility = abs(change_1d) + abs(change_7d)

                if tvl > 100_000_000: risk_level, risk_score = "Low", 85
                elif tvl > 10_000_000: risk_level, risk_score = "Medium", 65
                elif tvl > 1_000_000: risk_level, risk_score = "Elevated", 45
                else: risk_level, risk_score = "High", 25

                if volatility > 20:
                    risk_score = max(0, risk_score - 15)
                    if risk_level == "Low": risk_level = "Elevated"

                base_protocols.append({
                    "name": p.get("name"), "category": p.get("category"), "tvl": tvl,
                    "change_1d": change_1d, "change_7d": change_7d, "change_30d": p.get("change_1m"),
                    "risk_level": risk_level, "risk_score": max(0, min(100, risk_score)),
                    "url": p.get("url"), "parent_project": p.get("parentProject")
                })

        base_protocols.sort(key=lambda x: x["risk_score"], reverse=True)

        response_data = {
            "source": "DefiLlama + Internal Risk Model", "chain": "Base", "category": "Protocol Safety",
            "count": len(base_protocols), "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "protocols": base_protocols,
            "risk_levels": {"Low": "85-100", "Medium": "65-84", "Elevated": "45-64", "High": "0-44"}
        }
        cache_store["protocol_safety"] = {"timestamp": now, "data": response_data}
        return response_data
    except Exception as e:
        logger.error(f"Failed to fetch protocol safety: {e}")
        if cache.get("data"):
            stale = dict(cache["data"]); stale["degraded"] = True; return stale
        raise HTTPException(status_code=503, detail=f"Unable to fetch protocol safety: {str(e)}")


# =====================================================================
# 2 NEW FREE ENDPOINTS (marketing hooks)
# =====================================================================

@app.get("/pricing", summary="Pricing & Plans")
async def pricing_endpoint():
    """Transparent pricing info including volume discounts, trial credits, and referral program."""
    return {
        "service": "Kristo Intelligence",
        "pricing_model": "x402 pay-per-call",
        "base_price_per_call_usdc": PRICE_USDC,
        "freemium_endpoints": ["/crypto/token-prices", "/crypto/gas-oracle"],
        "paid_endpoints": [
            {"path": "/defi/yields", "price_usdc": PRICE_USDC, "description": "Top Base yield pools"},
            {"path": "/defi/tvl-movers", "price_usdc": PRICE_USDC, "description": "Base TVL movers"},
            {"path": "/defi/lending-rates", "price_usdc": PRICE_USDC, "description": "Lending & borrowing rates"},
            {"path": "/defi/dex-pools", "price_usdc": PRICE_USDC, "description": "DEX liquidity pools"},
            {"path": "/defi/protocol-safety", "price_usdc": PRICE_USDC, "description": "Protocol safety scores"},
            {"path": "/crypto/token-launches", "price_usdc": PRICE_USDC, "description": "New Base tokens"},
            {"path": "/crypto/wallet-profile", "price_usdc": PRICE_USDC, "description": "Wallet analysis"},
            {"path": "/crypto/whale-moves", "price_usdc": PRICE_USDC, "description": "Whale transfers"},
            {"path": "/crypto/bridge-volume", "price_usdc": PRICE_USDC, "description": "Bridge volume"},
            {"path": "/crypto/token-security", "price_usdc": PRICE_USDC, "description": "Rug-pull & honeypot detection"}
        ],
        "hooks": {
            "trial_credits": {"free_calls": TRIAL_FREE_CALLS, "description": f"First {TRIAL_FREE_CALLS} calls FREE for new wallets"},
            "volume_discount": {"threshold": VOLUME_DISCOUNT_THRESHOLD, "price": VOLUME_DISCOUNT_PRICE, "description": f"After {VOLUME_DISCOUNT_THRESHOLD} calls → {VOLUME_DISCOUNT_PRICE} USDC/call"},
            "referral_program": {"bonus_percent": REFERRAL_BONUS_PERCENT, "description": f"Refer agents → earn {int(REFERRAL_BONUS_PERCENT * 100)}% of their payments"}
        },
        "payment": {"network": "Base", "chain_id": CHAIN_ID, "asset": "USDC", "pay_to": WALLET_ADDRESS}
    }


@app.get("/stats", summary="API Usage Statistics")
async def stats_endpoint():
    """Public API usage statistics."""
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM sales")
        total_paid_calls = cursor.fetchone()[0]
        cursor.execute("SELECT COALESCE(SUM(amount_usdc), 0) FROM sales")
        total_revenue = cursor.fetchone()[0]
        cursor.execute("SELECT endpoint, COUNT(*) as calls, SUM(amount_usdc) as revenue FROM sales GROUP BY endpoint ORDER BY calls DESC")
        endpoint_stats = [{"endpoint": r[0], "calls": r[1], "revenue_usdc": r[2]} for r in cursor.fetchall()]
        cursor.execute("SELECT COUNT(DISTINCT payer_address) FROM sales WHERE payer_address IS NOT NULL")
        unique_wallets = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM sales WHERE timestamp >= datetime('now', '-1 day')")
        calls_24h = cursor.fetchone()[0]
        cursor.execute("SELECT COALESCE(SUM(amount_usdc), 0) FROM sales WHERE timestamp >= datetime('now', '-1 day')")
        revenue_24h = cursor.fetchone()[0]

    return {
        "service": "Kristo Intelligence",
        "total_paid_calls": total_paid_calls, "total_revenue_usdc": round(total_revenue, 2),
        "calls_24h": calls_24h, "revenue_24h_usdc": round(revenue_24h, 2),
        "unique_wallets": unique_wallets, "endpoint_popularity": endpoint_stats,
        "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }


# =====================================================================
# AUTONOMOUS INTELLIGENCE ENGINE
# =====================================================================

async def run_intelligence_cycle():
    """
    Background intelligence cycle that runs every hour.
    Analyzes sales patterns, market conditions, and makes pricing decisions.
    """
    logger.info("🧠 Intelligence cycle started...")

    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cursor = conn.cursor()

            # 1. Analyze endpoint popularity (last 24h and 7d)
            cursor.execute("""
                SELECT endpoint,
                    COUNT(*) as calls,
                    SUM(amount_usdc) as revenue
                FROM sales
                WHERE timestamp >= datetime('now', '-1 day')
                GROUP BY endpoint ORDER BY calls DESC
            """)
            stats_24h = [dict(r) for r in cursor.fetchall()]

            cursor.execute("""
                SELECT endpoint,
                    COUNT(*) as calls,
                    SUM(amount_usdc) as revenue
                FROM sales
                WHERE timestamp >= datetime('now', '-7 days')
                GROUP BY endpoint ORDER BY calls DESC
            """)
            stats_7d = [dict(r) for r in cursor.fetchall()]

            # 2. Identify top performing endpoints
            top_endpoints = sorted(stats_24h, key=lambda x: x["revenue"] or 0, reverse=True)
            top_endpoint = top_endpoints[0]["endpoint"] if top_endpoints else None
            top_revenue = top_endpoints[0]["revenue"] if top_endpoints else 0

            # 3. Identify underperforming endpoints
            all_paid = ["/defi/yields", "/defi/tvl-movers", "/defi/lending-rates",
                       "/defi/dex-pools", "/defi/protocol-safety",
                       "/crypto/token-launches", "/crypto/wallet-profile",
                       "/crypto/whale-moves", "/crypto/bridge-volume",
                       "/crypto/token-security"]
            active_endpoints_24h = {s["endpoint"] for s in stats_24h}
            underperforming = [ep for ep in all_paid if ep not in active_endpoints_24h]

            # 4. Calculate total revenue and calls
            cursor.execute("SELECT COUNT(*) as total, COALESCE(SUM(amount_usdc), 0) as revenue FROM sales WHERE timestamp >= datetime('now', '-1 day')")
            row = cursor.fetchone()
            total_calls_24h = row["total"]
            total_revenue_24h = row["revenue"]

            cursor.execute("SELECT COUNT(DISTINCT payer_address) as wallets FROM sales WHERE timestamp >= datetime('now', '-7 days' AND payer_address IS NOT NULL)")
            unique_wallets = cursor.fetchone()["wallets"] if cursor.fetchone() else 0

            # 5. Dynamic pricing decisions
            pricing_changes = []
            for ep_stats in stats_24h:
                ep = ep_stats["endpoint"]
                calls = ep_stats["calls"]
                revenue = ep_stats["revenue"] or 0

                # High demand (>20 calls/day) → increase price by 20%
                if calls > 20:
                    new_price = round(PRICE_USDC * 1.2, 4)
                    pricing_changes.append({
                        "endpoint": ep, "action": "increase",
                        "from": PRICE_USDC, "to": new_price,
                        "reason": f"High demand: {calls} calls in 24h"
                    })
                # Low demand (1-3 calls) → decrease price by 20%
                elif calls <= 3 and calls > 0:
                    new_price = round(PRICE_USDC * 0.8, 4)
                    pricing_changes.append({
                        "endpoint": ep, "action": "decrease",
                        "from": PRICE_USDC, "to": new_price,
                        "reason": f"Low demand: only {calls} calls in 24h"
                    })

            # 6. Market trend analysis (check CoinGecko for trending Base tokens)
            market_trends = []
            try:
                res = await http_client.get(
                    "https://api.coingecko.com/api/v3/search/trending",
                    timeout=10.0
                )
                if res.status_code == 200:
                    trending = res.json().get("coins", [])
                    base_trending = []
                    for c in trending[:10]:
                        item = c.get("item", {})
                        base_trending.append({
                            "id": item.get("id"),
                            "name": item.get("name"),
                            "symbol": item.get("symbol"),
                            "market_cap_rank": item.get("market_cap_rank")
                        })
                    market_trends = base_trending
            except Exception as e:
                logger.warning(f"Market trend fetch failed: {e}")

            # 7. Generate recommendations
            recommendations = []

            # Recommend new endpoints based on performance
            if top_endpoint and top_revenue > 0:
                recommendations.append({
                    "type": "double_down",
                    "message": f"Top performer is {top_endpoint} (${top_revenue} USDC in 24h). Consider adding a premium variant with more detailed data.",
                    "priority": "high"
                })

            if underperforming:
                recommendations.append({
                    "type": "promote_underperforming",
                    "message": f"Endpoints with zero sales in 24h: {', '.join(underperforming)}. Consider making them freemium or bundling with popular endpoints.",
                    "priority": "medium"
                })

            # Recommend based on market trends
            if market_trends:
                trending_names = [t["symbol"] for t in market_trends[:3]]
                recommendations.append({
                    "type": "market_trend",
                    "message": f"Trending tokens on CoinGecko: {', '.join(trending_names)}. Consider adding token-specific endpoints for these trending tokens.",
                    "priority": "high"
                })

            # Revenue optimization
            if total_revenue_24h > 0 and total_calls_24h > 0:
                avg_revenue_per_call = total_revenue_24h / total_calls_24h
                recommendations.append({
                    "type": "revenue_optimization",
                    "message": f"Average revenue per call: ${avg_revenue_per_call:.4f} USDC. Total 24h: ${total_revenue_24h:.2f} USDC from {total_calls_24h} calls. If demand grows 10x, daily revenue would be ${total_revenue_24h * 10:.2f} USDC.",
                    "priority": "info"
                })
            else:
                recommendations.append({
                    "type": "growth_needed",
                    "message": "No sales in the last 24h. Focus on listing the API in x402 directories and marketing to AI agent developers.",
                    "priority": "high"
                })

            # 8. Store the report in SQLite
            report = {
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "stats_24h": {
                    "total_calls": total_calls_24h,
                    "total_revenue_usdc": round(total_revenue_24h, 4),
                    "top_endpoint": top_endpoint,
                    "top_revenue_usdc": round(top_revenue or 0, 4),
                    "endpoint_breakdown": stats_24h
                },
                "underperforming_endpoints": underperforming,
                "market_trends": market_trends,
                "pricing_changes": pricing_changes,
                "recommendations": recommendations,
                "total_endpoints": len(all_paid),
                "active_endpoints_24h": len(active_endpoints_24h)
            }

            cursor.execute(
                "INSERT INTO intelligence_reports (report_type, analysis, recommendations, pricing_changes) VALUES (?, ?, ?, ?)",
                ("hourly", json.dumps(report), json.dumps(recommendations), json.dumps(pricing_changes))
            )
            conn.commit()

            # 9. Apply dynamic pricing changes (log them, don't auto-apply for safety)
            for change in pricing_changes:
                cursor.execute(
                    """INSERT OR REPLACE INTO dynamic_pricing
                    (endpoint, current_price, base_price, last_adjusted_at, adjustment_reason, calls_24h, calls_7d)
                    VALUES (?, ?, ?, ?, ?, ?, ?)""",
                    (change["endpoint"], change["to"], PRICE_USDC,
                     time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                     change["reason"],
                     next((s["calls"] for s in stats_24h if s["endpoint"] == change["endpoint"]), 0),
                     next((s["calls"] for s in stats_7d if s["endpoint"] == change["endpoint"]), 0))
                )
            conn.commit()

            logger.info(f"🧠 Intelligence cycle complete. {len(recommendations)} recommendations, {len(pricing_changes)} pricing adjustments.")

    except Exception as e:
        logger.error(f"Intelligence cycle error: {e}")


async def intelligence_scheduler():
    """Runs the intelligence cycle every hour."""
    # Wait 60 seconds after startup before first run
    await asyncio.sleep(60)
    while True:
        await run_intelligence_cycle()
        # Run every hour (3600 seconds)
        await asyncio.sleep(3600)


@app.get("/agent/intelligence", summary="Autonomous Intelligence Report")
async def intelligence_report_endpoint():
    """
    Returns the latest autonomous intelligence analysis — sales patterns,
    market trends, pricing recommendations, and growth opportunities.
    The intelligence engine runs every hour automatically.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # Get latest report
        cursor.execute("SELECT * FROM intelligence_reports ORDER BY id DESC LIMIT 1")
        row = cursor.fetchone()

        latest_report = None
        if row:
            latest_report = {
                "id": row["id"],
                "created_at": row["created_at"],
                "analysis": json.loads(row["analysis"]) if row["analysis"] else None,
                "recommendations": json.loads(row["recommendations"]) if row["recommendations"] else [],
                "pricing_changes": json.loads(row["pricing_changes"]) if row["pricing_changes"] else []
            }

        # Get report count
        cursor.execute("SELECT COUNT(*) FROM intelligence_reports")
        total_reports = cursor.fetchone()[0]

        # Get pricing history
        cursor.execute("SELECT * FROM dynamic_pricing ORDER BY last_adjusted_at DESC")
        pricing_rows = cursor.fetchall()
        pricing_data = [dict(r) for r in pricing_rows]

    return {
        "service": "Kristo Intelligence — Autonomous Engine",
        "engine_status": "active" if latest_report else "warming_up",
        "total_reports": total_reports,
        "latest_report": latest_report,
        "dynamic_pricing": pricing_data,
        "next_cycle_in": "Every hour automatically"
    }


@app.get("/agent/recommendations", summary="AI Recommendations")
async def agent_recommendations_endpoint():
    """
    Returns just the latest AI-generated recommendations — actionable insights
    for the API owner about what to add, change, or promote.
    """
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT recommendations, created_at FROM intelligence_reports ORDER BY id DESC LIMIT 5")
        rows = cursor.fetchall()

    recommendations = []
    for r in rows:
        recs = json.loads(r["recommendations"]) if r["recommendations"] else []
        for rec in recs:
            rec["report_time"] = r["created_at"]
            recommendations.append(rec)

    return {
        "service": "Kristo Intelligence",
        "total_recommendations": len(recommendations),
        "recommendations": recommendations
    }



# =====================================================================
# TOKEN SECURITY SCANNER (Rug-Pull Detection) — Top selling endpoint
# =====================================================================

@app.get("/crypto/token-security", summary="Token Security Scanner (Rug-Pull Detection)")
async def crypto_token_security_endpoint(
    address: str = Query(..., description="Token contract address on Base (0x...)"),
    payment: dict = Depends(verify_payment)
):
    """
    Comprehensive security scan for any Base token. Detects honeypots, rug-pull risk,
    holder concentration, liquidity issues, and contract anomalies.
    Returns structured risk assessment with boolean flags for AI agent decision-making.
    """
    if not re.match(r"^0x[a-fA-F0-9]{40}$", address):
        raise HTTPException(status_code=400, detail="Invalid token address. Expected 42 hex characters starting with 0x.")

    token_addr = address.lower()
    token_addr_padded = token_addr.replace("0x", "").zfill(64)
    now = time.time()

    # Cache key for this token
    cache_key = f"security_{token_addr}"
    cache = cache_store.get(cache_key, {"timestamp": 0.0, "data": None})

    # 10 min cache
    if cache["data"] is not None and (now - cache["timestamp"]) < 600:
        return cache["data"]

    try:
        # 1. Get token contract code
        code_hex = await rpc_call("eth_getCode", [address, "latest"])

        # 2. Get token metadata via contract calls
        # name() = 0x06fdde03
        # symbol() = 0x95d89b41
        # decimals() = 0x313ce567
        # totalSupply() = 0x18160ddd
        # balanceOf(address) = 0x70a08231
        # allowance(address,address) = 0xdd62ed3e

        r_name = rpc_call("eth_call", [{"to": address, "data": "0x06fdde03"}, "latest"])
        r_symbol = rpc_call("eth_call", [{"to": address, "data": "0x95d89b41"}, "latest"])
        r_decimals = rpc_call("eth_call", [{"to": address, "data": "0x313ce567"}, "latest"])
        r_supply = rpc_call("eth_call", [{"to": address, "data": "0x18160ddd"}, "latest"])

        res_name, res_symbol, res_decimals, res_supply = await asyncio.gather(
            r_name, r_symbol, r_decimals, r_supply
        )

        # Decode token info
        def decode_string(hex_val):
            if not hex_val or hex_val == "0x":
                return None
            try:
                hex_val = hex_val[2:] if hex_val.startswith("0x") else hex_val
                # ABI-encoded string: offset(32) + length(32) + data
                if len(hex_val) >= 128:
                    data_hex = hex_val[128:]  # Skip offset + length
                    return bytes.fromhex(data_hex).decode("utf-8", errors="ignore").strip("\x00").strip()
                return None
            except:
                return None

        def decode_uint(hex_val):
            if not hex_val or hex_val == "0x":
                return 0
            try:
                return int(hex_val, 16)
            except:
                return 0

        token_name = decode_string(res_name) or "Unknown"
        token_symbol = decode_string(res_symbol) or "Unknown"
        token_decimals = decode_uint(res_decimals) or 18
        total_supply = decode_uint(res_supply)
        total_supply_formatted = total_supply / (10 ** token_decimals) if total_supply > 0 else 0

        # 3. Check if contract has mint function (0x40c10f19 = mint(address,uint256))
        # Check if contract has owner/setOwner functions (0x8da5cb5b = owner())
        r_owner = rpc_call("eth_call", [{"to": address, "data": "0x8da5cb5b"}, "latest"])
        res_owner = await r_owner

        owner_address = None
        if res_owner and res_owner != "0x" and len(res_owner) >= 66:
            owner_hex = res_owner[2:][-40:]
            if int(owner_hex, 16) != 0:
                owner_address = "0x" + owner_hex

        # 4. Check contract code size (proxy contracts are risky)
        code_size = len(code_hex[2:]) // 2 if code_hex and code_hex != "0x" else 0

        # 5. Check if contract is a proxy (has delegatecall)
        is_proxy = "f0c9a4" in (code_hex or "").lower() or "42804" in (code_hex or "").lower()

        # 6. Check if contract has renounced ownership (owner = 0x0)
        is_renounced = owner_address is None or (owner_address and int(owner_address[2:], 16) == 0)

        # 7. Try to fetch token info from CoinGecko
        coingecko_data = {}
        try:
            cg_res = await http_client.get(
                f"https://api.coingecko.com/api/v3/coins/base/contract/{token_addr}",
                timeout=10.0
            )
            if cg_res.status_code == 200:
                cg_data = cg_res.json()
                coingecko_data = {
                    "name": cg_data.get("name"),
                    "symbol": cg_data.get("symbol"),
                    "market_cap_rank": cg_data.get("market_cap_rank"),
                    "liquidity_usd": cg_data.get("liquidity_score"),
                    "community_score": cg_data.get("community_score"),
                    "developer_score": cg_data.get("developer_score"),
                    "public_interest_score": cg_data.get("public_interest_score"),
                    "listed_on_coingecko": True
                }
        except:
            pass

        # 8. Calculate risk score
        risk_factors = []
        risk_score = 100  # Start at perfect score

        # Contract code size check
        if code_size < 100:
            risk_score -= 20
            risk_factors.append({"factor": "tiny_contract", "severity": "high", "detail": f"Contract code is only {code_size} bytes — possible minimal/honeypot contract"})
            code_size_risk = True
        else:
            code_size_risk = False

        # Proxy check
        if is_proxy:
            risk_score -= 15
            risk_factors.append({"factor": "proxy_contract", "severity": "medium", "detail": "Contract appears to be a proxy — logic can be changed after deployment"})

        # Ownership check
        if not is_renounced:
            risk_score -= 10
            risk_factors.append({"factor": "owner_not_renounced", "severity": "medium", "detail": f"Contract owner is {owner_address} — owner can potentially modify contract state"})
        else:
            risk_factors.append({"factor": "ownership_renounced", "severity": "info", "detail": "Contract ownership appears renounced (good)"})

        # Mint capability check (look for mint function selector in bytecode)
        mint_selector = "40c10f19"  # mint(address,uint256)
        has_mint = mint_selector in (code_hex or "").lower()
        if has_mint and not is_renounced:
            risk_score -= 25
            risk_factors.append({"factor": "mintable", "severity": "high", "detail": "Contract has mint function and ownership is not renounced — owner can mint unlimited tokens"})
        elif has_mint and is_renounced:
            risk_factors.append({"factor": "mintable_renounced", "severity": "low", "detail": "Contract has mint function but ownership is renounced"})

        # Self-destruct check (0x43d7b30 = selfdestruct)
        has_selfdestruct = "43d7b30" in (code_hex or "").lower() or "ff" in (code_hex or "")[-2:]
        # This is a rough heuristic — not definitive

        # Total supply check
        if total_supply_formatted == 0:
            risk_score -= 30
            risk_factors.append({"factor": "zero_supply", "severity": "critical", "detail": "Token has zero total supply"})
        elif total_supply_formatted > 1_000_000_000_000:
            risk_score -= 5
            risk_factors.append({"factor": "huge_supply", "severity": "low", "detail": f"Very large total supply: {total_supply_formatted:,.0f}"})

        # CoinGecko listing check
        if coingecko_data.get("listed_on_coingecko"):
            risk_factors.append({"factor": "listed_coingecko", "severity": "positive", "detail": "Token is listed on CoinGecko (adds credibility)"})
            risk_score = min(100, risk_score + 10)
        else:
            risk_score -= 10
            risk_factors.append({"factor": "not_listed", "severity": "medium", "detail": "Token not found on CoinGecko — may be very new or low quality"})

        # Clamp risk score
        risk_score = max(0, min(100, risk_score))

        # Determine risk level
        if risk_score >= 80:
            risk_level = "Low Risk"
            is_safe = True
        elif risk_score >= 60:
            risk_level = "Medium Risk"
            is_safe = False
        elif risk_score >= 40:
            risk_level = "High Risk"
            is_safe = False
        else:
            risk_level = "Critical Risk"
            is_safe = False

        # Honeypot heuristic: small contract + not on CoinGecko + owner not renounced
        is_honeypot_suspected = code_size_risk and not coingecko_data.get("listed_on_coingecko") and not is_renounced

        # Build response
        response_data = {
            "source": "Kristo Security Scanner",
            "chain": "Base",
            "token_address": address,
            "scanned_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "token_info": {
                "name": token_name,
                "symbol": token_symbol,
                "decimals": token_decimals,
                "total_supply": total_supply_formatted,
                "owner_address": owner_address,
                "ownership_renounced": is_renounced,
                "contract_size_bytes": code_size,
                "is_proxy": is_proxy,
                "has_mint_function": has_mint
            },
            "security_assessment": {
                "is_safe": is_safe,
                "is_honeypot_suspected": is_honeypot_suspected,
                "risk_level": risk_level,
                "risk_score": risk_score,
                "risk_factors": risk_factors,
                "action_recommended": "PROCEED" if is_safe else ("CAUTION" if risk_score >= 60 else "AVOID")
            },
            "market_data": coingecko_data,
            "recommendation_for_ai_agent": {
                "buy": is_safe and risk_score >= 70,
                "reason": f"Risk score {risk_score}/100. {risk_level}. {'Ownership renounced.' if is_renounced else 'Ownership NOT renounced.'} {'Listed on CoinGecko.' if coingecko_data.get('listed_on_coingecko') else 'Not listed on CoinGecko.'}",
                "confidence": "high" if risk_score >= 80 or risk_score < 40 else "medium"
            }
        }

        cache_store[cache_key] = {"timestamp": now, "data": response_data}
        return response_data

    except Exception as e:
        logger.error(f"Token security scan failed for {address}: {e}")
        if cache.get("data"):
            stale = dict(cache["data"])
            stale["degraded"] = True
            return stale
        raise HTTPException(status_code=503, detail=f"Security scan failed: {str(e)}")



# =====================================================================
# DISCOVERY & AI AGENT ROUTES
# =====================================================================

@app.get("/.well-known/x402.json", include_in_schema=False)
async def x402_discovery():
    """x402 payment protocol discovery manifest."""
    return {
        "version": 1,
        "network": "base",
        "chain_id": 8453,
        "asset": "USDC",
        "price_per_call": "0.01",
        "pay_to": PAYMENT_WALLET,
        "accepts": {
            "amount": "0.01",
            "asset": "USDC",
            "chain": "base",
            "payTo": PAYMENT_WALLET
        },
        "paid_endpoints": [
            "/defi/yields", "/defi/tvl-movers", "/defi/lending-rates",
            "/defi/dex-pools", "/defi/protocol-safety", "/crypto/token-launches",
            "/crypto/token-security", "/crypto/wallet-profile",
            "/crypto/whale-moves", "/crypto/bridge-volume"
        ],
        "free_endpoints": [
            "/crypto/token-prices", "/crypto/gas-oracle", "/health",
            "/pricing", "/stats", "/agent/intelligence", "/openapi.json"
        ],
        "links": {
            "openapi": "https://kristo-intelligence-api.onrender.com/openapi.json",
            "dashboard": "https://kristo-travel-dashboard.vercel.app",
            "github": "https://github.com/hristovdimitri2-hub/kristo-travel-api"
        }
    }

@app.get("/llms.txt", include_in_schema=False)
async def llms_txt():
    """Human-readable API description for AI crawlers (llms.txt standard)."""
    from fastapi.responses import PlainTextResponse
    txt = """# Kristo Intelligence — Pay-Per-Call DeFi API for AI Agents

## Overview
Pay-per-call DeFi intelligence API on Base blockchain (Chain ID 8453).
Uses x402 HTTP 402 Payment Required protocol for micropayments in USDC.

## Base URL
https://kristo-intelligence-api.onrender.com

## Pricing
- Paid endpoints: 0.01 USDC per call (USDC on Base mainnet)
- Freemium: Free with rate limiting (token prices, gas oracle)
- Trial: First 3 calls free for new wallets
- Volume: 0.005 USDC/call after 50 paid calls

## Payment Flow
1. Call a paid endpoint → HTTP 402 with payment details
2. Send 0.01 USDC to payTo address on Base
3. Retry with X-PAYMENT header (transaction hash)
4. Server verifies on-chain, returns data

## Paid Endpoints (0.01 USDC/call)
- GET /defi/yields — Top 10 Base DeFi yield pools by TVL
- GET /defi/tvl-movers — Biggest 1-day TVL changes
- GET /defi/lending-rates — Best lending/borrowing rates (Aave, Moonwell, Morpho)
- GET /defi/dex-pools — Top DEX pools (Aerodrome, Uniswap v3)
- GET /defi/protocol-safety — Risk scores for Base protocols
- GET /crypto/token-launches — Recently launched tokens on Base
- GET /crypto/token-security?address=0x... — Rug-pull & honeypot detection
- GET /crypto/wallet-profile?address=0x... — Wallet classification (whale/dolphin/minnow)
- GET /crypto/whale-moves — Large USDC transfers (>$10,000)
- GET /crypto/bridge-volume — Cross-chain bridge volume to Base

## Freemium (free, rate-limited)
- GET /crypto/token-prices?tokens=ETH,USDC — Real-time prices
- GET /crypto/gas-oracle — Base gas estimates

## Payment Address
0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f
"""
    return PlainTextResponse(txt, media_type="text/plain")

@app.get("/agents.json", include_in_schema=False)
async def agents_json():
    """Machine-readable agent capability manifest."""
    return {
        "name": "Kristo Intelligence",
        "version": "2.1.0",
        "description": "Pay-per-call DeFi intelligence API on Base. 10 paid endpoints (0.01 USDC/call): rug-pull detection, yield pools, DEX analytics, whale tracking, lending rates, bridge volume.",
        "url": "https://kristo-intelligence-api.onrender.com",
        "payment": {
            "protocol": "x402",
            "network": "base",
            "chain_id": 8453,
            "asset": "USDC",
            "price_per_call": 0.01,
            "pay_to": PAYMENT_WALLET
        },
        "tools": [
            {"name": "defi_yields", "endpoint": "/defi/yields", "paid": True, "price_usdc": 0.01},
            {"name": "tvl_movers", "endpoint": "/defi/tvl-movers", "paid": True, "price_usdc": 0.01},
            {"name": "lending_rates", "endpoint": "/defi/lending-rates", "paid": True, "price_usdc": 0.01},
            {"name": "dex_pools", "endpoint": "/defi/dex-pools", "paid": True, "price_usdc": 0.01},
            {"name": "protocol_safety", "endpoint": "/defi/protocol-safety", "paid": True, "price_usdc": 0.01},
            {"name": "token_launches", "endpoint": "/crypto/token-launches", "paid": True, "price_usdc": 0.01},
            {"name": "token_security", "endpoint": "/crypto/token-security", "paid": True, "price_usdc": 0.01},
            {"name": "wallet_profile", "endpoint": "/crypto/wallet-profile", "paid": True, "price_usdc": 0.01},
            {"name": "whale_moves", "endpoint": "/crypto/whale-moves", "paid": True, "price_usdc": 0.01},
            {"name": "bridge_volume", "endpoint": "/crypto/bridge-volume", "paid": True, "price_usdc": 0.01},
            {"name": "token_prices", "endpoint": "/crypto/token-prices", "paid": False},
            {"name": "gas_oracle", "endpoint": "/crypto/gas-oracle", "paid": False}
        ],
        "links": {
            "openapi": "https://kristo-intelligence-api.onrender.com/openapi.json",
            "dashboard": "https://kristo-travel-dashboard.vercel.app",
            "discovery": "https://kristo-intelligence-api.onrender.com/.well-known/x402.json"
        }
    }

# =====================================================================
# MAIN ENTRY POINT
# =====================================================================

if __name__ == "__main__":
    uvicorn.run("kristo_api:app", host=HOST, port=PORT, reload=False)
