# Kristo Intelligence — Пълен обзор на проекта

> **Pay-per-call DeFi & on-chain intelligence API за AI агенти на Base blockchain**
>
> Създаден от: Dimitri Hristov (съвместно с Elio / Base44 Superagent)
> Период на разработка: 26 юли – 4 август 2026
> Версия: 5.0 (актуална)

---

## 1. Какво е Kristo Intelligence?

Kristo Intelligence е **pay-per-call API**, което предоставя реални DeFi и on-chain данни от Base blockchain. AI агентите плащат чрез x402 протокола — **без API ключове, без абонаменти, без регистрация**.

### Еволюция на версията

| Версия | Цена | Endpoints | Дата | Ключова промяна |
|--------|------|-----------|------|-----------------|
| v1.0 | 0.25 USDC | 6 paid + 4 free | 26.07.2026 | Първо MVP на Render (Python) |
| v2.0 | 0.05 USDC | 9 paid + 2 freemium + 6 free | 28.07.2026 | Автономен intelligence engine, 17 endpoints |
| v2.1 | 0.01 USDC | 10 paid + 2 freemium + 8 free | 29.07.2026 | Token security scanner, PR в awesome-x402 |
| v5.0 | 0.10 USDC | 10 paid + 2 freemium + 8 free | 01.08.2026 | Vercel serverless, Prisma+Turso, race-safe |

### Защо v5.0 (миграция от Render към Vercel)

| Проблем v4.0 | Решение v5.0 |
|---|---|
| Race condition в replay protection | DB UNIQUE constraint (атомарен) |
| In-memory state се губи при рестарт | Prisma + Turso persistent storage |
| Без rate limiting | Per-IP token bucket (60 RPM + burst 10) |
| Single RPC, no failover | Multi-RPC failover (Alchemy → public) |
| eth_getLogs crash при >10K резултата | Paginated chunks по 2000 блока |
| Render заспива след 15 мин | Vercel serverless (no sleep) |

---

## 2. Инфраструктура

### Хостинг

| Компонент | Платформа | URL |
|---|---|---|
| API + Dashboard | Vercel (serverless) | https://kristo-intelligence.vercel.app |
| Telegram Bot | Render (background worker) | @kristo_intelligence_bot |
| GitHub Repository | GitHub | hristovdimitri2-hub/kristo-travel-api (main) |

### Tech Stack

| Компонент | Технология | Версия |
|---|---|---|
| Framework | Next.js (App Router) | 16.1 |
| Език | TypeScript / Python (API v4) | 5 / 3.11 |
| Styling | Tailwind CSS + shadcn/ui | 4 |
| Database | Prisma + Turso (libSQL) | 6.19 |
| RPC | Alchemy Base Mainnet (primary) + Public RPC (fallback) | - |
| Хостинг | Vercel (serverless) | - |
| Protocol | x402 v2 (с v1 backwards compat) | 2 |
| AI мониторинг | z-ai-web-dev-sdk + rule-based fallback | 0.0.18 |

### Database таблици (Turso)

| Таблица | Описание |
|---|---|
| `UsedTransaction` | Replay protection (UNIQUE на txHash) |
| `Sale` | Sales audit log (persistent) |
| `Credit` | Refund credits (90 дни валидност) |
| `AuditEvent` | Structured audit trail |
| `AIInsight` | AI-генерирани бизнес предложения |
| `DailyMetric` | Дневни metrics snapshots |
| `trial_credits` | Trial credits per wallet |

### Environment Variables (Vercel)

```env
DATABASE_URL=file:./prisma/dev.db
TURSO_DATABASE_URL=libsql://kristo-mitaka7210.aws-us-east-1.turso.io
TURSO_AUTH_TOKEN=eyJhbGciOi...
WALLET_ADDRESS=0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f
PRICE_USDC=0.10
ALCHEMY_BASE_URL=https://base-mainnet.g.alchemy.com/v2/alch_...
RATE_LIMIT_RPM=60
TRIAL_FREE_CALLS=10
VOLUME_DISCOUNT_PRICE=0.15
```

### Environment Variables (Render — Telegram Bot)

```env
TELEGRAM_BOT_TOKEN=<token>
API_BASE=https://kristo-intelligence.vercel.app
PRICE_USDC=0.10
```

---

## 3. Endpoints — точки за влизане в API-то

### 🟡 Платени endpoints (10, 0.10 USDC на заявка)

Всички платени endpoints използват x402 протокола. При заявка без платежен header се връща HTTP 402 с инструкции за плащане.

| # | Endpoint | Метод | Описание | Източник | Cache |
|---|----------|-------|----------|----------|-------|
| 1 | `/api/defi/yields` | GET | Top 10 Base DeFi yield pools по TVL | DefiLlama | 5 мин |
| 2 | `/api/defi/tvl-movers` | GET | Base протоколи с най-големи TVL промени (24h) | DefiLlama | 5 мин |
| 3 | `/api/defi/lending-rates` | GET | Best lending/borrowing rates на Base | DefiLlama | 5 мин |
| 4 | `/api/defi/dex-pools` | GET | Top DEX liquidity pools на Base | DefiLlama | 5 мин |
| 5 | `/api/defi/protocol-safety` | GET | DeFi protocol safety scores + risk assessment | DefiLlama | 10 мин |
| 6 | `/api/crypto/token-launches` | GET | Recently launched tokens на Base | CoinGecko | 30 мин |
| 7 | `/api/crypto/token-security` | GET | Token security scanner — rug-pull & honeypot detection | Base RPC + on-chain анализ | real-time |
| 8 | `/api/crypto/wallet-profile?address=0x...` | GET | On-chain wallet анализ + risk classification (whale/institutional/retail/degen) | Base RPC | 30 сек |
| 9 | `/api/crypto/whale-moves?min_usdc=1000` | GET | Големи USDC трансфери (whale tracking) | Base RPC | 30 сек |
| 10 | `/api/crypto/bridge-volume` | GET | Cross-chain bridge volume to/from Base | DefiLlama | 30 мин |

### 🟢 Безплатни freemium endpoints (2)

| Endpoint | Метод | Описание |
|---|---|---|
| `/api/crypto/token-prices?tokens=ETH,USDC` | GET | Реални token prices + 24h change + market cap (CoinGecko) |
| `/api/crypto/gas-oracle` | GET | Текущ Base gas price + tx cost estimates |

### 🔵 Безплатни service endpoints (8+)

| Endpoint | Метод | Описание |
|---|---|---|
| `/api` | GET | Service metadata + pricing + endpoint list |
| `/api/health` | GET | Live status + current Base block number |
| `/api/pricing` | GET | Transparent pricing: trial credits, volume discount, referral |
| `/api/stats` | GET | API usage statistics |
| `/api/stats/public` | GET | Публични anonymized revenue stats |
| `/api/sales/recent` | GET | Последни продажби (audit log) |
| `/api/credits?address=0x...` | GET | Проверка на кредити за wallet |
| `/api/openapi.json` | GET | OpenAPI 3.1 spec с x402 metadata |
| `/api/agent/intelligence` | GET | Autonomous Intelligence Report (engine data) |
| `/api/agent/recommendations` | GET | AI Recommendations |

### 🔴 AI & Discovery endpoints

| Endpoint | Описание |
|---|---|
| `/api/ai/insights` | AI-генерирани бизнес insights |
| `/api/ai/competitors` (POST) | Ръчно стартиране на AI competitor анализ |
| `/api/cron/daily-analysis` | Vercel Cron — всеки ден 09:00 UTC |
| `/mcp` | MCP manifest за Claude/Cursor/Windsurf |
| `/openapi.json` | Root OpenAPI (за x402scan discovery) |
| `/.well-known/x402.json` | x402 discovery document (canonical) |
| `/.well-known/ai-plugin.json` | ChatGPT plugin manifest |
| `/agents.txt` | AI crawler инструкции |
| `/agents.json` | AI agent discovery (structured) |
| `/llms.txt` | LLM-readable описание на API-то |
| `/api/badge` | Live SVG статус badge |
| `/api/sales/webhook` (POST) | Webhook регистрация за sale notifications |

### Как да извикаш платен endpoint (3 стъпки)

```bash
# Стъпка 1: Discover — викаш endpoint без payment header
curl https://kristo-intelligence.vercel.app/api/defi/yields
# → HTTP 402 + payment instructions (amount, wallet, chain)

# Стъпка 2: Pay — пращаш 0.10 USDC на Base към payTo адреса
# (през твоя wallet или AI agent framework)

# Стъпка 3: Redeem — retry със X-PAYMENT header съдържащ tx hash
curl -H "X-PAYMENT: <tx_hash>" https://kristo-intelligence.vercel.app/api/defi/yields
# → HTTP 200 + JSON данни
```

### Trial credits (безплатни calls)

```bash
# Първите 10 calls са БЕЗПЛАТНИ за нов wallet
curl -H "X-TRIAL-WALLET: 0xYourWalletAddress" \
  https://kristo-intelligence.vercel.app/api/defi/yields
# → HTTP 200 + JSON (без плащане, ако credits > 0)
```

---

## 4. x402 Плащания

### Параметри

| Параметър | Стойност |
|---|---|
| Протокол | x402 v2 (с v1 backwards compat) |
| Мрежа | Base (Chain ID 8453) |
| Актив | USDC |
| USDC адрес | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |
| Цена на call | 0.10 USDC (= 100000 raw units) |
| Pay-to адрес | `0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f` |
| Trial credits | 10 безплатни calls за нов wallet |
| Volume discount | След 50 calls → 0.15 USDC/call ⚠️ *(виж бележката)* |
| Referral bonus | 20% от първата покупка на реферал |

> ⚠️ **Бележка:** В кода `VOLUME_DISCOUNT_PRICE` е 0.15 (по-високо от стандартната цена 0.10), което е логическа грешка — трябва да е по-ниско (напр. 0.05). Това е pending fix.

### x402 v2 Response (когато няма плащане)

```json
{
  "x402Version": 2,
  "error": "Payment required...",
  "resource": {
    "url": "https://kristo-intelligence.vercel.app/api/defi/yields",
    "description": "Top 10 Base-chain DeFi yield pools by TVL",
    "mimeType": "application/json",
    "serviceName": "Kristo Intelligence",
    "tags": ["defi", "base", "crypto", "ai-agents"]
  },
  "accepts": [{
    "scheme": "exact",
    "network": "eip155:8453",
    "amount": "100000",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "payTo": "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f",
    "maxTimeoutSeconds": 60,
    "extra": { "name": "USDC", "version": "2" }
  }]
}
```

### Security

- **Replay protection**: DB UNIQUE constraint на `txHash` (атомарен, race-safe)
- **Strict amount**: Точно 100000 raw units (0.10 USDC) — отхвърля partial/overpayment
- **On-chain verification**: Проверява receipt status, Transfer event, recipient, amount
- **Rate limiting**: 60 RPM per IP + burst 10 (token bucket)
- **Credit/refund**: Автоматичен credit при data fetch failure (90 дни валидност)

---

## 5. Автономни Workflows (5 активни)

Всички workflows са създадени в Base44 и работят 24/7:

| # | Workflow | Честота | Какво прави |
|---|----------|---------|------------|
| 1 | **Kristo Keepalive Ping** | На 10 мин | Пингва `/api/health` за да държи Vercel активен |
| 2 | **Kristo Intelligence Report** | На 6 часа | Fetch-ва sales/intelligence данни и праща summary на Dimitri |
| 3 | **Kristo Market Scan** | На 6 часа | Web search за x402 новини, Base DeFi trends, конкуренти + API health check + отчет на Dimitri |
| 4 | **Kristo Social Post** | Дневно (10:00 Sofia) | Взима живи данни от API endpoints (gas, prices, yields) + подготвя 2 варианта за социален пост (Twitter + Reddit) |
| 5 | **Kristo Innovation Check** | Седмично (понеделник 09:00) | Анализира competitor landscape и предлага нови endpoints/функции |

### Какво генерират workflow-ите

- **Market Scan**: Реални x402 новини + competitor цени + Base DeFi trends + API статус (block number)
- **Social Post**: Data-backed постове с реални gas/price/yield данни от API-то (не фалшиви)
- **Innovation Check**: 3 конкретни идеи за нови endpoints с data source и difficulty
- **Intelligence Report**: Sales stats (0 засега), recommendations, pricing insights

---

## 6. AI Мониторинг система

### Как работи

1. **Vercel Cron** се пуска всеки ден в 09:00 UTC
2. Системата чете текущите stats (revenue, sales, customers)
3. Опитва LLM анализ (z-ai-web-dev-sdk)
4. Ако LLM не е достъпен → използва rule-based fallback
5. Генерира 3-5 insights (pricing, opportunities, competitor analysis)
6. Записва ги в `AIInsight` таблица със status "new"
7. Операторът ги преглежда в dashboard-а

### Rule-based insights (fallback)

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

## 7. Telegram Bot (@kristo_intelligence_bot)

| Функция | Тип | Цена |
|---|---|---|
| Token prices (ETH, USDC, всякакъв Base token) | Безплатно | $0 |
| Gas oracle | Безплатно | $0 |
| Token security scanner (rug-pull/honeypot) | Платено | 0.10 USDC |
| Wallet profiling | Платено | 0.10 USDC |
| Whale moves tracker | Платено | 0.10 USDC |

**Хостинг**: Render (background worker), environment variable `TELEGRAM_BOT_TOKEN`
**API base**: `https://kristo-intelligence.vercel.app`

Bot-ът служи като **freemium acquisition funnel** — дава безплатни prices/gas за да привлече потребители, които после могат да платят за premium анализ.

---

## 8. Маркетинг деятельности (извършени)

### Reddit
- ✅ Пост в **r/defi** — публикуван (премина self-promotion warning)
- ⏳ Пост в **r/BASEchain** — approval request изпратен (pending moderator review)
- 📋 Планирано: коментари в съществуващи r/defi дискусии

### Social Media
- 📋 Twitter/X пост — drafted (с реални API данни), не е публикуван още
- 📋 Reddit/HackerNews "Show HN" пост — drafted
- 📋 Base Discord (#dev / #build channel) — planned

### Discovery Platforms
- ✅ **awesome-x402 GitHub repo** — PR #1081 submitted
- ⏳ **x402scan.com** — регистрация планирана, не е направена
- ⏳ **MCP Directory (Smithery.ai)** — регистрация планирана
- ⏳ **MCP Directory (Glama.ai)** — регистрация планирана

### Marketing Toolkit
- 📄 Създаден `marketing/posts.md` с готови постове за Reddit, Discord, Twitter, HackerNews, Telegram

---

## 9. Статус (към 4 август 2026)

### Продажби
- **0 платени calls**
- **0 USDC приходи**
- **0 уникални wallet-и**
- **Engine status**: warming_up

### Конкуренти (според Market Scan)

| Конкурент | Цена/call | Забележка |
|---|---|---|
| Poncho (tryponcho.io) | $0.001–$0.005 | DNS грешка при последна проверка |
| CoinGecko x402 | $0.01 | Популярен и trusted |
| OpenWeb Ninja | $0.003–$0.005 | 40+ endpoints |
| x402scan.com median | ~$0.001 | 700+ APIs регистрирани |

**Позициониране**: Kristo е на $0.10/call = premium за DeFi специализация. Общите data endpoints на пазара са $0.001–$0.01.

### Препоръки от Market Scan workflow

1. **Регистрирай се в x402scan.com** (10 мин) — главния marketplace за AI agent discovery
2. **Регистрирай MCP manifest в Smithery/Glama** — Claude AI ще те открие автоматично
3. **Fix x402.json** — цената показва 0.01, кода има 0.10 (несъответствие)
4. **Twitter/X пост** с реални данни от API-то
5. **Тест с 3-5 реални разработчици** преди добавяне на нови endpoints

---

## 10. Discovery Files (за AI agent discovery)

| File | Път | Предназначение |
|---|---|---|
| x402 manifest | `/.well-known/x402.json` | x402scan discovery + агентско намиране |
| MCP manifest | `/mcp` | Claude/Cursor/Windsurf integration |
| OpenAPI spec | `/api/openapi.json` | Standard API документация |
| AI plugin | `/.well-known/ai-plugin.json` | ChatGPT plugin |
| Agents.txt | `/agents.txt` | AI crawler инструкции |
| Agents.json | `/agents.json` | Structured AI agent discovery |
| LLMs.txt | `/llms.txt` | LLM-readable описание на цялото API |
| Badge | `/api/badge` | Live SVG статус badge (за README/website) |

---

## 11. Архитектура (визуално)

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (Production)                       │
│  https://kristo-intelligence.vercel.app                      │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │  Dashboard   │  │   API Routes│  │  AI Monitor │         │
│  │  (Next.js)   │  │  (20+ routes)│  │  (Cron 9AM) │         │
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

┌─────────────────────────────────────────────────────┐
│                  Render (Telegram Bot)              │
│  @kristo_intelligence_bot                            │
│  Background worker — calls Vercel API                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              Base44 Superagent (Elio)                │
│  5 scheduled workflows — 24/7 autonomous monitoring  │
│  Market Scan · Social Post · Innovation Check ·      │
│  Intelligence Report · Keepalive Ping                │
└─────────────────────────────────────────────────────┘
```

---

## 12. Бърз quick-start

### Провери дали API-то е живо
```bash
curl https://kristo-intelligence.vercel.app/api/health
```

### Безплатни token prices
```bash
curl "https://kristo-intelligence.vercel.app/api/crypto/token-prices?tokens=ETH,USDC"
```

### Безплатен gas oracle
```bash
curl https://kristo-intelligence.vercel.app/api/crypto/gas-oracle
```

### Trial credit (10 безплатни calls)
```bash
curl -H "X-TRIAL-WALLET: 0xYourWallet" \
  https://kristo-intelligence.vercel.app/api/defi/yields
```

### Платен call (x402 flow)
```bash
# 1. Discover
curl https://kristo-intelligence.vercel.app/api/crypto/whale-moves
# → 402 + payment instructions

# 2. Pay 0.10 USDC on Base to 0xd4cd...d88f

# 3. Redeem
curl -H "X-PAYMENT: <tx_hash>" \
  https://kristo-intelligence.vercel.app/api/crypto/whale-moves
```

### Виж всички endpoints + цени
```bash
curl https://kristo-intelligence.vercel.app/api
curl https://kristo-intelligence.vercel.app/api/pricing
```

### OpenAPI spec
```bash
curl https://kristo-intelligence.vercel.app/api/openapi.json
```

### MCP за Claude/Cursor
```
MCP endpoint: https://kristo-intelligence.vercel.app/mcp
```

---

## 13. Pending задачи

| # | Задача | Приоритет | Време |
|---|--------|-----------|-------|
| 1 | Регистрация в x402scan.com | 🔴 Критичен | 10 мин |
| 2 | Регистрация в MCP Smithery | 🔴 Критичен | 15 мин |
| 3 | Регистрация в MCP Glama | 🟡 Висок | 15 мин |
| 4 | Fix x402.json (цена 0.01 → 0.10) | 🔴 Критичен | 5 мин |
| 5 | Fix VOLUME_DISCOUNT_PRICE (0.15 → 0.05) | 🟡 Висок | 5 мин |
| 6 | Twitter/X пост с реални данни | 🟡 Висок | 5 мин |
| 7 | Reddit r/BASEchain follow-up (moderator) | 🟡 Среден | 5 мин |
| 8 | Base Discord пост | 🟢 Нисък | 10 мин |
| 9 | Покани 3-5 разработчици за тест | 🟡 Висок | 1 ден |

---

*Документ създаден на 4 август 2026 от Elio (Base44 Superagent) за Dimitri Hristov.*
*Този документ обобщава цялата работа по Kristo Intelligence API от 26 юли до 4 август 2026.*
