# Kristo Intelligence — Документи за код-ревю

Тези 3 документа са подготвени за код-ревю (заявени от Qwen3.8-Max-Preview анализа).

## Съдържание

1. **1_x402_handler.py** — конфигурацията + x402 payment-required response генератора (главния handler логика)
2. **2_payment_verify.py** — пълната `verify_payment()` функция — проверява on-chain плащания, replay protection, tx hash validация
3. **discovery_docs/** — всички discovery манифести (x402.json, agents.json, llms.txt, mcp.json)

## ⚠️ ВАЖНО — намерени и оправени грешки (04.08.2026)

### Грешка 1 (КРИТИЧНА): Discovery docs сочеха към мъртъв URL
`agents.json`, `llms.txt`, `mcp.json`, `mcp_server.py`, `.well-known/x402.json` — всички сочеха
към стария Render deployment (`kristo-intelligence-api.onrender.com`), не към живия Vercel URL
(`kristo-intelligence.vercel.app`). AI агенти, които откриват API-то през тези файлове, биха
получили грешен/мъртъв адрес. **ОПРАВЕНО** — всички вече сочат към Vercel.

### Грешка 2 (КРИТИЧНА): Хаос в цената — 4 различни стойности едновременно
| Файл | Цена преди фикса |
|---|---|
| `llms.txt` | 0.01 USDC |
| `agents.json` | 0.01 USDC |
| `.well-known/x402.json` | 0.01 USDC |
| `mcp.json` (tool-level) | **0.25 USDC** (!) |
| `render.yaml` (env var) | 0.10 USDC |
| `dashboard/page.tsx` (реалният UI) | 0.10 USDC |

Агент, който чете discovery docs, вижда 0.01 или 0.25 USDC. Агент, който гледа реалния
dashboard, вижда 0.10 USDC. Няма два файла със същата цена. **ОПРАВЕНО** — сега 0.10 USDC
навсякъде, последователно.

### Грешка 3 (ФАТАЛНА): Вътрешен bug в самия payment verify код
```python
# ПРЕДИ (bug):
PRICE_USDC = float(os.getenv("PRICE_USDC", "0.10"))   # показва се на агента: 0.10
PRICE_RAW = int(os.getenv("PRICE_RAW", "10000"))       # реално проверява: 10000 raw = 0.01 USDC!

# render.yaml задава PRICE_USDC=0.10, но НИКОГА не задава PRICE_RAW —
# затова кодът пада на default "10000" = само 0.01 USDC реална проверка.
```
Тоест кодът рекламира 0.10 USDC, но `verify_payment()` фактически приема всяко плащане
над 0.01 USDC като валидно (`if raw_amount >= PRICE_RAW`). Разминаване 10x между
"рекламирана" и "реално проверена" цена в един и същ endpoint.

**ОПРАВЕНО** — PRICE_RAW вече винаги се извлича от PRICE_USDC (`PRICE_RAW = round(PRICE_USDC * 1_000_000)`),
никога независим env var, така че двете стойности вече физически не могат да се разминат.

### Грешка 4: VOLUME_DISCOUNT_PRICE беше по-висока от базовата цена
`VOLUME_DISCOUNT_PRICE=0.15` (default) > `PRICE_USDC=0.10` — "отстъпка", която е по-скъпа от
нормалната цена. **ОПРАВЕНО** — сега 0.05 (под базовата, както трябва да е отстъпка).

## Защо това обяснява 0 продажби

0 уникални wallet-и означава проблемът е в **discovery**, не в конверсията:
1. Никой AI агент не намира API-то през x402scan/MCP директории (не сме регистрирани там)
2. Дори да го намери през discovery файловете — получава грешен URL (мъртъв Render) или грешна цена
3. Дори да плати правилно — вътрешният бъг означава несъответствие между реклама и реалност,
   което би отблъснало агенти, правещи strict price validation

Всичко по-горе вече е оправено и push-нато в GitHub (commit виж git log).
