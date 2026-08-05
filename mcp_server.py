#!/usr/bin/env python3
"""
Kristo Intelligence MCP Server
Model Context Protocol wrapper for the Kristo Intelligence x402 API.
Compatible with Smithery.ai and Glama.ai publishing.

Transport: Streamable HTTP (deployable as web service)
"""

import json
import httpx
from mcp.server.fastmcp import FastMCP

API_BASE = "https://kristo-intelligence.vercel.app"

mcp = FastMCP(
    "kristo-intelligence",
    instructions="""Kristo Intelligence — Pay-per-call DeFi intelligence API on Base blockchain.

Paid endpoints cost 0.10 USDC per call via x402 protocol.
When you call a paid endpoint, you'll receive payment instructions.
Send 0.10 USDC on Base to the payTo address, then retry with the transaction hash.

Freemium endpoints (token-prices, gas-oracle) are free with rate limiting.
"""
)

async def call_api(endpoint: str, params: dict = None) -> dict:
    """Call the Kristo API and handle x402 payment flow."""
    url = f"{API_BASE}{endpoint}"
    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(url, params=params)
        if res.status_code == 402:
            data = res.json()
            payment_info = data.get("detail", {}).get("x402_payment_info", {})
            accepts = payment_info.get("accepts", {})
            return {
                "payment_required": True,
                "amount": f"{accepts.get('amount', '0.10')} USDC",
                "chain": "Base (8453)",
                "pay_to": accepts.get("payTo", "0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f"),
                "instructions": f"Send {accepts.get('amount', '0.10')} USDC on Base to {accepts.get('payTo', '')}, then retry with X-PAYMENT header containing the tx hash.",
                "error": data.get("detail", {}).get("error", "Payment required")
            }
        return res.json()

# ============ PAID ENDPOINTS (0.10 USDC/call) ============

@mcp.tool()
async def get_defi_yields() -> dict:
    """Get top 10 Base DeFi yield pools by TVL. Returns pool name, protocol, TVL, APY, token pairs. Costs 0.10 USDC."""
    return await call_api("/api/defi/yields")

@mcp.tool()
async def get_tvl_movers() -> dict:
    """Get Base protocols with biggest 1-day TVL changes. Returns protocol, TVL, 24h change %, category. Costs 0.10 USDC."""
    return await call_api("/api/defi/tvl-movers")

@mcp.tool()
async def get_lending_rates() -> dict:
    """Get best lending and borrowing rates on Base (Aave v3, Moonwell, Morpho). Costs 0.10 USDC."""
    return await call_api("/api/defi/lending-rates")

@mcp.tool()
async def get_dex_pools() -> dict:
    """Get top DEX liquidity pools on Base (Aerodrome, Uniswap v3). Returns pair, TVL, volume, fees. Costs 0.10 USDC."""
    return await call_api("/api/defi/dex-pools")

@mcp.tool()
async def get_protocol_safety() -> dict:
    """Get risk scores for Base DeFi protocols. Returns protocol, risk score (0-100), risk level, audit status. Costs 0.10 USDC."""
    return await call_api("/api/defi/protocol-safety")

@mcp.tool()
async def get_token_launches() -> dict:
    """Get recently launched tokens on Base. Returns token address, name, symbol, launch date, initial liquidity. Costs 0.10 USDC."""
    return await call_api("/api/crypto/token-launches")

@mcp.tool()
async def scan_token_security(address: str) -> dict:
    """Scan a token for rug-pull and honeypot risks. Returns is_safe, is_honeypot_suspected, risk_score (0-100), risk_factors, and buy/avoid recommendation. Costs 0.10 USDC.
    
    Args:
        address: Token contract address on Base (0x...)
    """
    return await call_api("/api/crypto/token-security", {"address": address})

@mcp.tool()
async def get_wallet_profile(address: str) -> dict:
    """Analyze a wallet's on-chain activity and classify it (whale/dolphin/minnow/OG/new). Returns balance, tx count, DeFi activity. Costs 0.10 USDC.
    
    Args:
        address: Wallet address on Base (0x...)
    """
    return await call_api("/api/crypto/wallet-profile", {"address": address})

@mcp.tool()
async def get_whale_moves() -> dict:
    """Get recent large USDC transfers on Base (>$10,000). Returns from/to addresses, amount, tx hash. Costs 0.10 USDC."""
    return await call_api("/api/crypto/whale-moves")

@mcp.tool()
async def get_bridge_volume() -> dict:
    """Get cross-chain bridge volume to/from Base. Returns total volume, chain breakdown, bridge protocol data. Costs 0.10 USDC."""
    return await call_api("/api/crypto/bridge-volume")

# ============ FREEMIUM ENDPOINTS (free) ============

@mcp.tool()
async def get_token_prices(tokens: str = "ETH,USDC,WETH,BASE") -> dict:
    """Get real-time token prices (freemium — free with rate limiting). Returns price, 24h change, market cap.
    
    Args:
        tokens: Comma-separated token symbols (e.g. ETH,USDC,WETH,BASE,AERO)
    """
    return await call_api("/api/crypto/token-prices", {"tokens": tokens})

@mcp.tool()
async def get_gas_oracle() -> dict:
    """Get Base gas price estimates (freemium — free). Returns current gas in gwei/wei and estimated costs for common tx types."""
    return await call_api("/api/crypto/gas-oracle")

# ============ FREE ENDPOINTS ============

@mcp.tool()
async def get_intelligence_report() -> dict:
    """Get the latest autonomous intelligence report — sales analysis, market trends, pricing recommendations. Free."""
    return await call_api("/api/agent/intelligence")

@mcp.tool()
async def get_api_stats() -> dict:
    """Get public API usage statistics — total calls, revenue, unique wallets. Free."""
    return await call_api("/api/stats")

@mcp.tool()
async def get_pricing_info() -> dict:
    """Get detailed pricing information including trial credits, volume discounts, and referral program. Free."""
    return await call_api("/api/pricing")

if __name__ == "__main__":
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8001)
