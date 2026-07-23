"""
KRISTO TRAVEL INTELLIGENCE API
x402 Pay-per-call API с реална Web3 валидация на плащания.

Етап: Production-Ready
Инструкции:
1. Инсталирай зависимости: pip install -r requirements.txt
2. Смени WALLET_ADDRESS с реален адрес от Base мрежата
3. (Опционално) Задай BASE_RPC_URL на собствен RPC провайдер
4. Стартирай: python kristo_api.py
5. Сървърът слуша на http://0.0.0.0:8000
"""

import os
import time
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import httpx
from web3 import Web3
from eth_utils import to_checksum_address

# ==========================================
# 1. КОНФИГУРАЦИЯ (Промени тук или чрез env vars)
# ==========================================
WALLET_ADDRESS = os.getenv(
    "WALLET_ADDRESS",
    "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"
)
PRICE_USDC = os.getenv("PRICE_USDC", "0.25")
NETWORK = "base"
ASSET = "USDC"

# Base Mainnet конфигурация
BASE_RPC_URL = os.getenv(
    "BASE_RPC_URL",
    "https://mainnet.base.org"
)

# USDC контракт на Base Mainnet
USDC_CONTRACT_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# USDC ERC-20 ABI (само нужните функции)
USDC_ABI = [
    {
        "constant": True,
        "inputs": [],
        "name": "decimals",
        "outputs": [{"name": "", "type": "uint8"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [],
        "name": "symbol",
        "outputs": [{"name": "", "type": "string"}],
        "type": "function"
    },
    {
        "constant": True,
        "inputs": [
            {"name": "_owner", "type": "address"}
        ],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function"
    }
]

# Transfer event signature за USDC
TRANSFER_EVENT_SIGNATURE = "Transfer(address,address,uint256)"
TRANSFER_TOPIC = Web3.keccak(text=TRANSFER_EVENT_SIGNATURE).hex()

# Вграден набор от използвани tx hashes (защита от replay)
# В production: използвай Redis или база данни
used_transactions: set = set()

# Web3 инициализация
w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))

# ==========================================
# 2. ПРОДУКТ: Travel Контекст (Данните, които продаваме)
# ==========================================
TRAVEL_CONTEXT = {
    "product": "Weekend Getaway Context",
    "top_locations": [
        {
            "city": "Rome",
            "country": "Italy",
            "avg_budget_usd": 450,
            "risk_level": "low",
            "insight": "Best visited in late Spring. Avoid August due to extreme heat and peak pricing."
        },
        {
            "city": "Barcelona",
            "country": "Spain",
            "avg_budget_usd": 400,
            "risk_level": "medium",
            "insight": "Pickpocket risk is high in tourist areas. Budget for efficient public transit."
        }
    ],
    "seasonality_context": "Current market scan indicates a surge in Mediterranean queries. Prices expected to spike 15% in July.",
    "decision_id": "wkg_20260723_001",
    "observed_at": "2026-07-23T12:00:00Z",
    "confidence_score": 0.95,
    "verify_url": "https://api.kristo-travel.com/verify/wkg_20260723_001"
}

# ==========================================
# 3. WEB3 ВАЛИДАЦИЯ
# ==========================================
async def verify_payment(tx_hash: str) -> dict:
    """
    Проверява дали транзакцията е валидно плащане.
    Връща dict с {"valid": bool, "error": str|None, "details": dict}
    """
    # Почистване на tx hash
    tx_hash_clean = tx_hash.strip()
    if tx_hash_clean.startswith("0x"):
        tx_hash_clean = tx_hash_clean[2:]
    if len(tx_hash_clean) != 64:
        return {"valid": False, "error": "Invalid transaction hash format.", "details": {}}
    
    tx_hash_full = f"0x{tx_hash_clean}"
    
    # Проверка 1: Replay защита
    if tx_hash_full in used_transactions:
        return {"valid": False, "error": "Transaction already used.", "details": {}}
    
    # Проверка 2: Зареждане на транзакцията от блокчейна
    try:
        loop = asyncio.get_event_loop()
        tx_receipt = await loop.run_in_executor(
            None, w3.eth.get_transaction_receipt, tx_hash_full
        )
    except Exception as e:
        return {"valid": False, "error": f"Transaction not found or not confirmed: {str(e)}", "details": {}}
    
    # Проверка 3: Транзакцията е успешна
    if tx_receipt["status"] != 1:
        return {"valid": False, "error": "Transaction failed (reverted).", "details": {}}
    
    # Проверка 4: Намери USDC Transfer event към нашия портфейл
    wallet_lower = WALLET_ADDRESS.lower()
    expected_amount_wei = int(float(PRICE_USDC) * 10**6)  # USDC има 6 decimals
    
    found_valid_transfer = False
    transfer_details = {}
    
    for log in tx_receipt.get("logs", []):
        # Проверяваме дали log-ът е от USDC контракта
        if log["address"].lower() != USDC_CONTRACT_ADDRESS.lower():
            continue
        
        # Проверяваме дали е Transfer event
        if len(log.get("topics", [])) < 3:
            continue
        if log["topics"][0].hex() != TRANSFER_TOPIC:
            continue
        
        # Декодираме адресите (премахваме padding zeros)
        from_address = "0x" + log["topics"][1].hex()[-40:]
        to_address = "0x" + log["topics"][2].hex()[-40:]
        amount = int(log["data"].hex(), 16)
        
        # Проверка: Получателят сме ние
        if to_address.lower() != wallet_lower:
            continue
        
        # Проверка: Сумата е точна
        if amount == expected_amount_wei:
            found_valid_transfer = True
            transfer_details = {
                "from": from_address,
                "to": to_address,
                "amount_raw": amount,
                "amount_usdc": amount / 10**6,
                "block": tx_receipt["blockNumber"],
                "tx_hash": tx_hash_full
            }
            break
    
    if not found_valid_transfer:
        return {
            "valid": False,
            "error": f"No valid USDC transfer of exactly {PRICE_USDC} USDC to wallet found.",
            "details": {}
        }
    
    # Всички проверки минаха
    return {
        "valid": True,
        "error": None,
        "details": transfer_details
    }

# ==========================================
# 4. API СЪРВЪР
# ==========================================
app = FastAPI(
    title="Kristo Travel Intelligence",
    description="Global pay-per-call API for AI agents. Powered by x402.",
    version="2.0"
)


@app.get("/")
async def root():
    """Меню за роботите (OpenAPI/Metadata)"""
    return {
        "service": "Kristo Travel Intelligence",
        "model": "pay-per-call (x402)",
        "version": "2.0",
        "web3_validation": "enabled",
        "endpoints": [
            {
                "path": "/travel/weekend-getaway",
                "method": "GET",
                "cost": f"{PRICE_USDC} {ASSET} on {NETWORK}",
                "description": "Returns structured JSON context for top weekend travel destinations, including budget, risk, and seasonality."
            }
        ]
    }


@app.get("/health")
async def health():
    """Безплатен endpoint за проверка на състоянието."""
    w3_connected = w3.is_connected()
    return {
        "status": "online",
        "web3_connected": w3_connected,
        "wallet": WALLET_ADDRESS,
        "network": NETWORK,
        "rpc": BASE_RPC_URL
    }


# In-memory sales log (production: use Redis/database)
sales_log: list = []


@app.get("/monitor/sales")
async def monitor_sales():
    """Проверка за нови USDC плащания към портфейла (последни 24 часа)."""
    try:
        # Query USDC Transfer events TO wallet in last ~7200 blocks
        wallet_padded = WALLET_ADDRESS.lower().replace("0x", "").zfill(64)
        
        current_block = w3.eth.block_number
        from_block = current_block - 7200  # ~24h at 12s/block
        
        logs = w3.eth.get_logs({
            'fromBlock': from_block,
            'toBlock': 'latest',
            'address': USDC_CONTRACT_ADDRESS,
            'topics': [
                TRANSFER_TOPIC,
                None,
                f"0x{wallet_padded}"
            ]
        })
        
        transfers = []
        for log in logs:
            from_addr = "0x" + log["topics"][1].hex()[-40:]
            amount = int(log["data"].hex(), 16) / 10**6
            transfers.append({
                "hash": log["transactionHash"].hex(),
                "from": from_addr,
                "value": f"{amount:.2f}",
                "block": log["blockNumber"]
            })
        
        total_usdc = sum(float(t["value"]) for t in transfers)
        
        return {
            "sales_24h": len(transfers),
            "total_usdc": f"{total_usdc:.2f}",
            "transactions": transfers,
            "wallet": WALLET_ADDRESS,
            "checked_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"error": f"Blockchain query failed: {str(e)}"}
        )


@app.get("/travel/weekend-getaway")
async def get_weekend_getaway(x_payment: str = Header(None, alias="X-PAYMENT")):
    """
    ПЛАТЕН ENDPOINT с Web3 валидация.
    1. Ако няма X-PAYMENT хедър -> 402 с x402 инструкции.
    2. Ако има X-PAYMENT (tx hash) -> Проверяваме на блокчейна.
    """
    if not x_payment:
        return JSONResponse(
            status_code=402,
            content={
                "x402_version": 1,
                "accepts": {
                    "scheme": "exact",
                    "network": NETWORK,
                    "asset": ASSET,
                    "amount": PRICE_USDC,
                    "payTo": WALLET_ADDRESS,
                    "description": "Access to Weekend Getaway Travel Context"
                },
                "error": "Payment required. Transfer exactly 0.25 USDC to the provided address on Base network."
            }
        )
    
    # Web3 валидация на транзакцията
    result = await verify_payment(x_payment)
    
    if not result["valid"]:
        print(f"[ОТХВЪРЛЕНО] Невалидно плащане: {result['error']} | TX: {x_payment}")
        return JSONResponse(
            status_code=402,
            content={
                "x402_version": 1,
                "accepts": {
                    "scheme": "exact",
                    "network": NETWORK,
                    "asset": ASSET,
                    "amount": PRICE_USDC,
                    "payTo": WALLET_ADDRESS,
                    "description": "Access to Weekend Getaway Travel Context"
                },
                "error": f"Payment verification failed: {result['error']}",
                "invalid_tx": x_payment
            }
        )
    
    # Успешна валидация — маркираме транзакцията като използвана
    used_transactions.add(result["details"]["tx_hash"])
    
    print(f"[УСПЕХ] Плащане потвърдено! TX: {result['details']['tx_hash']}")
    print(f"         От: {result['details']['from']} | Сума: {result['details']['amount_usdc']} USDC")
    
    return TRAVEL_CONTEXT


# ==========================================
# 5. СТАРТИРАНЕ
# ==========================================
if __name__ == "__main__":
    print("=" * 55)
    print(" KRISTO TRAVEL INTELLIGENCE API v2.0 ")
    print(" Web3 Validation: ENABLED ")
    print("=" * 55)
    print(f" * Портфейл:    {WALLET_ADDRESS}")
    print(f" * Цена:        {PRICE_USDC} {ASSET} ({NETWORK})")
    print(f" * USDC Token:  {USDC_CONTRACT_ADDRESS}")
    print(f" * RPC:         {BASE_RPC_URL}")
    print(f" * Web3 OK:     {w3.is_connected()}")
    print(f" * Сървър:      http://0.0.0.0:8000")
    print("=" * 55)
    print("Чакам AI агенти да се свържат...")
    
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
