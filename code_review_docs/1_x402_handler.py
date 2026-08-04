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
PRICE_USDC = float(os.getenv("PRICE_USDC", "0.10"))
# FIX (2026-08-04): PRICE_RAW used to be an independent env var that defaulted to
# 10000 (=0.01 USDC) while PRICE_USDC defaulted to 0.10 USDC — a mismatch that let
# agents pay 10x less than advertised and verify successfully. PRICE_RAW is now ALWAYS
# derived from PRICE_USDC so the advertised price and the on-chain check can never diverge.
PRICE_RAW = int(round(PRICE_USDC * 1_000_000))  # USDC has 6 decimals
CHAIN_ID = int(os.getenv("CHAIN_ID", "8453"))
DB_PATH = os.getenv("DB_PATH", "kristo.db")
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))
RATE_LIMIT = os.getenv("RATE_LIMIT", "30/minute")
TRIAL_FREE_CALLS = int(os.getenv("TRIAL_FREE_CALLS", "10"))
VOLUME_DISCOUNT_THRESHOLD = int(os.getenv("VOLUME_DISCOUNT_THRESHOLD", "50"))
VOLUME_DISCOUNT_PRICE = float(os.getenv("VOLUME_DISCOUNT_PRICE", "0.05"))  # FIX (2026-08-04): was 0.15, higher than base price — illogical
REFERRAL_BONUS_PERCENT = float(os.getenv("REFERRAL_BONUS_PERCENT", "0.20"))

# Freemium endpoints (free with rate limiting)
FREEMIUM_ENDPOINTS = {"/crypto/token-prices", "/crypto/gas-oracle"}

TRANSFER_TOPIC_B4EF = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b4ef"
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


# ... (виж пълния verify_payment() в Документ 2) ...
