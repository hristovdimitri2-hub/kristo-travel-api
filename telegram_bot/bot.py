#!/usr/bin/env python3
"""
Kristo Intelligence Telegram Bot
Freemium funnel — free basic info, premium DeFi intelligence via x402 API.

Free commands:
  /start     — Welcome + menu
  /price     — Token prices (ETH, USDC, WETH, BASE)
  /gas       — Base gas oracle
  /help      — All commands

Premium commands (show preview + payment link):
  /scan <address>  — Rug-pull & honeypot detection (0.10 USDC)
  /yields          — Top 10 Base DeFi yield pools (0.10 USDC)
  /whales          — Large USDC transfers on Base (0.10 USDC)
  /wallet <addr>   — Wallet profile analysis (0.10 USDC)
  /lending         — Best lending/borrowing rates (0.10 USDC)
  /dex             — Top DEX liquidity pools (0.10 USDC)
  /safety          — Protocol safety scores (0.10 USDC)
  /launches        — Recently launched tokens (0.10 USDC)
  /tvl             — Biggest TVL movers (0.10 USDC)
  /bridge          — Cross-chain bridge volume (0.10 USDC)
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
PRICE_USDC = "0.25"

logging.basicConfig(
    format="%(asctime)s — %(name)s — %(levelname)s — %(message)s",
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ============ API CLIENT ============
async def api_get(endpoint: str, params: dict = None) -> dict:
    """Call Kristo API. Returns data or payment-required info."""
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(f"{API_BASE}{endpoint}", params=params)
        if res.status_code == 402:
            return {"payment_required": True, "raw": res.json()}
        if res.status_code == 200:
            return {"payment_required": False, "data": res.json()}
        return {"payment_required": False, "error": f"HTTP {res.status_code}", "raw": res.text[:200]}

# ============ FORMATTERS ============
def fmt_price(data: dict) -> str:
    prices = data.get("prices", [])
    if not prices:
        return "❌ Няма данни за цени в момента."
    lines = ["💰 **Текущи цени**\n"]
    for p in prices:
        sym = p.get("symbol", "?")
        price = p.get("price_usd", 0)
        chg = p.get("change_24h")
        chg_str = f" ({chg:+.2f}%)" if chg is not None else ""
        lines.append(f"  **{sym}**: ${price:,.2f}{chg_str}")
    src = data.get("source", "")
    lines.append(f"\n_Източник: {src}_")
    return "\n".join(lines)

def fmt_gas(data: dict) -> str:
    lines = ["⛽ **Base Gas Oracle**\n"]
    gas = data.get("gas_price_gwei", data.get("gwei", "?"))
    lines.append(f"  Текущ: **{gas} gwei**")
    if "estimated_costs" in data:
        lines.append("\n**Оценки за транзакции:**")
        for tx_type, cost in data["estimated_costs"].items():
            lines.append(f"  {tx_type}: {cost}")
    return "\n".join(lines)

def fmt_payment_message(endpoint_name: str) -> str:
    return (
        f"🔒 **{endpoint_name}** — Платена функция\n\n"
        f"Цена: **{PRICE_USDC} USDC** на Base\n"
        f"Адрес за плащане: `{PAYMENT_WALLET}`\n\n"
        f"**Как да платите:**\n"
        f"1. Пратете {PRICE_USDC} USDC на адреса горе (Base mainnet)\n"
        f"2. Копирайте transaction hash-а\n"
        f"3. Отворете линка по-долу и добавете tx hash-а\n\n"
        f" Или използвайте директно API-то:\n"
        f"{API_BASE}{endpoint_name}\n\n"
        f"💎 *Първите 3 calls са БЕЗПЛАТНИ за нови wallets!*"
    )

def fmt_scan_preview(data: dict, address: str) -> str:
    if "payment_required" in data:
        return fmt_payment_message("/crypto/token-security")
    result = data.get("data", data)
    lines = [f"🛡️ **Security Scan: `{address[:10]}...{address[-6:]}`**\n"]
    
    is_safe = result.get("is_safe")
    if is_safe is not None:
        emoji = "✅" if is_safe else "⚠️"
        lines.append(f"{emoji} Safe: **{is_safe}**")
    
    risk_score = result.get("risk_score")
    if risk_score is not None:
        level = "🟢 Нисък" if risk_score < 30 else "🟡 Среден" if risk_score < 70 else "🔴 Висок"
        lines.append(f"Risk Score: **{risk_score}/100** ({level})")
    
    honeypot = result.get("is_honeypot_suspected")
    if honeypot is not None:
        emoji = "✅" if not honeypot else "🚨"
        lines.append(f"{emoji} Honeypot: **{honeypot}**")
    
    factors = result.get("risk_factors", [])
    if factors:
        lines.append("\n**Risk Factors:**")
        for f in factors[:5]:
            lines.append(f"  • {f}")
    
    rec = result.get("recommendation")
    if rec:
        lines.append(f"\n💡 **{rec}**")
    
    return "\n".join(lines) if len(lines) > 1 else "Няма данни."

def fmt_yields(data: dict) -> str:
    pools = data.get("pools", data.get("data", []))
    if not pools:
        return "❌ Няма данни за yield pools."
    lines = ["📈 **Top Base DeFi Yields**\n"]
    for i, p in enumerate(pools[:10], 1):
        name = p.get("pool_name", p.get("name", "?"))
        proto = p.get("protocol", "?")
        apy = p.get("apy", 0)
        tvl = p.get("tvl", 0)
        lines.append(f"{i}. **{name}** ({proto})")
        lines.append(f"   APY: {apy:.2f}% | TVL: ${tvl:,.0f}\n")
    return "\n".join(lines)

def fmt_whales(data: dict) -> str:
    moves = data.get("transfers", data.get("moves", data.get("data", [])))
    if not moves:
        return "❌ Няма whale movements в момента."
    lines = ["🐋 **Whale USDC Transfers on Base**\n"]
    for m in moves[:10]:
        frm = m.get("from", "?")[:10]
        to = m.get("to", "?")[:10]
        amt = m.get("amount", 0)
        lines.append(f"  💸 {frm}...→{to}... | **${amt:,.0f}** USDC")
    return "\n".join(lines)

def fmt_wallet(data: dict) -> str:
    result = data.get("data", data)
    lines = ["👤 **Wallet Profile**\n"]
    classification = result.get("classification", result.get("type", "?"))
    lines.append(f"Тип: **{classification}**")
    balance = result.get("balance_usd", result.get("balance", 0))
    lines.append(f"Баланс: ${balance:,.2f}")
    tx_count = result.get("transaction_count", result.get("tx_count", 0))
    lines.append(f"Транзакции: {tx_count}")
    return "\n".join(lines)

# ============ KEYBOARDS ============
def main_menu() -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("💰 Цени", callback_data="price"),
         InlineKeyboardButton("⛽ Gas", callback_data="gas")],
        [InlineKeyboardButton("🛡️ Token Scanner", callback_data="scan_info"),
         InlineKeyboardButton("📈 Yields", callback_data="yields_info")],
        [InlineKeyboardButton("🐋 Whales", callback_data="whales_info"),
         InlineKeyboardButton("👤 Wallet", callback_data="wallet_info")],
        [InlineKeyboardButton("📊 Всички команди", callback_data="help")]
    ]
    return InlineKeyboardMarkup(keyboard)

def payment_keyboard(endpoint: str) -> InlineKeyboardMarkup:
    keyboard = [
        [InlineKeyboardButton("💳 Плати през API", url=f"{API_BASE}{endpoint}")],
        [InlineKeyboardButton("📋 Копирай адрес", callback_data=f"copy_addr")],
        [InlineKeyboardButton("⬅️ Назад", callback_data="menu")]
    ]
    return InlineKeyboardMarkup(keyboard)

# ============ HANDLERS ============
async def cmd_start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    welcome = (
        "👋 **Добре дошли в Kristo Intelligence!**\n\n"
        "Вашият DeFi асистент за Base blockchain.\n\n"
        "**Безплатно:**\n"
        "  💰 Цени на токени (/price)\n"
        "  ⛽ Gas prices (/gas)\n\n"
        "**Платено (0.10 USDC/call):**\n"
        "  🛡️ Token scanner — rug-pull detection\n"
        "  📈 DeFi yields — топ pools по TVL\n"
        "  🐋 Whale moves — големи USDC трансфери\n"
        "  👤 Wallet profile — анализ на wallet\n\n"
        f"💎 Първите 3 calls са БЕЗПЛАТНИ!\n"
        f"💳 Плащане: {PRICE_USDC} USDC на Base mainnet"
    )
    await update.message.reply_text(welcome, parse_mode="Markdown", reply_markup=main_menu())

async def cmd_help(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    help_text = (
        "**Команди:**\n\n"
        "🆓 **Безплатни:**\n"
        "/price — Цени на токени\n"
        "/gas — Base gas oracle\n\n"
        "💎 **Платени (0.10 USDC):**\n"
        "/scan <address> — Rug-pull скенер\n"
        "/yields — DeFi yield pools\n"
        "/whales — Whale трансфери\n"
        "/wallet <address> — Wallet анализ\n"
        "/lending — Lending rates\n"
        "/dex — DEX pools\n"
        "/safety — Protocol safety\n"
        "/launches — Нови токени\n"
        "/tvl — TVL movers\n"
        "/bridge — Bridge volume\n\n"
        f"💳 Адрес: `{PAYMENT_WALLET}`"
    )
    await update.message.reply_text(help_text, parse_mode="Markdown")

async def cmd_price(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/crypto/token-prices", {"tokens": "ETH,USDC,WETH,BASE"})
    if result.get("error"):
        await update.message.reply_text(f"❌ Грешка: {result['error']}")
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

async def cmd_scan(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text(
            "Използване: `/scan <token_address>`\nПример: `/scan 0x9400Ff023D92c469ECC8261552E5D8Cc021Fc09e`",
            parse_mode="Markdown"
        )
        return
    address = ctx.args[0]
    if not address.startswith("0x") or len(address) != 42:
        await update.message.reply_text("❌ Невалиден адрес. Трябва да е 42 символа, започващи с 0x.")
        return
    result = await api_get("/crypto/token-security", {"address": address})
    if result.get("payment_required"):
        text = fmt_payment_message("Token Security Scanner")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/token-security"))
    else:
        text = fmt_scan_preview(result, address)
        await update.message.reply_text(text, parse_mode="Markdown")

async def cmd_yields(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/defi/yields")
    if result.get("payment_required"):
        text = fmt_payment_message("DeFi Yield Pools")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/defi/yields"))
    else:
        text = fmt_yields(result.get("data", {}))
        await update.message.reply_text(text, parse_mode="Markdown")

async def cmd_whales(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    result = await api_get("/crypto/whale-moves")
    if result.get("payment_required"):
        text = fmt_payment_message("Whale USDC Transfers")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/whale-moves"))
    else:
        text = fmt_whales(result.get("data", {}))
        await update.message.reply_text(text, parse_mode="Markdown")

async def cmd_wallet(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    if not ctx.args:
        await update.message.reply_text("Използване: `/wallet <address>`", parse_mode="Markdown")
        return
    address = ctx.args[0]
    if not address.startswith("0x") or len(address) != 42:
        await update.message.reply_text("❌ Невалиден адрес.")
        return
    result = await api_get("/crypto/wallet-profile", {"address": address})
    if result.get("payment_required"):
        text = fmt_payment_message("Wallet Profile Analysis")
        await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard("/crypto/wallet-profile"))
    else:
        text = fmt_wallet(result)
        await update.message.reply_text(text, parse_mode="Markdown")

# Generic premium command handler
async def make_premium_handler(endpoint: str, name: str):
    async def handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
        result = await api_get(endpoint)
        if result.get("payment_required"):
            text = fmt_payment_message(name)
            await update.message.reply_text(text, parse_mode="Markdown", reply_markup=payment_keyboard(endpoint))
        elif result.get("error"):
            await update.message.reply_text(f"❌ Грешка: {result['error']}")
        else:
            await update.message.reply_text(f"```\n{json.dumps(result.get('data',{}), indent=2)[:3000]}\n```", parse_mode="Markdown")
    return handler

# ============ CALLBACK HANDLER ============
async def button_handler(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    data = query.data
    
    if data == "menu":
        await query.edit_message_text(
            "👋 **Kristo Intelligence** — Изберете:", parse_mode="Markdown",
            reply_markup=main_menu()
        )
    elif data == "price":
        result = await api_get("/crypto/token-prices", {"tokens": "ETH,USDC,WETH,BASE"})
        text = fmt_price(result.get("data", {})) if not result.get("error") else f"❌ {result['error']}"
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=main_menu())
    elif data == "gas":
        result = await api_get("/crypto/gas-oracle")
        text = fmt_gas(result.get("data", {})) if not result.get("error") else f"❌ {result['error']}"
        await query.edit_message_text(text, parse_mode="Markdown", reply_markup=main_menu())
    elif data == "scan_info":
        await query.edit_message_text(
            "🛡️ **Token Security Scanner**\n\n"
            "Проверява токени за rug-pull и honeypot рискове.\n\n"
            "Използване: `/scan <token_address>`\n\n"
            f"Цена: **{PRICE_USDC} USDC** | 🆓 3 безплатни trials",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="menu")]])
        )
    elif data == "yields_info":
        await query.edit_message_text(
            "📈 **DeFi Yield Pools**\n\n"
            "Топ 10 Base DeFi yield pools по TVL.\n\n"
            "Използване: `/yields`\n\n"
            f"Цена: **{PRICE_USDC} USDC**",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="menu")]])
        )
    elif data == "whales_info":
        await query.edit_message_text(
            "🐋 **Whale USDC Transfers**\n\n"
            "Големи USDC трансфери (>$10,000) на Base.\n\n"
            "Използване: `/whales`\n\n"
            f"Цена: **{PRICE_USDC} USDC**",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="menu")]])
        )
    elif data == "wallet_info":
        await query.edit_message_text(
            "👤 **Wallet Profile**\n\n"
            "Анализ на wallet активност и класификация.\n\n"
            "Използване: `/wallet <address>`\n\n"
            f"Цена: **{PRICE_USDC} USDC**",
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup([[InlineKeyboardButton("⬅️ Назад", callback_data="menu")]])
        )
    elif data == "help":
        await cmd_help(update, ctx)
    elif data == "copy_addr":
        await query.answer(f"Адрес: {PAYMENT_WALLET}", show_alert=True)

# ============ MAIN ============
def main():
    if not BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not set!")
        return
    
    app = Application.builder().token(BOT_TOKEN).build()
    
    # Free commands
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("price", cmd_price))
    app.add_handler(CommandHandler("gas", cmd_gas))
    
    # Premium commands
    app.add_handler(CommandHandler("scan", cmd_scan))
    app.add_handler(CommandHandler("yields", cmd_yields))
    app.add_handler(CommandHandler("whales", cmd_whales))
    app.add_handler(CommandHandler("wallet", cmd_wallet))
    app.add_handler(CommandHandler("lending", make_premium_handler("/defi/lending-rates", "Lending Rates")))
    app.add_handler(CommandHandler("dex", make_premium_handler("/defi/dex-pools", "DEX Pools")))
    app.add_handler(CommandHandler("safety", make_premium_handler("/defi/protocol-safety", "Protocol Safety")))
    app.add_handler(CommandHandler("launches", make_premium_handler("/crypto/token-launches", "Token Launches")))
    app.add_handler(CommandHandler("tvl", make_premium_handler("/defi/tvl-movers", "TVL Movers")))
    app.add_handler(CommandHandler("bridge", make_premium_handler("/crypto/bridge-volume", "Bridge Volume")))
    
    # Button callbacks
    app.add_handler(CallbackQueryHandler(button_handler))
    
    logger.info("Kristo Intelligence Bot starting...")
    app.run_polling(drop_pending_updates=True)

if __name__ == "__main__":
    main()
