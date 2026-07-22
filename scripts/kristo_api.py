"""
KRISTO TRAVEL INTELLIGENCE API
Самостоятелен файл (All-in-One) за x402 Pay-per-call API
Текущ етап: Локален тест (MVP) - симулация на плащане чрез хедър.
Инструкции за AI агента/разработчика:
1. Увери се, че Python 3.10+ е инсталиран.
2. Инсталирай нужните пакети: pip install fastapi uvicorn
3. Смени променливата WALLET_ADDRESS с реален/тестов адрес от Base мрежата.
4. Стартирай програмата: python kristo_api.py
5. Сървърът ще слуша на http://0.0.0.0:8000
"""

from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import JSONResponse
import uvicorn
import json

# ==========================================
# 1. КОНФИГУРАЦИЯ (Промени тук)
# ==========================================
WALLET_ADDRESS = "0xYourBaseWalletAddressHere" # СЛОЖИ ТВОЯ АДРЕС ТУК!
PRICE_USDC = "0.25"
NETWORK = "base"
ASSET = "USDC"

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
# 3. API СЪРВЪР И ЛОГИКА
# ==========================================
app = FastAPI(
    title="Kristo Travel Intelligence",
    description="Global pay-per-call API for AI agents. Powered by x402.",
    version="1.0"
)

@app.get("/")
async def root():
    """Меню за роботите (OpenAPI/Metadata)"""
    return {
        "service": "Kristo Travel Intelligence",
        "model": "pay-per-call (x402)",
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
    """Безплатен endpoint за проверка дали машината работи."""
    return {"status": "online"}

@app.get("/travel/weekend-getaway")
async def get_weekend_getaway(x_payment: str = Header(None, alias="X-PAYMENT")):
    """
    ПЛАТЕН ENDPOINT.
    Логика:
    1. Ако няма X-PAYMENT хедър -> Връщаме 402 Payment Required с инструкции за плащане.
    2. Ако има X-PAYMENT хедър -> В реална среда проверяваме блокчейна. Тук приемаме, че е платено.
    """
    
    if not x_payment:
        # Роботът не е платил. Връщаме x402 инструкциите.
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
    
    # Роботът е платил (има хедър). Връщаме данните.
    # (Тук по-късно ще добавим web3 проверка на транзакцията)
    print(f"[УСПЕХ] Получено плащане от агент! Proof: {x_payment}")
    return TRAVEL_CONTEXT

# ==========================================
# 4. СТАРТИРАНЕ НА ПРОГРАМАТА
# ==========================================
if __name__ == "__main__":
    print("=" * 50)
    print(" KRISTO TRAVEL INTELLIGENCE API ")
    print("=" * 50)
    print(f" * Портфейл: {WALLET_ADDRESS}")
    print(f" * Цена на заявка: {PRICE_USDC} {ASSET} ({NETWORK})")
    print(f" * Сървърът стартира на http://0.0.0.0:8000")
    print("=" * 50)
    print("Чакам AI агенти да се свържат...")
    
    # Стартираме сървъра
    uvicorn.run(app, host="0.0.0.0", port=8000)