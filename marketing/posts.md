# Kristo Intelligence — Marketing Toolkit

## 1. Reddit Post (r/BaseChain)

**Title:** Free rug-pull scanner for Base tokens — AI agents can call it via x402 (pay 0.25 USDC per query)

**Body:**

I built a pay-per-call API for Base DeFi intelligence. No subscriptions, no API keys — you pay 0.25 USDC per call via the x402 protocol (on-chain USDC micropayments on Base).

**What it does:**
- 🛡️ Token Security Scanner — checks any Base token for rug-pull risk, honeypot detection, liquidity lock status, contract audit score
- 📈 DeFi Yield Pools — top 10 Base yield farms sorted by APY + TVL
- 🐋 Whale Tracker — large USDC transfers (>$10k) on Base in real-time
- 👤 Wallet Profiler — classify any wallet as whale/institutional/retail/degen
- ⛽ Gas Oracle — real-time Base gas prices + cost estimates
- + 15 more endpoints (lending rates, DEX pools, TVL movers, bridge volume, etc.)

**Free stuff (no payment needed):**
- Token prices (ETH, USDC, any Base token)
- Gas oracle
- API discovery files (llms.txt, x402.json, agents.json)

**How to use it:**
```
# Free — token prices
curl https://kristo-intelligence-api.onrender.com/crypto/token-prices?tokens=ETH,USDC

# Paid — rug-pull scan (sends 402, you pay 0.25 USDC on Base)
curl https://kristo-intelligence-api.onrender.com/crypto/token-security?address=0x...
```

**There's also a Telegram bot:** @kristo_intelligence_bot — free prices/gas, paid scans (0.25 USDC).

First 3 calls are FREE for new wallets (trial credits).

API: https://kristo-intelligence-api.onrender.com
Dashboard: https://kristo-travel-dashboard.vercel.app
Docs: https://kristo-intelligence-api.onrender.com/llms.txt

Built on Base (Chain 8453). Payments verified on-chain via x402 protocol.

---

## 2. Base Discord (Developer Channel)

**Message:**

Hey 👋 — just shipped a pay-per-call DeFi intelligence API for Base. x402 protocol, 0.25 USDC per call, no API keys needed.

**Killer feature:** Token Security Scanner — paste any Base token address, get rug-pull risk score, honeypot check, liquidity lock status, and contract safety audit. AI agents can call it programmatically.

20 endpoints total (10 paid, 10 free). Token prices and gas oracle are free forever.

Also built a Telegram bot (@kristo_intelligence_bot) — free prices/gas, paid security scans. First 3 calls free for new wallets.

Try it:
```
curl https://kristo-intelligence-api.onrender.com/crypto/token-prices?tokens=ETH,USDC
```

Dashboard: https://kristo-travel-dashboard.vercel.app

Happy to get feedback 🙏

---

## 3. Twitter/X Post

**Text:**

🧵 Built a pay-per-call DeFi intelligence API for Base.

No subscriptions. No API keys. Pay 0.25 USDC per call via x402 (on-chain micropayments).

🛡️ Rug-pull scanner
📈 DeFi yield pools
🐋 Whale tracker
👤 Wallet profiler

Free token prices + gas oracle.

Telegram bot: @kristo_intelligence_bot
Dashboard: kristo-travel-dashboard.vercel.app

Built on @base 🟦

---

## 4. Hacker News / Dev Communities

**Title:** Show HN: Pay-per-call DeFi API for Base blockchain (x402 micropayments, no API keys)

**Body:**

I built an API where you pay 0.25 USDC per call via on-chain micropayments (x402 protocol on Base). No API keys, no subscriptions, no signup.

The protocol works like this:
1. Client calls an endpoint
2. API responds with 402 + payment instructions (amount, wallet address, chain)
3. Client sends USDC on Base, includes tx hash in retry header
4. API verifies the on-chain transfer, returns data

20 endpoints covering DeFi yields, whale tracking, token security, wallet profiling, gas oracle, and more.

Token prices and gas are free (freemium). First 3 calls free for new wallets (trial credits).

The x402 protocol is an open standard from Coinbase Developer Platform — turns any HTTP API into a pay-per-call service without authentication.

API: https://kristo-intelligence-api.onrender.com
Dashboard: https://kristo-travel-dashboard.vercel.app
Discovery: https://kristo-intelligence-api.onrender.com/.well-known/x402.json

---

## 5. Telegram Communities

Post in Base ecosystem Telegram groups:

**Short version:**

🚀 Kristo Intelligence — DeFi API for Base

Pay 0.25 USDC per call. No API keys. x402 protocol.

🛡️ Rug-pull scanner — check any Base token
📈 Top yield pools by APY
🐋 Whale USDC transfers in real-time
👤 Wallet profiling & classification

Free: token prices + gas oracle
Free: first 3 calls for new wallets

Bot: @kristo_intelligence_bot
API: kristo-intelligence-api.onrender.com

---

## Where to post (priority order):

1. **r/BaseChain** — Reddit (highest conversion)
2. **Base Discord** — #dev or #build channels
3. **r/CryptoCurrency** — Reddit (broader audience)
4. **Twitter/X** — tag @base, @BuildOnBase, @CoinbaseDev
5. **Hacker News** — Show HN (developer audience)
6. **Base Telegram groups** — community channels
7. **MCP directories** — Smithery.ai, Glama.ai (next step)
