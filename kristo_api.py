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
PRICE_USDC = float(os.getenv("PRICE_USDC", "0.25"))
PRICE_RAW = int(os.getenv("PRICE_RAW", "250000"))
CHAIN_ID = int(os.getenv("CHAIN_ID", "8453"))
DB_PATH = os.getenv("DB_PATH", "kristo.db")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
RATE_LIMIT = os.getenv("RATE_LIMIT", "30/minute")

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

# x402 Payment Verification Dependency
async def verify_payment(request: Request) -> dict:
    payment_header = request.headers.get("X-PAYMENT") or request.headers.get("x-payment")
    
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
            "description": f"Payment required for Kristo Intelligence API endpoint: {request.url.path}"
        },
        "error": "Payment required. Send USDC on Base to the payTo address, then retry with X-PAYMENT header containing the tx hash."
    }

    if not payment_header:
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
        "paid_endpoints": [
            {
                "path": "/defi/yields",
                "method": "GET",
                "price_usdc": PRICE_USDC,
                "description": "Top 10 Base-chain DeFi yield pools by TVL from DefiLlama"
            },
            {
                "path": "/defi/tvl-movers",
                "method": "GET",
                "price_usdc": PRICE_USDC,
                "description": "Base DeFi protocols with biggest 1-day TVL changes"
            },
            {
                "path": "/crypto/token-prices",
                "method": "GET",
                "price_usdc": PRICE_USDC,
                "description": "Real-time token prices for Base tokens from CoinGecko"
            },
            {
                "path": "/crypto/wallet-profile",
                "method": "GET",
                "price_usdc": PRICE_USDC,
                "description": "On-chain wallet activity, token balances, and classification profile"
            },
            {
                "path": "/crypto/whale-moves",
                "method": "GET",
                "price_usdc": PRICE_USDC,
                "description": "Large USDC transfers on Base blockchain"
            },
            {
                "path": "/crypto/gas-oracle",
                "method": "GET",
                "price_usdc": PRICE_USDC,
                "description": "Current Base gas price, operation cost estimates, and gas level recommendations"
            }
        ]
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
                           "Each paid endpoint requires payment of 0.25 USDC sent to 0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f via X-PAYMENT header.",
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
                    "description": "Requires 0.25 USDC via x402. Returns top 10 Base-chain yield pools from DefiLlama.",
                    "responses": {
                        "200": {"description": "Top 10 yield pools"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/defi/tvl-movers": {
                "get": {
                    "summary": "Base TVL Movers (Paid)",
                    "description": "Requires 0.25 USDC via x402. Returns top 15 Base DeFi protocols by 1-day TVL change.",
                    "responses": {
                        "200": {"description": "Top 15 TVL movers"},
                        "402": {"description": "Payment Required (x402)"}
                    }
                }
            },
            "/crypto/token-prices": {
                "get": {
                    "summary": "Token Prices (Paid)",
                    "description": "Requires 0.25 USDC via x402. Returns real-time token prices from CoinGecko for specified Base tokens.",
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
                    "description": "Requires 0.25 USDC via x402. Returns on-chain balances, transaction count, recent USDC activity, and tier classification.",
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
                    "description": "Requires 0.25 USDC via x402. Returns large USDC transfers on Base scanned from the last 500 blocks.",
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
                    "description": "Requires 0.25 USDC via x402. Returns current Base gas price, cost estimates for ETH/USDC transfers, swaps, contract calls, and gas recommendation.",
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
        if cache is not None and cache.get("data") is not None:
            logger.info(f"Serving stale cache for /crypto/token-prices ({cache_key})")
            stale_data = dict(cache["data"])
            stale_data["degraded"] = True
            stale_data["note"] = "Serving stale cache due to CoinGecko API error"
            return stale_data
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Unable to fetch token prices from CoinGecko: {str(e)}"
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
# MAIN ENTRY POINT
# =====================================================================

if __name__ == "__main__":
    uvicorn.run("kristo_api:app", host=HOST, port=PORT, reload=False)
