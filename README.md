# Kristo Intelligence — x402 Pay-Per-Call API

Production-ready DeFi intelligence API for AI agents on Base blockchain (Chain ID: 8453).

## Architecture

```
kristo-intelligence/
├── kristo_api.py          # FastAPI backend (port 8000)
├── requirements.txt       # Python deps
├── Dockerfile             # Container build
├── docker-compose.yml     # Local Docker
├── render.yaml            # Render deployment
├── dashboard/             # Next.js dashboard (Vercel)
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx       # Full dashboard
│   │   └── globals.css
│   ├── package.json
│   ├── next.config.js
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── vercel.json
│   └── public/
│       └── manifest.json
└── .gitignore
```

## Pricing
- **0.25 USDC per call** (paid on-chain via x402 protocol)
- 4 free endpoints (health, root, openapi, sales log)
- 6 paid endpoints (yields, TVL movers, token prices, wallet profile, whale moves, gas oracle)

## Deployment

### 1. API Backend (Render)
```bash
# Render auto-deploys from GitHub on push
# Config in render.yaml
# Set env var: WALLET_ADDRESS=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f
```

### 2. Dashboard (Vercel)
```bash
cd dashboard
npm install
npm run build
vercel --prod
```

### 3. Keepalive (24/7 on free tier)
- Set up UptimeRobot (free) to ping `https://your-api.onrender.com/health` every 5 minutes
- This prevents Render free tier from sleeping

## Stack
- **Backend**: FastAPI + httpx + SQLite + slowapi
- **Frontend**: Next.js 14 + Tailwind + ethers v6
- **Blockchain**: Base Mainnet (Chain ID 8453)
- **Payments**: x402 protocol, USDC on Base
