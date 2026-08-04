#!/usr/bin/env python3
"""
Kristo Intelligence Telegram Bot v5.0
Freemium funnel — free basic info, premium DeFi intelligence via x402 API.

Synced with v5.0 API: https://kristo-intelligence.vercel.app
8 paid endpoints, 7 free endpoints.

Free commands:
  /start     — Welcome + menu
  /price     — Token prices (ETH, USDC, WETH, BASE)
  /gas       — Base gas oracle
  /nft       — NFT floor prices on Base
  /airdrops  — Active airdrop campaigns
  /health    — API status
  /help      — All commands

Premium commands (0.10 USDC/call via x402):
  /yields          — Top 10 Base DeFi yield pools
  /tvl             — Biggest TVL movers on Base
  /whales          — Large USDC transfers (whale tracking)
  /wallet <addr>   — Wallet profile analysis
"""

import os
import json
import logging
import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application, CommandHandler, CallbackQueryHandler,
    ContextTypes
)

# ============ CONFIG ============
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
API_BASE = os.getenv("API_BASE", "https://kristo-intelligence.vercel.app")
PAYMENT_WALLET = "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"
PRICE_USDC = "0.10"

logging.basicConfig(
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ============ API CLIENT ============
async def api_get(endpoint: str, params: dict = None) -> dict:
    """Call Kristo v5.0 API. Returns data or payment-required info."""
    url = f"{API_BASE}/api{endpoint}"
    async with httpx.AsyncClient(timeout=20.0) as client:
        res = await client.get(url, params=params)
        if res.status_code == 402:
            return {"payment_required": True, "raw": res.json()}
        if res.status_code == 200:
            return {"payment_required": False, "data": res.json()}
        return {"payment_required": False, "error": f"HTTP {res.status_code}", "raw": res.text[:200]}

# ============ FORMATTERS ============
def fmt_price(data: dict) -> str:
    """Format token prices from v5.0 /api/crypto/token-prices"""
    tokens = data.get("tokens", data.get("prices", []))
    if not tokens:
        return "❌ Няма данни за цени в момента."
    lines = ["💰 **Текущи цени**\n"]
    for t in tokens:
        sym = t.get("symbol", "?")
        price = t.get("price_usd", t.get("price", 0))
        chg = t.get("change_24h", t.get("price_change_24h"))
        mcap = t.get("market_cap")
        chg_str = f" ({chg:+.2f}%)" if chg is not None else ""
        lines.append(f"  **{sym}**: ${price:,.4f}{chg_str}")
        if mcap:
            lines.append(f"    Market Cap: ${mcap:,.0f}")
    src = data.get("source", data.get("data_source", ""))
    if src:
        lines.append(f"\n_Източник: {src}_")
    return "\n".join(lines)

def fmt_gas(data: dict) -> str:
    """Format gas oracle from v5.0 /api/crypto/gas-oracle"""
    lines = ["⛽ **Base Gas Oracle**\n"]
    gas = data.get("gas_price_gwei", data.get("gwei", "?"))
    lines.append(f"  Текущ: **{gas} gwei**")
    costs = data.get("estimated_costs_gwei", data.get("estimated_costs", {}))
    if costs:
        lines.append("\n**Оценки за транзакции:**")
        for tx_type, cost in costs.items():
            label = tx_type.replace("_", " ").title()
            lines.append(f"  {label}: {cost} gwei")
    rec = data.get("recommendation", "")
    if rec:
        emoji = "🟢" if rec == "low" else "🟡" if rec == "medium" else "🔴"
        lines.append(f"\n{emoji} Препоръка: **{rec.upper()}**")
    return "\n".join(lines)

def fmt_yields(data: dict) -> str:
    """Format DeFi yields from v5.0 /api/defi/yields"""
    pools = data.get("top_pools_by_tvl", data.get("pools", data.get("data", [])))
    if not pools:
        return "❌ Няма данни за yield pools."
    lines = ["📈 **Top 10 Base DeFi Yields**\n"]
    for i, p in enumerate(pools[:10], 1):
        pool = p.get("pool", p.get("pool_name", p.get("name", "?")))
        proto = p.get("project", p.get("protocol", "?"))
        apy = p.get("apy_pct", p.get("apy", 0))
        tvl = p.get("tvl_usd", p.get("tvl", 0))
        lines.append(f"{i}. **{pool}** — {proto}")
        lines.append(f"   APY: {apy:.2f}% | TVL: ${tvl/1e6:,.1f}M")
    src = data.get("source", data.get("data_source", ""))
    if src:
        lines.append(f"\n_Източник: {src}_")
    return "\n".join(lines)

def fmt_tvl_movers(data: dict) -> str:
    """Format TVL movers from v5.0 /api/defi/tvl-movers"""
    movers = data.get("movers", data.get("protocols", data.get("data", [])))
    if not movers:
        return "❌ Няма данни за TVL movers."
    lines = ["📊 **Base TVL Movers**\n"]
    for m in movers[:10]:
        name = m.get("name", m.get("protocol", "?"))
        chg_1d = m.get("change_1d", m.get("tvl_change_1d", 0))
        chg_7d = m.get("change_7d", m.get("tvl_change_7d", 0))
        tvl = m.get("tvl", m.get("tvl_usd", 0))
        emoji = "📈" if chg_1d > 0 else "📉"
        lines.append(f"{emoji} **{name}**")
        lines.append(f"   TVL: ${tvl/1e6:,.1f}M | 1d: {chg_1d:+.1f}% | 7d: {chg_7d:+.1f}%")
    return "\n".join(lines)

def fmt_whales(data: dict) -> str:
    """Format whale moves from v5.0 /api/crypto/whale-moves"""
    moves = data.get("transfers", data.get("moves", data.get("data", [])))
    if not moves:
        return "❌ Няма whale movements в момента."
    lines = ["🐋 **Whale USDC Transfers on Base**\n"]
    for m in moves[:10]:
        frm = m.get("from", m.get("from_address", "?"))[:10]
        to = m.get("to", m.get("to_address", "?"))[:10]
        amt = m.get("amount", m.get("amount_usd", 0))
        lines.append(f"  💸 {frm}...→{to}...")
        lines.append(f"     **${amt:,.0f}** USDC")
    return "\n".join(lines)

def fmt_wallet(data: dict) -> str:
    """Format wallet profile from v5.0 /api/crypto/wallet-profile"""
    result = data.get("data", data)
    lines = ["👤 **Wallet Profile**\n"]
    cls = result.get("classification", result.get("type", result.get("label", "?")))
    lines.append(f"Тип: **{cls}**")
    balance = result.get("balance_usd", result.get("total_balance_usd", result.get("balance", 0)))
    lines.append(f"Баланс: ${balance:,.2f}")
    tx_count = result.get("transaction_count", result.get("tx_count", 0))
    lines.append(f"Транзакции: {tx_count}")
    risk = result.get("risk_score", result.get("risk_level"))
    if risk is not None:
        lines.append(f"Risk: {risk}")
    first_tx = result.get("first_tx_date", result.get("first_seen"))
    if first_tx:
        lines.append(f"Първа tx: {first_tx}")
    return "\n".join(lines)

def fmt_nft(data: dict) -> str:
    """Format NFT floor prices from v5.0 /api/nft/floor-prices"""
    collections = data.get("collections", data.get("data", []))
    if not collections:
        return "❌ Няма данни за NFT floor prices."
    lines = ["🎨 **Top Base NFT Floor Prices**\n"]
    for c in collections[:10]:
        name = c.get("name", c.get("collection", "?"))
        floor = c.get("floor_price", c.get("floor_price_eth", 0))
        curr = c.get("floor_price_currency", "ETH")
        vol = c.get("volume_24h", 0)
        lines.append(f"  **{name}**")
        lines.append(f"    Floor: {floor} {curr} | Vol 24h: {vol}")
    return "\n".join(lines)

def fmt_airdrops(data: dict) -> str:
    """Format airdrops from v5.0 /api/crypto/airdrop-tracker"""
    airdrops = data.get("airdrops", data.get("campaigns", data.get("data", [])))
    if not airdrops:
        return "❌ Няма активни airdrop кампании."
    lines = ["🎁 **Активни Airdrops**\n"]
    for a in airdrops[:10]:
        name = a.get("name", a.get("project", "?"))
        status = a.get("status", "?")
        deadline = a.get("deadline", a.get("end_date", "?"))
        reward = a.get("reward", a.get("estimated_value", "?"))
        lines.append(f"  **{name}** — {status}")
        if deadline:
            lines.append(f"    Deadline: {deadline}")
        if reward:
            lines.append(f"    Награда: {reward}")
    return "\n".join(lines)

def fmt_payment_message(endpoint_name: str, description: str) -> str:
    return (
        f"🔒 **{description}** — Платена функция\n\n"
        f"Цена: **{PRICE_USDC} USDC** на Base\n"
        f"Адрес за плащане: `{PAYMENT_WALLET}`\n\n"
        f"**Как да платите:**\n"
        f"1. Пратете {PRICE_USDC} USDC на адреса горе (Base mainnet)\n"
        f"2. Копирайте transaction hash-а\n"
        f"3. Отворете линка и добавете tx hash-а в X-PAYMENT header\n\n"
        f"🔗 API: {API_BASE}/api{endpoint_name}\n\n"
        f"💎 *Първите 2 calls са БЕЗПЛАТНИ (free tier)!*"
    )

# ============ KEYBOARDS ============
def main_menu() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("💰 Цени", callback_data="price"),
         InlineKeyboardButton("⛽ Gas", callback_data="gas")],
        [InlineKeyboardButton("🎨 NFT", callback_data="nft"),
         InlineKeyboardButton("🎁 Airdrops", callback_data="airdrops")],
        [InlineKeyboardButton("📈 Yields", callback_data="yields"),
         InlineKeyboardButton("📊 TVL", callback_data="tvl")],
        [InlineKeyboardButton("🐋 Whales", callback_data="whales"),
         InlineKeyboardButton("👤 Wallet", callback_data="wallet_info")],
        [InlineKeyboardButton("📊 Команди", callback_data="help")]
    ]
    return InlineKeyboardMarkup(keyboard)

def payment_keyboard(endpoint: str) -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("💳 Плати през API", url=f"{API_BASE}/api{endpoint}")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

# ============ PAID ENDPOINT DEFINITIONS ============
PAID_ENDPOINTS = {
    "yields": {"path": "/defi/yields", "desc": "Top 10 Base DeFi Yield Pools", "formatter": fmt_yields},
    "tvl": {"path": "/defi/tvl-movers", "desc": "Base TVL Movers", "formatter": fmt_tvl_movers},
    "whales": {"path": "/crypto/whale-moves?min_usdc=1000", "desc": "Whale USDC Transfers", "formatter": fmt_whales},
    "wallet": {"path": "/crypto/wallet-profile", "desc": "Wallet Profile Analysis", "formatter": fmt_wallet},
}

async def handle_paid_endpoint(update: Update, ctx, key: str, params: dict = None):
    """Handle a paid endpoint — show data if free tier, payment msg if 402."""
    ep = PAID_ENDPOINTS.get(key)
    if not ep:
        return

    result = await api_get(ep["path"], params)
    if result.get("payment_required"):
        text = fmt_payment_message(ep["path"], ep["desc"])
        kb = payment_keyboard(ep["path"])
        if update.callback_query:
            await update.callback_query.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)
        else:
            await update.message.reply_text(text, parse_mode="Markdown", reply_markup=kb)
    elif result.get("error"):
        text = f"❌ Грешка: {result['error']}"
        if update.callback_query:
            await update.callback_query.message.reply_text(text)
        else:
            await update.message.reply_text(text)
    else:
        text = ep["formatter"](result.get("data", {}))
        if update.callback_query:
            await update.callback_query.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu())
        else:
            await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu())

# ============ HANDLERS ============
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    welcome = (
        "👋 **Добре дошли в Kristo Intelligence v5.0!**\n\n"
        "Вашият DeFi асистент за Base blockchain.\n\n"
        "**🆓 Безплатно:**\n"
        "  💰 Цени на токени (/price)\n"
        "  ⛽ Gas prices (/gas)\n"
        "  🎨 NFT floor prices (/nft)\n"
        "  🎁 Airdrop tracker (/airdrops)\n\n"
        f"**💎 Платено ({PRICE_USDC} USDC/call):**\n"
        "  📈 DeFi yields — топ pools по TVL\n"
        "  📊 TVL movers — най-големи промени\n"
        "  🐋 Whale moves — големи USDC трансфери\n"
        "  👤 Wallet profile — анализ на wallet\n\n"
        f"💎 Първите 2 calls са БЕЗПЛАТНИ!\n"
        f"💳 Плащане: {PRICE_USDC} USDC на Base mainnet\n"
        f"⚙️ API: {API_BASE}"
    )
    await update.message.reply_text(welcome, parse_mode="Markdown", reply_markup=main_menu())

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "**Kristo Intelligence v5.0 — Команди**\n\n"
        "🆓 **Безплатни:**\n"
        "/price — Цени на токени\n"
        "/gas — Base gas oracle\n"
        "/nft — NFT floor prices\n"
        "/airdrops — Активни airdrops\n"
        "/health — API статус\n\n"
        f"💎 **Платени ({PRICE_USDC} USDC):**\n"
        "/yields — DeFi yield pools\n"
        "/tvl — TVL movers\n"
        "/whales — Whale трансфери\n"
        "/wallet <address> — Wallet анализ\n\n"
        f"💳 Адрес: `{PAYMENT_WALLET}`\n"
        f"⚙️ API: {API_BASE}"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")

async def cmd_price(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/crypto/token-prices", {"tokens": "ETH,USDC,WETH,BASE"})
    if result.get("error"):
        await update.message.reply_text(f"❌ Грешка: {result['error']}")
        return
    if result.get("payment_required"):
        text = fmt_payment_message("/crypto/token-prices", "Token Prices")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/token-prices"))
        return
    text = fmt_price(result.get("data", {}))
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu())

async def cmd_gas(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/crypto/gas-oracle")
    if result.get("error"):
        await update.message.reply_text(f"❌ Грешка: {result['error']}")
        return
    text = fmt_gas(result.get("data", {}))
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu())

async def cmd_nft(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/nft/floor-prices")
    if result.get("error"):
        await update.message.reply_text(f"❌ Грешка: {result['error']}")
        return
    if result.get("payment_required"):
        text = fmt_payment_message("/nft/floor-prices", "NFT Floor Prices")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/nft/floor-prices"))
        return
    text = fmt_nft(result.get("data", {}))
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu())

async def cmd_airdrops(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/crypto/airdrop-tracker")
    if result.get("error"):
        await update.message.reply_text(f"❌ Грешка: {result['error']}")
        return
    if result.get("payment_required"):
        text = fmt_payment_message("/crypto/airdrop-tracker", "Airdrop Tracker")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/airdrop-tracker"))
        return
    text = fmt_airdrops(result.get("data", {}))
    await update.message.reply_text(text, parse_mode="Markdown", reply_markup=main_menu())

async def cmd_health(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/health")
    if result.get("error"):
        await update.message.reply_text(f"❌ API е недостъпен: {result['error']}")
        return
    data = result.get("data", {})
    status = data.get("status", "?")
    block = data.get("block", data.get("current_block_number", "?"))
    web3 = data.get("web3_connected", "?")
    emoji = "🟢" if status == "online" else "🔴"
    text = f"{emoji} **Kristo Intelligence API**\n\nStatus: **{status}**\nBlock: **{block}**\nWeb3: **{web3}**"
    await update.message.reply_text(text, parse_mode="Markdown")

async def cmd_yields(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await handle_paid_endpoint(update, ctx, "yields")

async def cmd_tvl(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await handle_paid_endpoint(update, ctx, "tvl")

async def cmd_whales(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await handle_paid_endpoint(update, ctx, "whales")

async def cmd_wallet(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text(
            "Използване: `/wallet <address>`\nПример: `/wallet 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045`",
            parse_mode="Markdown"
        )
        return
    address = ctx.args[0].strip()
    if not address.startswith("0x") or len(address) != 42:
        await update.message.reply_text("❌ Невалиден Ethereum адрес. Трябва да започва с 0x и да е 42 символа.")
        return
    await handle_paid_endpoint(update, ctx, "wallet", {"address": address})

# ============ CALLBACK HANDLER ============
async def callback_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data

    if data == "menu":
        await query.message.reply_text("🏠 Меню:", reply_markup=main_menu())
    elif data == "help":
        await cmd_help(update, ctx)
    elif data == "price":
        result = await api_get("/crypto/token-prices", {"tokens": "ETH,USDC,WETH,BASE"})
        if result.get("payment_required"):
            text = fmt_payment_message("/crypto/token-prices", "Token Prices")
            await query.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/token-prices"))
        elif result.get("error"):
            await query.message.reply_text(f"❌ {result['error']}")
        else:
            await query.message.reply_text(fmt_price(result.get("data", {})), parse_mode="Markdown", reply_markup=main_menu())
    elif data == "gas":
        result = await api_get("/crypto/gas-oracle")
        if result.get("error"):
            await query.message.reply_text(f"❌ {result['error']}")
        else:
            await query.message.reply_text(fmt_gas(result.get("data", {})), parse_mode="Markdown", reply_markup=main_menu())
    elif data == "nft":
        result = await api_get("/nft/floor-prices")
        if result.get("payment_required"):
            text = fmt_payment_message("/nft/floor-prices", "NFT Floor Prices")
            await query.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/nft/floor-prices"))
        elif result.get("error"):
            await query.message.reply_text(f"❌ {result['error']}")
        else:
            await query.message.reply_text(fmt_nft(result.get("data", {})), parse_mode="Markdown", reply_markup=main_menu())
    elif data == "airdrops":
        result = await api_get("/crypto/airdrop-tracker")
        if result.get("payment_required"):
            text = fmt_payment_message("/crypto/airdrop-tracker", "Airdrop Tracker")
            await query.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/airdrop-tracker"))
        elif result.get("error"):
            await query.message.reply_text(f"❌ {result['error']}")
        else:
            await query.message.reply_text(fmt_airdrops(result.get("data", {})), parse_mode="Markdown", reply_markup=main_menu())
    elif data == "yields":
        await handle_paid_endpoint(update, ctx, "yields")
    elif data == "tvl":
        await handle_paid_endpoint(update, ctx, "tvl")
    elif data == "whales":
        await handle_paid_endpoint(update, ctx, "whales")
    elif data == "wallet_info":
        await query.message.reply_text(
            "👤 **Wallet Profile Analysis**\n\n"
            "Използвайте: `/wallet <address>`\n"
            f"Цена: {PRICE_USDC} USDC\n\n"
            "Показва:\n"
            "• Тип на wallet (retail/whale/degen)\n"
            "• Баланс на Base\n"
            "• Брой транзакции\n"
            "• Risk score",
            parse_mode="Markdown",
            reply_markup=main_menu()
        )
    elif data == "copy_addr":
        await query.message.reply_text(
            f"💳 Адрес за плащане:\n`{PAYMENT_WALLET}`\n\nСума: {PRICE_USDC} USDC на Base",
            parse_mode="Markdown"
        )

# ============ MAIN ============
def main():
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set!")
        return

    app = Application.builder().token(BOT_TOKEN).build()

    # Commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("price", cmd_price))
    app.add_handler(CommandHandler("gas", cmd_gas))
    app.add_handler(CommandHandler("nft", cmd_nft))
    app.add_handler(CommandHandler("airdrops", cmd_airdrops))
    app.add_handler(CommandHandler("health", cmd_health))
    app.add_handler(CommandHandler("yields", cmd_yields))
    app.add_handler(CommandHandler("tvl", cmd_tvl))
    app.add_handler(CommandHandler("whales", cmd_whales))
    app.add_handler(CommandHandler("wallet", cmd_wallet))

    # Callbacks
    app.add_handler(CallbackQueryHandler(callback_handler))

    logger.info(f"🚀 Kristo Intelligence Bot v5.0 starting...")
    logger.info(f"   API: {API_BASE}")
    logger.info(f"   Price: {PRICE_USDC} USDC/call")

    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == "__main__":
    main()
