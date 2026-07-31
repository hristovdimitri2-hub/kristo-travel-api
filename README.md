# Kristo Intelligence — x402 Pay-Per-Call API

> Pay-per-call DeFi intelligence API for AI agents on Base blockchain (Chain ID 8453). Powered by the x402 protocol.

## 🚀 Quick Start

```bash
# 1. Call any paid endpoint (get 402 + payment instructions)
curl https://kristo-intelligence-api.onrender.com/defi/yields

# 2. Server responds with 402 + payment details:
# {
#   "x402_version": 1,
#   "accepts": {
#     "scheme": "exact",
#     "network": "base",
#     "chain_id": 8453,
#     "asset": "USDC",
#     "amount": "0.01",
#     "payTo": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"
#   }
# }

# 3. Send 0.01 USDC on Base to payTo address, then retry with tx hash:
curl -H "X-PAYMENT: 0xYOUR_TX_HASH" https://kristo-intelligence-api.onrender.com/defi/yields
```

## 💰 Pricing

| Type | Price | Endpoints |
|------|-------|-----------|
| **Paid** | 0.01 USDC/call | 10 endpoints |
| **Freemium** | Free (rate-limited) | token-prices, gas-oracle |
| **Free** | Free | metadata, health, pricing, stats |

**Hooks:**
- 🎁 First 3 calls FREE for new wallets
- 📊 After 50 paid calls → 0.005 USDC/call (50% off)
- 🔗 Referral program: earn 20% of referred agent's payments

## 📡 Endpoints

### Paid (0.01 USDC/call)

| Endpoint | Description |
|----------|-------------|
| `GET /defi/yields` | Top 10 Base DeFi yield pools by TVL |
| `GET /defi/tvl-movers` | Base protocols with biggest 1-day TVL changes |
| `GET /defi/lending-rates` | Best lending/borrowing rates on Base |
| `GET /defi/dex-pools` | Top DEX liquidity pools (Aerodrome, Uniswap) |
| `GET /defi/protocol-safety` | Risk scores for Base DeFi protocols |
| `GET /crypto/token-launches` | Recently launched tokens on Base |
| `GET /crypto/token-security` | 🛡️ Rug-pull & honeypot detection scanner |
| `GET /crypto/wallet-profile` | On-chain wallet analysis & classification |
| `GET /crypto/whale-moves` | Large USDC transfers on Base |
| `GET /crypto/bridge-volume` | Cross-chain bridge volume to/from Base |

### Freemium (free with rate limiting)

| Endpoint | Description |
|----------|-------------|
| `GET /crypto/token-prices` | Real-time token prices from CoinGecko |
| `GET /crypto/gas-oracle` | Base gas price & cost estimates |

### Free

| Endpoint | Description |
|----------|-------------|
| `GET /` | Service metadata & endpoint roster |
| `GET /health` | API health & Web3 connectivity |
| `GET /pricing` | Transparent pricing & hooks info |
| `GET /stats` | Public usage statistics |
| `GET /sales/recent` | Recent sales log |
| `GET /agent/intelligence` | Autonomous intelligence report |
| `GET /agent/recommendations` | AI-generated recommendations |

## 🛡️ Token Security Scanner

The `/crypto/token-security` endpoint provides comprehensive rug-pull detection:

```bash
curl -H "X-PAYMENT: 0xTX_HASH" \
  "https://kristo-intelligence-api.onrender.com/crypto/token-security?address=0xTOKEN_ADDRESS"
```

Returns:
- `is_safe` (bool) — safe to interact with
- `is_honeypot_suspected` (bool) — potential honeypot
- `risk_score` (0-100) — higher is safer
- `risk_level` — "Low Risk" / "Medium Risk" / "High Risk" / "Critical Risk"
- `risk_factors` — detailed list of findings
- `recommendation_for_ai_agent` — buy/avoid decision with confidence

## 🧠 Autonomous Intelligence Engine

The API includes a built-in intelligence engine that runs every hour:
- Analyzes sales patterns and endpoint popularity
- Checks CoinGecko for trending tokens
- Generates dynamic pricing recommendations
- Identifies underperforming endpoints
- Stores all reports in SQLite

Access via `GET /agent/intelligence` or `GET /agent/recommendations`

## 🔗 Links

- **API**: https://kristo-intelligence-api.onrender.com
- **Dashboard**: https://kristo-travel-dashboard.vercel.app
- **GitHub**: https://github.com/hristovdimitri2-hub/kristo-travel-api
- **Network**: Base Mainnet (Chain ID 8453)
- **Payment**: USDC via x402 protocol
- **Wallet**: `0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f`

## 🏗️ Tech Stack

- **Backend**: FastAPI + Python 3
- **Hosting**: Render (API) + Vercel (Dashboard)
- **Blockchain**: Base Mainnet (Chain ID 8453)
- **Payments**: x402 protocol with USDC
- **Data Sources**: DefiLlama, CoinGecko, direct RPC
- **Database**: SQLite (replay protection + sales logs + intelligence reports)

## 📄 License

MIT
