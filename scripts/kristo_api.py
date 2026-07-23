"""
KRISTO INTELLIGENCE API v3.0
x402 Pay-per-call — 6 sellable endpoints for AI agents.
Travel + Crypto data with real on-chain queries.

Етап: Production
"""

import os
import json
import asyncio
from datetime import datetime, timezone
from fastapi import FastAPI, Header, Query
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from web3 import Web3

# ==========================================
# 1. CONFIG
# ==========================================
WALLET_ADDRESS = os.getenv("WALLET_ADDRESS", "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f")
PRICE_USDC = os.getenv("PRICE_USDC", "0.25")
NETWORK = "base"
ASSET = "USDC"
BASE_RPC_URL = os.getenv("BASE_RPC_URL", "https://mainnet.base.org")
USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
WETH_CONTRACT = "0x4200000000000000000000000000000000000006"
TRANSFER_TOPIC = Web3.keccak(text="Transfer(address,address,uint256)").hex()

used_transactions: set = set()
w3 = Web3(Web3.HTTPProvider(BASE_RPC_URL))
sales_log: list = []

# ==========================================
# 2. PRODUCT DATA
# ==========================================
DESTINATIONS = {
    "rome": {
        "city": "Rome", "country": "Italy", "lat": 41.9028, "lon": 12.4964,
        "avg_budget_usd": 480, "budget_breakdown": {"hotel": 180, "food": 95, "transport": 55, "attractions": 90, "misc": 60},
        "risk_score": 22, "risk_factors": ["pickpocketing near tourist sites", "scams at Colosseum area"],
        "best_months": [4, 5, 9, 10], "worst_months": [7, 8],
        "hotel_avg_per_night": {"budget": 65, "mid": 140, "luxury": 320},
        "safety_index": 72, "healthcare_quality": 85, "internet_speed_mbps": 45,
        "visa_free_nationalities": 163, "airport_code": "FCO",
        "insider_tips": [
            "Trastevere restaurants are 30-40% cheaper than Centro Storico for equivalent quality",
            "Roma Pass 72h saves ~45 EUR on transport + 2 free museum entries",
            "Book Vatican tickets online 2 weeks ahead — skip-the-line saves 2-3 hours",
            "Apartment rentals in Monti area offer best value/location ratio"
        ]
    },
    "barcelona": {
        "city": "Barcelona", "country": "Spain", "lat": 41.3874, "lon": 2.1686,
        "avg_budget_usd": 420, "budget_breakdown": {"hotel": 150, "food": 80, "transport": 40, "attractions": 85, "misc": 65},
        "risk_score": 45, "risk_factors": ["high pickpocket risk on La Rambla", "tourist tax scams", "unlicensed street vendors"],
        "best_months": [5, 6, 9, 10], "worst_months": [7, 8],
        "hotel_avg_per_night": {"budget": 55, "mid": 120, "luxury": 280},
        "safety_index": 60, "healthcare_quality": 88, "internet_speed_mbps": 52,
        "visa_free_nationalities": 165, "airport_code": "BCN",
        "insider_tips": [
            "Gracia district has authentic tapas at 40% less than Gothic Quarter",
            "T-Casual 10-trip card is cheaper than single metro tickets after 5 rides",
            "Book Sagrada Familia for 9am slot — least crowded and best light for photos",
            "Beach restaurants in Barceloneta overcharge 50-80% — walk 3 blocks inland"
        ]
    },
    "bangkok": {
        "city": "Bangkok", "country": "Thailand", "lat": 13.7563, "lon": 100.5018,
        "avg_budget_usd": 280, "budget_breakdown": {"hotel": 45, "food": 55, "transport": 25, "attractions": 65, "misc": 90},
        "risk_score": 38, "risk_factors": ["tuktuk scams", "gem scams", "jet ski damage extortion in Pattaya"],
        "best_months": [11, 12, 1, 2], "worst_months": [4, 5, 9, 10],
        "hotel_avg_per_night": {"budget": 15, "mid": 50, "luxury": 150},
        "safety_index": 58, "healthcare_quality": 72, "internet_speed_mbps": 65,
        "visa_free_nationalities": 98, "airport_code": "BKK",
        "insider_tips": [
            "Street food on Yaowarat (Chinatown) is 70% cheaper and often better than restaurant food",
            "BTS Skytrain day pass unlimited rides for 140 THB — covers all major tourist areas",
            "Grand Palace: go at 8:30am opening, done by 11am before heat and crowds",
            " Sukhumvit 20-30 soi area has best boutique hotel value with BTS access"
        ]
    },
    "dubai": {
        "city": "Dubai", "country": "UAE", "lat": 25.2048, "lon": 55.2708,
        "avg_budget_usd": 650, "budget_breakdown": {"hotel": 200, "food": 110, "transport": 65, "attractions": 120, "misc": 155},
        "risk_score": 15, "risk_factors": ["high temperatures Jun-Sep", "tourist price inflation"],
        "best_months": [11, 12, 1, 2, 3], "worst_months": [6, 7, 8],
        "hotel_avg_per_night": {"budget": 80, "mid": 200, "luxury": 500},
        "safety_index": 90, "healthcare_quality": 82, "internet_speed_mbps": 78,
        "visa_free_nationalities": 112, "airport_code": "DXB",
        "insider_tips": [
            "Deira and Bur Dubai have authentic souks at real prices — skip mall souks",
            "Nol card for metro is essential — taxis cost 5-8x more for same distance",
            "Friday brunch deals at 5-star hotels offer luxury dining at 60% off a la carte",
            "Al Seef district heritage area is free and uncrowded vs paid attractions"
        ]
    },
    "tokyo": {
        "city": "Tokyo", "country": "Japan", "lat": 35.6762, "lon": 139.6503,
        "avg_budget_usd": 520, "budget_breakdown": {"hotel": 160, "food": 100, "transport": 60, "attractions": 80, "misc": 120},
        "risk_score": 8, "risk_factors": ["language barrier", "earthquake risk"],
        "best_months": [3, 4, 10, 11], "worst_months": [6, 7, 8],
        "hotel_avg_per_night": {"budget": 50, "mid": 130, "luxury": 350},
        "safety_index": 95, "healthcare_quality": 92, "internet_speed_mbps": 85,
        "visa_free_nationalities": 71, "airport_code": "NRT",
        "insider_tips": [
            "7-Eleven and Lawson ATMs have zero-fee international withdrawals via 7-Bank",
            "Japan Rail Pass 7-day covers Shinkansen — saves 200+ USD on Tokyo-Osaka-Kyoto round trip",
            "Lunch sets (teishoku) at 800-1200 JPY offer same restaurant quality as 3000+ JPY dinner",
            "Stay in Asakusa or Ueno for 40% cheaper hotels with direct metro to all areas"
        ]
    },
    "lisbon": {
        "city": "Lisbon", "country": "Portugal", "lat": 38.7223, "lon": -9.1393,
        "avg_budget_usd": 350, "budget_breakdown": {"hotel": 100, "food": 65, "transport": 35, "attractions": 55, "misc": 95},
        "risk_score": 30, "risk_factors": ["pickpocketing on Tram 28", "hill navigation difficulty"],
        "best_months": [4, 5, 9, 10], "worst_months": [7, 8],
        "hotel_avg_per_night": {"budget": 40, "mid": 90, "luxury": 220},
        "safety_index": 75, "healthcare_quality": 80, "internet_speed_mbps": 55,
        "visa_free_nationalities": 186, "airport_code": "LIS",
        "insider_tips": [
            "Alfama and Mouraria neighborhoods have cheapest authentic restaurants — 50% less than Baixa",
            "Lisboa Card covers 30+ attractions + transport — pays off after 3 visits",
            "Take Uber/Bolt to Belem — tram is 3x slower and same price",
            "Rentals in Arroios or Intendente are emerging areas with 30% lower prices than central"
        ]
    },
    "istanbul": {
        "city": "Istanbul", "country": "Turkey", "lat": 41.0082, "lon": 28.9784,
        "avg_budget_usd": 300, "budget_breakdown": {"hotel": 60, "food": 50, "transport": 20, "attractions": 45, "misc": 125},
        "risk_score": 35, "risk_factors": ["taxi overcharging", "carpet shop scams", "crowds at major sites"],
        "best_months": [4, 5, 9, 10, 11], "worst_months": [7, 8],
        "hotel_avg_per_night": {"budget": 25, "mid": 70, "luxury": 200},
        "safety_index": 62, "healthcare_quality": 70, "internet_speed_mbps": 48,
        "visa_free_nationalities": 78, "airport_code": "IST",
        "insider_tips": [
            "Istanbulkart transit card works for metro, tram, bus, ferry — single ride 15 TL vs 50 TL taxi",
            "Kadikoy market on Asian side has fresh food at 60% less than European side tourist restaurants",
            "Museum Pass Istanbul covers 12 museums — saves ~1200 TL vs individual tickets",
            "Hotels in Beyoglu/Taksim area offer best transport connectivity for sightseeing"
        ]
    },
    "mexico-city": {
        "city": "Mexico City", "country": "Mexico", "lat": 19.4326, "lon": -99.1332,
        "avg_budget_usd": 250, "budget_breakdown": {"hotel": 50, "food": 45, "transport": 20, "attractions": 40, "misc": 95},
        "risk_score": 42, "risk_factors": ["altitude sickness", "taxi safety in some areas", "pickpocketing in metro"],
        "best_months": [3, 4, 10, 11], "worst_months": [7, 8, 9],
        "hotel_avg_per_night": {"budget": 20, "mid": 60, "luxury": 180},
        "safety_index": 52, "healthcare_quality": 65, "internet_speed_mbps": 38,
        "visa_free_nationalities": 120, "airport_code": "MEX",
        "insider_tips": [
            "Street tacos at 15-25 MXN (~1 USD) are the best food value in any major world city",
            "Metrobus smart card costs 5 MXN per ride — covers most tourist areas",
            "Uber is safer and cheaper than street taxis — always use it especially at night",
            "Roma Norte and Condesa neighborhoods are safest for tourists with great food scene"
        ]
    },
    "bali": {
        "city": "Bali", "country": "Indonesia", "lat": -8.3405, "lon": 115.0920,
        "avg_budget_usd": 200, "budget_breakdown": {"hotel": 35, "food": 35, "transport": 25, "attractions": 30, "misc": 75},
        "risk_score": 33, "risk_factors": ["motorbike accident risk", "monkey temple scams", "water safety concerns"],
        "best_months": [4, 5, 6, 9, 10], "worst_months": [1, 2, 12],
        "hotel_avg_per_night": {"budget": 12, "mid": 45, "luxury": 150},
        "safety_index": 64, "healthcare_quality": 55, "internet_speed_mbps": 22,
        "visa_free_nationalities": 82, "airport_code": "DPS",
        "insider_tips": [
            "Ubud rice terrace area has 50% cheaper accommodation vs Seminyak with better nature access",
            "Gojek/Grab apps for transport are 70% cheaper than taxis and safer negotiated price",
            "Warungs (local eateries) serve full meals for 20-40k IDR vs 150k+ at tourist restaurants",
            "Canggu for digital nomads, Ubud for wellness, Uluwatu for surfing — pick one base not all three"
        ]
    },
    "prague": {
        "city": "Prague", "country": "Czech Republic", "lat": 50.0755, "lon": 14.4378,
        "avg_budget_usd": 320, "budget_breakdown": {"hotel": 90, "food": 55, "transport": 30, "attractions": 60, "misc": 85},
        "risk_score": 18, "risk_factors": ["currency exchange scams", "overpriced tourist restaurants on Old Town Square"],
        "best_months": [4, 5, 9, 10], "worst_months": [7, 8],
        "hotel_avg_per_night": {"budget": 35, "mid": 85, "luxury": 200},
        "safety_index": 82, "healthcare_quality": 78, "internet_speed_mbps": 58,
        "visa_free_nationalities": 188, "airport_code": "PRG",
        "insider_tips": [
            "Trdelnik (chimney cake) on Old Town Square is 3x more expensive — buy from local bakeries",
            "Prague Card covers 70+ attractions, transport, and tours — breakeven at 4-5 sites",
            "Zizkov and Vinohrady neighborhoods have authentic Czech pubs at 40% less than tourist center",
            "Walk across Charles Bridge at 6am for empty photos — by 9am it is packed with tourists"
        ]
    }
}

FLIGHT_INTEL = {
    "europe_to_asia": {
        "avg_price_range_usd": {"economy": [480, 1200], "premium_economy": [1200, 2500], "business": [3000, 8000]},
        "best_booking_window_days": [45, 75],
        "cheapest_days": ["Tuesday", "Wednesday"],
        "expensive_days": ["Friday", "Sunday"],
        "price_drop_months": ["January", "February", "September", "October"],
        "price_spike_months": ["June", "July", "December"],
        "top_routes": [
            {"from": "London", "to": "Bangkok", "avg_price": 620, "best_airline": "Qatar Airways", "layover_city": "Doha"},
            {"from": "London", "to": "Tokyo", "avg_price": 750, "best_airline": "Finnair", "layover_city": "Helsinki"},
            {"from": "Frankfurt", "to": "Bangkok", "avg_price": 580, "best_airline": "Emirates", "layover_city": "Dubai"},
            {"from": "Paris", "to": "Tokyo", "avg_price": 780, "best_airline": "ANA", "layover_city": "Tokyo"},
            {"from": "Istanbul", "to": "Tokyo", "avg_price": 650, "best_airline": "Turkish Airlines", "layover_city": "Istanbul"}
        ],
        "seasonal_patterns": {
            "Q1": {"demand": "low", "avg_discount_pct": 18, "tip": "Best time for Southeast Asia deals"},
            "Q2": {"demand": "medium", "avg_discount_pct": 8, "tip": "Book 60+ days ahead for summer travel"},
            "Q3": {"demand": "high", "avg_discount_pct": -12, "tip": "Prices peak — avoid if flexible"},
            "Q4": {"demand": "medium", "avg_discount_pct": 10, "tip": "October has shoulder season deals"}
        }
    },
    "europe_to_americas": {
        "avg_price_range_usd": {"economy": [350, 900], "premium_economy": [900, 2000], "business": [2500, 6000]},
        "best_booking_window_days": [30, 60],
        "cheapest_days": ["Tuesday", "Wednesday", "Thursday"],
        "expensive_days": ["Friday", "Saturday"],
        "price_drop_months": ["January", "February", "March"],
        "price_spike_months": ["July", "August", "December"],
        "top_routes": [
            {"from": "London", "to": "New York", "avg_price": 420, "best_airline": "Norse Atlantic", "layover_city": "direct"},
            {"from": "Paris", "to": "Mexico City", "avg_price": 580, "best_airline": "Air France", "layover_city": "Paris"},
            {"from": "Madrid", "to": "Bogota", "avg_price": 450, "best_airline": "Avianca", "layover_city": "direct"},
            {"from": "Frankfurt", "to": "Sao Paulo", "avg_price": 620, "best_airline": "Lufthansa", "layover_city": "Frankfurt"},
            {"from": "Lisbon", "to": "New York", "avg_price": 380, "best_airline": "TAP Portugal", "layover_city": "Lisbon"}
        ],
        "seasonal_patterns": {
            "Q1": {"demand": "low", "avg_discount_pct": 22, "tip": "Cheapest quarter for transatlantic flights"},
            "Q2": {"demand": "rising", "avg_discount_pct": 10, "tip": "May has good deals before summer surge"},
            "Q3": {"demand": "high", "avg_discount_pct": -15, "tip": "Summer peak — book 90 days ahead minimum"},
            "Q4": {"demand": "medium", "avg_discount_pct": 5, "tip": "November pre-holiday window has brief price dips"}
        }
    },
    "inter_europe": {
        "avg_price_range_usd": {"economy": [40, 250], "premium_economy": [150, 500], "business": [400, 1500]},
        "best_booking_window_days": [14, 45],
        "cheapest_days": ["Tuesday", "Wednesday"],
        "expensive_days": ["Friday", "Sunday", "Monday"],
        "price_drop_months": ["January", "February", "November"],
        "price_spike_months": ["August", "December"],
        "top_routes": [
            {"from": "London", "to": "Barcelona", "avg_price": 65, "best_airline": "Vueling", "layover_city": "direct"},
            {"from": "Berlin", "to": "Istanbul", "avg_price": 120, "best_airline": "Pegasus", "layover_city": "direct"},
            {"from": "Paris", "to": "Rome", "avg_price": 80, "best_airline": "Transavia", "layover_city": "direct"},
            {"from": "Prague", "to": "Lisbon", "avg_price": 95, "best_airline": "Ryanair", "layover_city": "direct"},
            {"from": "Sofia", "to": "Dubai", "avg_price": 280, "best_airline": "Wizz Air", "layover_city": "direct"}
        ],
        "seasonal_patterns": {
            "Q1": {"demand": "low", "avg_discount_pct": 25, "tip": "Best time for city hopping — flights under 50 EUR common"},
            "Q2": {"demand": "medium", "avg_discount_pct": 10, "tip": "May flights still reasonable before July surge"},
            "Q3": {"demand": "high", "avg_discount_pct": -20, "tip": "Peak summer — book early or fly early morning"},
            "Q4": {"demand": "medium", "avg_discount_pct": 15, "tip": "November is hidden gem month for European flights"}
        }
    }
}

# ==========================================
# 3. WEB3 VALIDATION
# ==========================================
async def verify_payment(tx_hash: str) -> dict:
    tx_hash_clean = tx_hash.strip()
    if tx_hash_clean.startswith("0x"):
        tx_hash_clean = tx_hash_clean[2:]
    if len(tx_hash_clean) != 64:
        return {"valid": False, "error": "Invalid transaction hash format.", "details": {}}
    tx_hash_full = f"0x{tx_hash_clean}"
    if tx_hash_full in used_transactions:
        return {"valid": False, "error": "Transaction already used.", "details": {}}
    try:
        loop = asyncio.get_event_loop()
        tx_receipt = await loop.run_in_executor(None, w3.eth.get_transaction_receipt, tx_hash_full)
    except Exception as e:
        return {"valid": False, "error": f"Transaction not found or not confirmed: {str(e)}", "details": {}}
    if tx_receipt["status"] != 1:
        return {"valid": False, "error": "Transaction failed (reverted).", "details": {}}
    wallet_lower = WALLET_ADDRESS.lower()
    expected_amount_wei = int(float(PRICE_USDC) * 10**6)
    found_valid_transfer = False
    transfer_details = {}
    for log in tx_receipt.get("logs", []):
        if log["address"].lower() != USDC_CONTRACT.lower():
            continue
        if len(log.get("topics", [])) < 3:
            continue
        if log["topics"][0].hex() != TRANSFER_TOPIC:
            continue
        from_address = "0x" + log["topics"][1].hex()[-40:]
        to_address = "0x" + log["topics"][2].hex()[-40:]
        amount = int(log["data"].hex(), 16)
        if to_address.lower() != wallet_lower:
            continue
        if amount == expected_amount_wei:
            found_valid_transfer = True
            transfer_details = {
                "from": from_address, "to": to_address,
                "amount_raw": amount, "amount_usdc": amount / 10**6,
                "block": tx_receipt["blockNumber"], "tx_hash": tx_hash_full
            }
            break
    if not found_valid_transfer:
        return {"valid": False, "error": f"No valid USDC transfer of exactly {PRICE_USDC} USDC found.", "details": {}}
    return {"valid": True, "error": None, "details": transfer_details}


def make_402(description: str) -> tuple:
    """Helper: return (content_dict, headers_dict) for 402 x402 response."""
    payload = {
        "x402_version": 1,
        "accepts": {
            "scheme": "exact", "network": NETWORK, "asset": ASSET,
            "amount": PRICE_USDC, "payTo": WALLET_ADDRESS,
            "description": description
        },
        "error": "Payment required. Send USDC on Base to the payTo address, then retry with X-PAYMENT header containing the tx hash."
    }
    return payload, {"X-PAYMENT-REQUIRED": json.dumps(payload)}


async def handle_paid_endpoint(endpoint_name: str, description: str, x_payment: str, data_fn):
    """Generic x402 handler: verify payment -> call data_fn -> return data."""
    if not x_payment:
        content, headers = make_402(description)
        return JSONResponse(status_code=402, content=content, headers=headers)
    result = await verify_payment(x_payment)
    if not result["valid"]:
        content, _ = make_402(description)
        content["error"] = f"Payment verification failed: {result['error']}"
        content["invalid_tx"] = x_payment
        return JSONResponse(status_code=402, content=content, headers={"X-PAYMENT-REQUIRED": json.dumps(content)})
    used_transactions.add(result["details"]["tx_hash"])
    sale_entry = {
        "tx_hash": result["details"]["tx_hash"],
        "from": result["details"]["from"],
        "amount": result["details"]["amount_usdc"],
        "block": result["details"]["block"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint_name
    }
    sales_log.append(sale_entry)
    print(f"[SALE] {endpoint_name} | TX: {result['details']['tx_hash'][:18]}... | From: {result['details']['from'][:12]}... | Total: {len(sales_log)}")
    return data_fn()


# ==========================================
# 4. API SERVER
# ==========================================
app = FastAPI(title="Kristo Intelligence", description="Pay-per-call API for AI agents. Travel + Crypto. Powered by x402.", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.get("/")
async def root():
    return {
        "service": "Kristo Intelligence", "model": "pay-per-call (x402)", "version": "3.0",
        "x402_compatible": True, "web3_validation": "enabled",
        "pricing": {"amount": PRICE_USDC, "asset": ASSET, "network": NETWORK, "chain_id": 8453, "recipient": WALLET_ADDRESS},
        "products": 6,
        "endpoints": [
            {"path": "/travel/destination-score", "method": "GET", "cost": f"{PRICE_USDC} {ASSET}", "description": "Comprehensive risk/reward/budget score for any of 10 major destinations with insider tips."},
            {"path": "/travel/flight-intel", "method": "GET", "cost": f"{PRICE_USDC} {ASSET}", "description": "Flight price patterns, best booking windows, top routes, seasonal discounts for 3 route categories."},
            {"path": "/travel/hotel-rates", "method": "GET", "cost": f"{PRICE_USDC} {ASSET}", "description": "Hotel rate intelligence: budget/mid/luxury tiers across 10 cities with neighborhood tips."},
            {"path": "/crypto/wallet-profile", "method": "GET", "cost": f"{PRICE_USDC} {ASSET}", "description": "Real-time on-chain wallet analysis: balances, activity score, token profile for any Base address."},
            {"path": "/crypto/whale-moves", "method": "GET", "cost": f"{PRICE_USDC} {ASSET}", "description": "Large USDC transfers on Base in the last 500 blocks. Real on-chain data."},
            {"path": "/crypto/gas-oracle", "method": "GET", "cost": f"{PRICE_USDC} {ASSET}", "description": "Current Base gas price, estimated costs for swaps, transfers, and smart contract calls."}
        ]
    }


@app.get("/health")
async def health():
    return {"status": "online", "web3_connected": w3.is_connected(), "wallet": WALLET_ADDRESS, "network": NETWORK, "rpc": BASE_RPC_URL, "block": w3.eth.block_number}


@app.get("/sales/recent")
async def sales_recent():
    return {"total_sales": len(sales_log), "recent": sales_log[-10:]}


# ---------- PAID: TRAVEL ----------

@app.get("/travel/destination-score")
async def travel_destination_score(city: str = Query(None), x_payment: str = Header(None, alias="X-PAYMENT")):
    desc = "Destination risk/reward/budget intelligence for 10 global cities"
    async def get_data():
        if city:
            key = city.lower().replace(" ", "-").replace("_", "-")
            key = key.replace("mexico-city", "mexico-city")  # already correct
            if key in DESTINATIONS:
                return {**DESTINATIONS[key], "queried_city": city, "total_cities_available": len(DESTINATIONS)}
            matches = [k for k, v in DESTINATIONS.items() if city.lower() in v["city"].lower() or city.lower() in v["country"].lower()]
            if matches:
                return {**DESTINATIONS[matches[0]], "queried_city": city, "matched": matches[0], "total_cities_available": len(DESTINATIONS)}
        return {"available_cities": list(DESTINATIONS.keys()), "total": len(DESTINATIONS), "note": "Pass ?city=Rome to get specific data"}
    return await handle_paid_endpoint("/travel/destination-score", desc, x_payment, get_data)


@app.get("/travel/flight-intel")
async def travel_flight_intel(region: str = Query(None), x_payment: str = Header(None, alias="X-PAYMENT")):
    desc = "Flight price patterns, booking windows, route data, seasonal discounts"
    async def get_data():
        if region:
            key = region.lower().replace(" ", "_")
            if key in FLIGHT_INTEL:
                return {**FLIGHT_INTEL[key], "queried_region": region, "available_regions": list(FLIGHT_INTEL.keys())}
        return {"available_regions": list(FLIGHT_INTEL.keys()), "regions": {k: {"routes": len(v["top_routes"]), "price_range": v["avg_price_range_usd"]} for k, v in FLIGHT_INTEL.items()}}
    return await handle_paid_endpoint("/travel/flight-intel", desc, x_payment, get_data)


@app.get("/travel/hotel-rates")
async def travel_hotel_rates(x_payment: str = Header(None, alias="X-PAYMENT")):
    desc = "Hotel rate intelligence across 10 cities with budget tiers and area tips"
    async def get_data():
        rates = {}
        for key, d in DESTINATIONS.items():
            rates[key] = {
                "city": d["city"], "country": d["country"],
                "per_night": d["hotel_avg_per_night"],
                "avg_total_budget_hotel_pct": round(d["budget_breakdown"]["hotel"] / d["avg_budget_usd"] * 100),
                "best_value_areas": d["insider_tips"][0] if d["insider_tips"] else None,
                "internet_mbps": d["internet_speed_mbps"]
            }
        cheapest = sorted(rates.values(), key=lambda x: x["per_night"]["budget"])[:3]
        most_expensive = sorted(rates.values(), key=lambda x: x["per_night"]["luxury"], reverse=True)[:3]
        return {"cities": rates, "cheapest_budget": cheapest, "most_expensive_luxury": most_expensive, "total_cities": len(rates), "generated_at": datetime.now(timezone.utc).isoformat()}
    return await handle_paid_endpoint("/travel/hotel-rates", desc, x_payment, get_data)


# ---------- PAID: CRYPTO ----------

@app.get("/crypto/wallet-profile")
async def crypto_wallet_profile(address: str = Query(...), x_payment: str = Header(None, alias="X-PAYMENT")):
    desc = "Real-time on-chain wallet analysis on Base network"
    async def get_data():
        loop = asyncio.get_event_loop()
        addr = Web3.to_checksum_address(address)
        # ETH balance
        eth_balance_wei = await loop.run_in_executor(None, w3.eth.get_balance, addr)
        eth_balance = float(w3.from_wei(eth_balance_wei, 'ether'))
        # USDC balance via eth_call
        balance_selector = '0x70a08231'
        addr_padded = address.lower().replace("0x", "").zfill(64)
        try:
            usdc_raw = await loop.run_in_executor(None, w3.eth.call, {'to': USDC_CONTRACT, 'data': balance_selector + addr_padded})
            usdc_balance = int(usdc_raw.hex(), 16) / 10**6
        except Exception:
            usdc_balance = 0.0
        # WETH balance
        try:
            weth_raw = await loop.run_in_executor(None, w3.eth.call, {'to': WETH_CONTRACT, 'data': balance_selector + addr_padded})
            weth_balance = float(w3.from_wei(int(weth_raw.hex(), 16), 'ether'))
        except Exception:
            weth_balance = 0.0
        # Recent USDC transfers (last 500 blocks)
        addr_topic = f"0x{address.lower().replace('0x','').zfill(64)}"
        try:
            current_block = w3.eth.block_number
            logs_out = await loop.run_in_executor(None, w3.eth.get_logs, {
                'fromBlock': current_block - 500, 'toBlock': 'latest',
                'address': USDC_CONTRACT, 'topics': [TRANSFER_TOPIC, addr_topic]
            })
            logs_in = await loop.run_in_executor(None, w3.eth.get_logs, {
                'fromBlock': current_block - 500, 'toBlock': 'latest',
                'address': USDC_CONTRACT, 'topics': [TRANSFER_TOPIC, None, addr_topic]
            })
            total_sent = sum(int(l["data"].hex(), 16) for l in logs_out) / 10**6
            total_received = sum(int(l["data"].hex(), 16) for l in logs_in) / 10**6
        except Exception:
            total_sent, total_received, logs_out, logs_in = 0, 0, [], []
        tx_count = await loop.run_in_executor(None, w3.eth.get_transaction_count, addr)
        # Profile classification
        total_volume = total_sent + total_received
        if total_volume > 100000:
            profile_type = "whale_institutional"
        elif total_volume > 10000:
            profile_type = "high_value_trader"
        elif total_volume > 1000:
            profile_type = "active_trader"
        elif tx_count > 50:
            profile_type = "active_user"
        elif eth_balance > 0.01 or usdc_balance > 1:
            profile_type = "retail_holder"
        else:
            profile_type = "minimal_activity"
        return {
            "address": address, "profile_type": profile_type,
            "balances": {"ETH": round(eth_balance, 6), "USDC": round(usdc_balance, 2), "WETH": round(weth_balance, 6)},
            "activity_500_blocks": {
                "outgoing_usdc": round(total_sent, 2), "incoming_usdc": round(total_received, 2),
                "net_flow_usdc": round(total_received - total_sent, 2),
                "transaction_count": tx_count
            },
            "network": "base", "queried_at": datetime.now(timezone.utc).isoformat()
        }
    return await handle_paid_endpoint("/crypto/wallet-profile", desc, x_payment, get_data)


@app.get("/crypto/whale-moves")
async def crypto_whale_moves(min_usdc: float = Query(1000), x_payment: str = Header(None, alias="X-PAYMENT")):
    desc = "Large USDC transfers on Base (whale tracking)"
    async def get_data():
        loop = asyncio.get_event_loop()
        current_block = w3.eth.block_number
        min_wei = int(min_usdc * 10**6)
        logs = await loop.run_in_executor(None, w3.eth.get_logs, {
            'fromBlock': current_block - 500, 'toBlock': 'latest',
            'address': USDC_CONTRACT, 'topics': [TRANSFER_TOPIC]
        })
        whales = []
        for log in logs:
            amount = int(log["data"].hex(), 16)
            if amount >= min_wei:
                whales.append({
                    "tx_hash": log["transactionHash"].hex(),
                    "from": "0x" + log["topics"][1].hex()[-40:],
                    "to": "0x" + log["topics"][2].hex()[-40:],
                    "amount_usdc": round(amount / 10**6, 2),
                    "block": log["blockNumber"]
                })
        whales.sort(key=lambda x: x["amount_usdc"], reverse=True)
        total_moved = sum(w["amount_usdc"] for w in whales)
        return {
            "whale_transfers": whales[:50],
            "total_transfers_found": len(whales),
            "total_usdc_moved": round(total_moved, 2),
            "min_threshold_usdc": min_usdc,
            "blocks_scanned": 500,
            "latest_block": current_block,
            "queried_at": datetime.now(timezone.utc).isoformat()
        }
    return await handle_paid_endpoint("/crypto/whale-moves", desc, x_payment, get_data)


@app.get("/crypto/gas-oracle")
async def crypto_gas_oracle(x_payment: str = Header(None, alias="X-PAYMENT")):
    desc = "Current Base gas price and transaction cost estimates"
    async def get_data():
        loop = asyncio.get_event_loop()
        gas_price = await loop.run_in_executor(None, w3.eth.gas_price)
        gas_gwei = float(w3.from_wei(gas_price, 'gwei'))
        block = w3.eth.block_number
        return {
            "network": "base",
            "gas_price_gwei": round(gas_gwei, 4),
            "estimated_costs_usd": {
                "eth_transfer": {"gas_limit": 21000, "gas_cost_gwei": round(21000 * gas_gwei, 2), "note": "Simple ETH send"},
                "usdc_transfer": {"gas_limit": 65000, "gas_cost_gwei": round(65000 * gas_gwei, 2), "note": "ERC-20 USDC transfer"},
                "dex_swap": {"gas_limit": 180000, "gas_cost_gwei": round(180000 * gas_gwei, 2), "note": "Uniswap V3 swap"},
                "uniswap_v3_swap": {"gas_limit": 200000, "gas_cost_gwei": round(200000 * gas_gwei, 2), "note": "Complex route swap"}
            },
            "block_number": block,
            "recommendation": "low" if gas_gwei < 0.05 else ("medium" if gas_gwei < 0.2 else "high"),
            "queried_at": datetime.now(timezone.utc).isoformat()
        }
    return await handle_paid_endpoint("/crypto/gas-oracle", desc, x_payment, get_data)


# ==========================================
# 5. START
# ==========================================
if __name__ == "__main__":
    print("=" * 55)
    print(" KRISTO INTELLIGENCE API v3.0 ")
    print(f" {len(DESTINATIONS)} destinations | 3 flight regions | 3 crypto tools ")
    print("=" * 55)
    print(f" * Wallet:   {WALLET_ADDRESS}")
    print(f" * Price:    {PRICE_USDC} {ASSET} ({NETWORK})")
    print(f" * Web3 OK:  {w3.is_connected()}")
    print(f" * Block:    {w3.eth.block_number}")
    print(f" * Server:   http://0.0.0.0:8000")
    print("=" * 55)
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
