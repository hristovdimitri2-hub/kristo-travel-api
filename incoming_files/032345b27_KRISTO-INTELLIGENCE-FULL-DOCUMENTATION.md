# Kristo Intelligence v5.0 — Пълна документация

> **Pay-per-call Base DeFi & on-chain intelligence API за AI агенти**
> 
> $0.05 USDC на заявка · x402 v2 протокол · Base мрежа · Без API ключове

**Live URL:** https://kristo-intelligence.vercel.app  
**x402scan listing:** https://tryponcho.com/m/kristo-intelligence.vercel.app  
**Дата на създаване:** 26-29 Юли 2026  
**Версия:** 5.0.0  

---

## 📋 Съдържание

1. [Обзор на проекта](#1-обзор-на-проекта)
2. [Архитектура](#2-архитектура)
3. [Endpoints](#3-endpoints)
4. [x402 протокол](#4-x402-протокол)
5. [AI мониторинг система](#5-ai-мониторинг-система)
6. [Инфраструктура](#6-инфраструктура)
7. [Пълен код](#7-пълен-код)
8. [Deployment](#8-deployment)
9. [Тестване](#9-тестване)
10. [Бъдещо развитие](#10-бъдещо-развитие)

---

## 1. Обзор на проекта

### Какво е Kristo Intelligence?

Kristo Intelligence е **pay-per-call API** за AI агенти, което предоставя реални DeFi и on-chain данни от Base blockchain. AI агентите плащат 0.05 USDC на заявка чрез x402 протокол — без API ключове, без абонаменти, без регистрация.

### Еволюция от v4.0 към v5.0

Започнахме от v4.0 (Python + Render), което имаше 6 критични проблема:

| Проблем v4.0 | Решение v5.0 |
|---|---|
| Race condition в replay protection | DB UNIQUE constraint (атомарен) |
| In-memory state се губи при рестарт | Prisma + Turso persistent storage |
| Без rate limiting | Per-IP token bucket (60 RPM + burst 10) |
| Single RPC, no failover | Multi-RPC failover (Alchemy → public) |
| eth_getLogs crash при >10K резултата | Paginated chunks по 2000 блока |
| eth_getTransactionCount мислabeled | Преименувано на getNonce |
| Hardcoded wallet fallback | requireEnv() — fail-fast |
| print() логове | Structured JSON logger |
| Без тестове | 11 unit tests (включ. race condition) |
| Render заспива след 15 мин | Vercel serverless (no sleep) |

### Статистика v5.0

- **8 платени endpoints** + **7 безплатни** = **15 общо**
- **11 unit tests** (всички минават)
- **0 lint грешки**
- **100% TypeScript**
- **x402 v2 протокол** (с v1 backwards compatibility)
- **AI мониторинг** (daily cron + rule-based insights)

---

## 2. Архитектура

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Production)                       │
│  https://kristo-intelligence.vercel.app                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Dashboard   │  │   API Routes│  │  AI Monitor │         │
│  │  (Next.js)   │  │  (15 routes)│  │  (Cron 9AM) │         │
│  │  page.tsx    │  │             │  │             │         │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘         │
│         │                  │                │                 │
│         └──────────┬───────┴────────────────┘                 │
│                    │                                          │
│         ┌──────────▼──────────┐                              │
│         │   Prisma + libSQL   │                              │
│         │   (Turso cloud DB)  │                              │
│         └──────────┬──────────┘                              │
│                    │                                          │
└────────────────────┼─────────────────────────────────────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌─────────┐   ┌───────────┐   ┌───────────┐
│ Alchemy │   │ DefiLlama │   │ CoinGecko │
│  (Base  │   │           │   │           │
│   RPC)  │   │           │   │           │
└─────────┘   └───────────┘ └───────────┘
```

### Tech Stack

| Компонент | Технология | Версия |
|---|---|---|
| Framework | Next.js (App Router) | 16.1 |
| Език | TypeScript | 5 |
| Styling | Tailwind CSS + shadcn/ui | 4 |
| Database | Prisma + Turso (libSQL) | 6.19 |
| RPC | Alchemy Base Mainnet | - |
| Хостинг | Vercel (serverless) | - |
| Protocol | x402 v2 | 2 |
| AI | z-ai-web-dev-sdk + rule-based | 0.0.18 |

---

## 3. Endpoints

### Платени (8 endpoints, $0.05 USDC на заявка)

| Endpoint | Описание | Източник | Cache TTL |
|---|---|---|---|
| `/api/defi/yields` | Top 10 Base DeFi yield pools по TVL | DefiLlama | 5 мин |
| `/api/defi/tvl-movers` | Base протоколи с най-големи TVL промени | DefiLlama | 5 мин |
| `/api/crypto/token-prices` | Реални token prices + 24h change + market cap | CoinGecko | 60 сек |
| `/api/crypto/wallet-profile?address=0x...` | On-chain wallet анализ + risk classification | Base RPC | 30 сек |
| `/api/crypto/whale-moves?min_usdc=1000` | Големи USDC трансфери (whale tracking) | Base RPC | 30 сек |
| `/api/crypto/gas-oracle` | Текущ Base gas price + tx cost estimates | Base RPC | 10 сек |
| `/api/nft/floor-prices` | Top 10 Base NFT колекции по floor price | CoinGecko NFT | 10 мин |
| `/api/crypto/airdrop-tracker` | Активни airdrop кампании с deadlines | Curated | 30 мин |

### Безплатни (7 endpoints)

| Endpoint | Описание |
|---|---|
| `/api` | Service metadata + pricing |
| `/api/health` | Live status + current Base block |
| `/api/stats/public` | Публични anonymized revenue stats |
| `/api/sales/recent` | Последни продажби (audit log) |
| `/api/credits?address=0x...` | Проверка на кредити за wallet |
| `/api/openapi.json` | OpenAPI 3.1 spec с x402 metadata |
| `/api/ai/insights` | AI-генерирани бизнес insights |

### AI & Discovery

| Endpoint | Описание |
|---|---|
| `/api/ai/competitors` (POST) | Ръчно стартиране на AI анализ |
| `/api/cron/daily-analysis` | Vercel Cron — всеки ден 09:00 UTC |
| `/mcp` | MCP manifest за Claude/Cursor/Windsurf |
| `/openapi.json` | Root OpenAPI (за x402scan discovery) |
| `/.well-known/ai-plugin.json` | ChatGPT plugin manifest |
| `/.well-known/x402.json` | x402 discovery document |
| `/agents.txt` | AI crawler инструкции |
| `/llms.txt` | LLM-readable описание |
| `/api/badge` | Live SVG статус badge |
| `/api/sales/webhook` (POST) | Webhook регистрация за sale notifications |

---

## 4. x402 протокол

### v2 (canonical — за x402scan и модерни агенти)

**Response формат:**
```json
{
  "x402Version": 2,
  "error": "Payment required...",
  "resource": {
    "url": "https://kristo-intelligence.vercel.app/api/defi/yields",
    "description": "Top 10 Base-chain DeFi yield pools by TVL",
    "mimeType": "application/json",
    "serviceName": "Kristo Intelligence",
    "tags": ["defi", "base", "crypto", "ai-agents"],
    "iconUrl": "https://kristo-intelligence.vercel.app/icon.svg"
  },
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "amount": "50000",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
      "maxTimeoutSeconds": 60,
      "extra": { "name": "USDC", "version": "2" }
    }
  ]
}
```

**Headers:**
- `PAYMENT-REQUIRED: <base64-encoded JSON>` (v2 canonical)
- `X-PAYMENT-REQUIRED: <raw JSON>` (v1 backwards compat)

### v1 (backwards compatibility — за стари агенти)

```json
{
  "x402_version": 1,
  "accepts": {
    "scheme": "exact",
    "network": "base",
    "asset": "USDC",
    "amount": "0.05",
    "payTo": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
    "description": "Top 10 Base-chain DeFi yield pools by TVL"
  },
  "error": "Payment required..."
}
```

### Payment Flow (3 стъпки)

1. **Discover** — Агентът вика endpoint без `X-PAYMENT` → получава HTTP 402 + payment instructions
2. **Pay** — Агентът праща 0.05 USDC на Base към `payTo` адреса
3. **Redeem** — Агентът retry-ва с `X-PAYMENT: <tx_hash>` → получава данни

### Security

- **Replay protection**: DB UNIQUE constraint на `txHash` (атомарен, race-safe)
- **Strict amount**: Точно 50000 raw units (0.05 USDC) — отхвърля partial и overpayment
- **On-chain verification**: Проверява receipt status, Transfer event, recipient, amount
- **Rate limiting**: 60 RPM per IP + burst 10 (token bucket)
- **Credit/refund**: Автоматичен credit при data fetch failure (90 дни валидност)

---

## 5. AI мониторинг система

### Как работи

1. **Vercel Cron** се пуска всеки ден в 09:00 UTC
2. Системата чете текущите stats (revenue, sales, customers)
3. Опитва LLM анализ (z-ai-web-dev-sdk)
4. Ако LLM не е достъпен → използва rule-based fallback
5. Генерира 3-5 insights (pricing, opportunities, competitor analysis)
6. Записва ги в `AIInsight` таблица със status "new"
7. Операторът ги преглежда в dashboard-а

### Rule-based insights (fallback)

Когато LLM не е достъпен, системата генерира:

1. **Pricing suggestion** — ако 0 продажби 7 дни → намали цена
2. **Product gap** — добави governance proposals endpoint
3. **Positioning** — Base vs Solana стратегия
4. **Growth** — free tier за AI agent developers
5. **Technical** — response time tracking

### Dashboard AI Insights таб

- **"Run AI Analysis Now"** бутон — ръчно стартиране
- **5 статистики** (New / Reviewed / Applied / Dismissed / Total)
- **Списък insights** с severity badges
- **"Mark Applied" / "Dismiss"** бутони

---

## 6. Инфраструктура

### Database (Turso)

6 таблици в cloud libSQL база:

| Таблица | Описание |
|---|---|
| `UsedTransaction` | Replay protection (UNIQUE на txHash) |
| `Sale` | Sales audit log (persistent) |
| `Credit` | Refund credits (90 дни валидност) |
| `AuditEvent` | Structured audit trail |
| `AIInsight` | AI-генерирани бизнес предложения |
| `DailyMetric` | Дневни metrics snapshots |

### RPC Endpoints

1. **Alchemy Base Mainnet** (primary) — `https://base-mainnet.g.alchemy.com/v2/alch_...`
2. **Public Base RPC** (fallback) — `https://mainnet.base.org`

Multi-endpoint failover: ако Alchemy падне, автоматично минава на public.

### Environment Variables

```env
DATABASE_URL=file:./prisma/dev.db
TURSO_DATABASE_URL=libsql://kristo-mitaka7210.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
WALLET_ADDRESS=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f
PRICE_USDC=0.05
ALCHEMY_BASE_URL=https://base-mainnet.g.alchemy.com/v2/alch_...
RATE_LIMIT_RPM=60
RATE_LIMIT_BURST=10
PUBLIC_API_URL=https://kristo-intelligence.vercel.app
LOG_LEVEL=info
```

---

## 7. Пълен код

### Файлова структура

```
src/
├── app/
│   ├── layout.tsx                    # SEO + Open Graph metadata
│   ├── page.tsx                      # Dashboard (6 таба)
│   ├── opengraph-image.tsx           # OG image generator
│   ├── globals.css
│   ├── api/
│   │   ├── route.ts                  # GET / — metadata
│   │   ├── health/route.ts           # GET /api/health
│   │   ├── sales/
│   │   │   ├── recent/route.ts       # GET /api/sales/recent
│   │   │   └── webhook/route.ts      # POST /api/sales/webhook
│   │   ├── stats/public/route.ts     # GET /api/stats/public
│   │   ├── credits/route.ts          # GET /api/credits
│   │   ├── admin/stats/route.ts      # GET /api/admin/stats
│   │   ├── openapi.json/route.ts     # GET /api/openapi.json
│   │   ├── badge/route.ts            # GET /api/badge (SVG)
│   │   ├── ai/
│   │   │   ├── insights/route.ts     # GET/PATCH /api/ai/insights
│   │   │   └── competitors/route.ts  # POST /api/ai/competitors
│   │   ├── cron/daily-analysis/route.ts
│   │   ├── defi/
│   │   │   ├── yields/route.ts
│   │   │   └── tvl-movers/route.ts
│   │   ├── crypto/
│   │   │   ├── token-prices/route.ts
│   │   │   ├── wallet-profile/route.ts
│   │   │   ├── whale-moves/route.ts
│   │   │   ├── gas-oracle/route.ts
│   │   │   └── airdrop-tracker/route.ts
│   │   ├── nft/floor-prices/route.ts
│   │   └── mcp/route.ts              # MCP manifest
│   └── openapi.json/route.ts         # Root OpenAPI
├── lib/
│   ├── constants.ts                  # Lazy env config (build-safe)
│   ├── db.ts                         # LazyPrismaClient (build-safe)
│   ├── logger.ts                     # Structured JSON logger
│   ├── cache.ts                      # TTL cache + single-flight
│   ├── rate-limit.ts                 # Token bucket per IP
│   ├── base-rpc.ts                   # Multi-RPC failover
│   ├── external-data.ts              # DefiLlama + CoinGecko
│   ├── payment.ts                    # x402 v2 + v1 payment logic
│   ├── demo-data.ts                  # Sample responses for demo mode
│   ├── airdrops-data.ts              # Curated airdrop dataset
│   └── ai-monitor.ts                 # AI business analyst
├── components/ui/                    # shadcn/ui (40+ components)
├── hooks/
│   ├── use-toast.ts
│   └── use-mobile.ts
prisma/
└── schema.prisma                     # 6 models
public/
├── favicon.ico
├── icon.svg
├── logo.svg
├── robots.txt
├── sitemap.xml
├── site.webmanifest
├── agents.txt
├── llms.txt
└── .well-known/
    ├── ai-plugin.json
    └── x402.json
scripts/
├── ai_agent_sim.py                   # Python AI agent simulator
├── x402_test.py                      # x402 E2E test script
├── init-turso.ts                     # DB initialization
└── deploy-vercel.sh                  # Deploy script
tests/
└── payment.test.ts                   # 11 unit tests
```

### Ключови файлове (пълен код)

#### `src/lib/constants.ts` — Lazy env config

```typescript
export const NETWORK = "base" as const;
export const CHAIN_ID = 8453;
export const CHAIN_ID_HEX = "0x2105";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v || v.trim() === "") {
    throw new Error(`[config] Missing required env var: ${key}.`);
  }
  return v.trim();
}

let _walletAddress: string | null = null;
export function getWalletAddress(): string {
  if (_walletAddress === null) _walletAddress = getEnv("WALLET_ADDRESS");
  return _walletAddress;
}

let _priceUsdc: string | null = null;
export function getPriceUsdc(): string {
  if (_priceUsdc === null) _priceUsdc = process.env.PRICE_USDC ?? "0.05";
  return _priceUsdc;
}

let _priceUsdcRaw: number | null = null;
export function getPriceUsdcRaw(): number {
  if (_priceUsdcRaw === null) {
    const price = parseFloat(getPriceUsdc());
    _priceUsdcRaw = Math.round(price * 1_000_000);
  }
  return _priceUsdcRaw;
}

export const USDC_CONTRACT = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const WETH_CONTRACT = "0x4200000000000000000000000000000000000006";
export const TRANSFER_TOPIC = "0xddf252ad1be2c89b69a2ab06d3f945bc9e889edc4f4c7bf1f8d0a2e1000000000";

export const PUBLIC_API_URL = process.env.PUBLIC_API_URL ?? "http://localhost:3000";
export const API_VERSION = "5.0.0";
```

#### `src/lib/db.ts` — Build-safe Prisma client

```typescript
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const tursoUrl = process.env.TURSO_DATABASE_URL
  const tursoToken = process.env.TURSO_AUTH_TOKEN

  if (tursoUrl && tursoToken) {
    const adapter = new PrismaLibSql({ url: tursoUrl, authToken: tursoToken })
    return new PrismaClient({
      adapter,
      log: process.env.LOG_LEVEL === "debug" ? ["query", "error", "warn"] : ["error", "warn"],
    })
  }

  return new PrismaClient({
    log: process.env.LOG_LEVEL === "debug" ? ["query", "error", "warn"] : ["error", "warn"],
  })
}

let cachedClient: PrismaClient | null = null

class LazyPrismaClient {
  private _client(): PrismaClient {
    if (!cachedClient) {
      cachedClient = createPrismaClient()
      if (process.env.NODE_ENV !== 'production') {
        globalForPrisma.prisma = cachedClient
      }
    }
    return cachedClient
  }

  get usedTransaction() { return this._client().usedTransaction }
  get sale() { return this._client().sale }
  get credit() { return this._client().credit }
  get auditEvent() { return this._client().auditEvent }
  get aIInsight() { return this._client().aIInsight }
  get dailyMetric() { return this._client().dailyMetric }

  $transaction<T>(args: Parameters<PrismaClient["$transaction"]>[0]): Promise<T> {
    return (this._client().$transaction as unknown as (a: typeof args) => Promise<T>)(args)
  }
  $disconnect(): Promise<void> {
    if (cachedClient) return cachedClient.$disconnect()
    return Promise.resolve()
  }
}

export const db = new LazyPrismaClient() as unknown as PrismaClient
```

#### `src/lib/payment.ts` — x402 v2 + v1 payment logic

```typescript
// x402 v2 PaymentRequired format
export interface X402PaymentRequirementsV2 {
  scheme: "exact";
  network: string; // CAIP-2: eip155:8453
  amount: string; // atomic units (50000)
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra?: { name?: string; version?: string };
}

export interface X402ResourceInfo {
  url: string;
  description: string;
  mimeType: string;
  serviceName: string;
  tags?: string[];
  iconUrl?: string;
}

const BASE_CAIP2 = "eip155:8453";
const USDC_EXTRA = { name: "USDC", version: "2" };

export function make402(description, error?, invalidTx?, resourceUrl?): X402CombinedPayload {
  const wallet = getWalletAddress();
  const price = getPriceUsdc();
  const priceRaw = getPriceUsdcRaw();

  return {
    x402Version: 2,
    error: error ?? "Payment required...",
    resource: {
      url: resourceUrl ?? PUBLIC_API_URL,
      description,
      mimeType: "application/json",
      serviceName: "Kristo Intelligence",
      tags: ["defi", "base", "crypto", "ai-agents"],
      iconUrl: `${PUBLIC_API_URL}/icon.svg`,
    },
    accepts: [{
      scheme: "exact",
      network: BASE_CAIP2,
      amount: String(priceRaw),
      asset: USDC_CONTRACT,
      payTo: wallet,
      maxTimeoutSeconds: 60,
      extra: USDC_EXTRA,
    }],
    x402_version: 1,
    accepts_v1: {
      scheme: X402_SCHEME,
      network: NETWORK,
      asset: X402_ASSET,
      amount: price,
      payTo: wallet,
      description,
    },
    ...(invalidTx ? { invalid_tx: invalidTx } : {}),
  };
}

export function respond402(description, opts = {}): NextResponse {
  const payload = make402(description, opts.error, opts.invalidTx, opts.resourceUrl);
  const v2Payload = {
    x402Version: 2,
    error: payload.error,
    resource: payload.resource,
    accepts: payload.accepts,
  };
  const v2Base64 = Buffer.from(JSON.stringify(v2Payload)).toString("base64");

  return NextResponse.json(payload, {
    status: 402,
    headers: {
      "PAYMENT-REQUIRED": v2Base64,
      "X-PAYMENT-REQUIRED": JSON.stringify({
        x402_version: 1,
        accepts: payload.accepts_v1,
        error: payload.error,
      }),
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, X-PAYMENT-REQUIRED",
    },
  });
}

// Payment verification — DB-atomic replay protection
export async function verifyPayment(txHash: string): Promise<VerifyResult> {
  // 1. Format validation
  // 2. DB replay check (findUnique)
  // 3. Fetch receipt (getTxReceipt)
  // 4. Check status == 0x1
  // 5. Find USDC Transfer event to our wallet with exact amount
  // 6. Atomic INSERT (UNIQUE constraint — race-safe)
}

// handlePaid — wraps every paid endpoint
export async function handlePaid(req, endpoint, description, dataFn) {
  // 0. Demo mode (?demo=true → bypass payment)
  // 1. Rate limit check
  // 2. Payment header check (X-PAYMENT or X-PAYMENT-CREDIT)
  // 3. Verify payment (on-chain or credit redemption)
  // 4. Record sale + fire webhooks
  // 5. Execute data function
  // 6. On failure → issue credit automatically
}
```

#### `src/lib/ai-monitor.ts` — AI business analyst

```typescript
import ZAI from "z-ai-web-dev-sdk";

export async function runDailyAnalysis() {
  // 1. Get current stats (revenue, sales, customers)
  // 2. Try LLM analysis (z-ai-web-dev-sdk)
  //    - If fails → use rule-based fallback
  // 3. Generate pricing suggestion (rule-based)
  // 4. Store insights in AIInsight table
  // 5. Record DailyMetric snapshot
}

function getRuleBasedInsights(stats) {
  const insights = [];
  
  if (stats.sales === 0) {
    insights.push({
      type: "pricing_suggestion",
      severity: "warning",
      title: "No sales yet — consider lowering price to $0.01 for launch",
      description: `Current price is $${stats.price} USDC/call with 0 sales...`,
      recommendation: "Lower price to $0.01 USDC/call for first 100 customers...",
    });
  }
  
  insights.push({
    type: "opportunity",
    severity: "opportunity",
    title: "Add governance proposals endpoint — no competitor offers this",
    description: "Competitors focus on prices, wallets, whale moves...",
    recommendation: "Add /api/defi/governance endpoint...",
  });
  
  // ... 3 more insights
  
  return insights;
}
```

#### `prisma/schema.prisma` — 6 models

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model UsedTransaction {
  txHash      String   @id
  endpoint    String
  fromAddress String
  amountRaw   Int
  blockNumber Int
  consumedAt  DateTime @default(now())
  @@index([consumedAt])
  @@index([fromAddress])
}

model Sale {
  id          String   @id @default(cuid())
  txHash      String
  endpoint    String
  fromAddress String
  amountUsdc  Float
  blockNumber Int
  consumedAt  DateTime @default(now())
  @@index([consumedAt])
  @@index([endpoint])
  @@index([fromAddress])
}

model Credit {
  id              String   @id @default(cuid())
  ownerAddress    String
  amountUsdc      Float
  reason          String
  originalSaleId  String?
  appliedToSaleId String?
  issuedAt        DateTime @default(now())
  expiresAt       DateTime
  @@index([ownerAddress])
  @@index([issuedAt])
  @@index([appliedToSaleId])
}

model AuditEvent {
  id        String   @id @default(cuid())
  level     String
  category  String
  message   String
  meta      String?
  createdAt DateTime @default(now())
  @@index([createdAt])
  @@index([category, level])
}

model AIInsight {
  id             String   @id @default(cuid())
  type           String
  severity       String
  title          String
  description    String
  recommendation String
  data           String?
  status         String   @default("new")
  createdAt      DateTime @default(now())
  reviewedAt     DateTime?
  @@index([createdAt])
  @@index([status])
  @@index([type, severity])
}

model DailyMetric {
  id              String  @id @default(cuid())
  date            String  @unique
  revenueUsdc     Float
  salesCount      Int
  uniqueCustomers Int
  topEndpoint     String?
  notes           String?
  @@index([date])
}
```

#### `vercel.json` — Cron + build config

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "buildCommand": "bun run db:generate && bun run build",
  "installCommand": "bun install",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/route.ts": { "maxDuration": 30 },
    "src/app/api/cron/daily-analysis/route.ts": { "maxDuration": 60 },
    "src/app/api/ai/competitors/route.ts": { "maxDuration": 60 }
  },
  "crons": [
    { "path": "/api/cron/daily-analysis", "schedule": "0 9 * * *" }
  ]
}
```

---

## 8. Deployment

### Vercel

- **Project:** `kristo-intelligence` (prj_dTA71Ijfnu3wjjLCKt9h3Ag5TGny)
- **Team:** `hristovdimitri2-9569s-projects`
- **URL:** https://kristo-intelligence.vercel.app
- **Region:** iad1 (Washington DC)
- **Cron:** Daily at 09:00 UTC

### Turso Database

- **Name:** kristo
- **URL:** `libsql://kristo-mitaka7210.aws-us-east-1.turso.io`
- **Region:** AWS US-East-1

### Alchemy RPC

- **Network:** Base Mainnet (activated)
- **URL:** `https://base-mainnet.g.alchemy.com/v2/alch_...`

### x402scan Registration

- **Status:** Registered (8/8 endpoints valid)
- **Merchant page:** https://tryponcho.com/m/kristo-intelligence.vercel.app

---

## 9. Тестване

### Unit Tests (11/11 passing)

```
tests/payment.test.ts:
✓ rejects malformed hash
✓ rejects hash already in DB (replay)
✓ rejects when receipt lookup fails
✓ rejects when receipt is null
✓ rejects reverted transaction
✓ rejects when recipient is wrong
✓ rejects partial payment
✓ rejects overpayment
✓ happy path: valid 0.25 USDC transfer
✓ race condition: concurrent calls — only one wins
✓ different hashes both succeed
```

### AI Agent Simulator

```bash
# Demo mode (no payment)
python3 scripts/ai_agent_sim.py --demo --endpoint /api/defi/yields

# Live mode (real USDC)
python3 scripts/ai_agent_sim.py --private-key 0x... --endpoint /api/crypto/gas-oracle
```

### Production Tests

- 7/7 free endpoints → HTTP 200 ✅
- 8/8 demo mode endpoints → HTTP 200 ✅
- 3/3 paid endpoints (no payment) → HTTP 402 ✅
- x402 v2 response format ✅
- x402 v1 backwards compat ✅
- AI insights generation ✅
- Webhook registration ✅
- Favicon served ✅

---

## 10. Бъдещо развитие

### Препоръчителни следващи стъпки

1. **OpenAI/Anthropic API key** — за LLM insights на production
2. **Free tier** — 3 free calls/day per IP (real data, not demo)
3. **Governance proposals endpoint** — /api/defi/governance (Snapshot API)
4. **Response time tracking** — X-Response-Time header + p50/p95 metrics
5. **Multi-chain support** — Ethereum mainnet, Arbitrum, Optimism
6. **Custom domain** — kristo-intelligence.com
7. **Video demo** — за маркетинг в Base Discord
8. **Upstash Ratelimit** — за multi-region rate limiting на Vercel

### Маркетинг действия

1. **x402 Slack** → #showcase канал (когато работи)
2. **Base Discord** → #build-on-base
3. **Reddit** → r/Base, r/ethdev
4. **Twitter/X** → #Base #x402 #AIagents
5. **agentic.market** → валидиране на OpenAPI

---

## 📞 Контакти

- **Wallet:** `0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f`
- **Email:** hristovdimitri2@gmail.com
- **GitHub:** hristovdimitri2-hub/kristo-travel-api
- **Live:** https://kristo-intelligence.vercel.app

---

*Документация създадена на 29 Юли 2026 от Kristo Intelligence team*
