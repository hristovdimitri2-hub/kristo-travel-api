import {
  WALLET_ADDRESS,
  USDC_ADDRESS,
  CHAIN_ID,
  PRICE_USDC,
  PRICE_RAW,
  TRIAL_CREDITS,
} from '@/app/lib/config';

export const dynamic = 'force-static';

export async function GET() {
  const content = `# Kristo Intelligence API

Base-chain DeFi & on-chain intelligence for AI agents

Base URL: https://kristo-intelligence.vercel.app

## Overview
Kristo Intelligence is a pay-per-call API service providing real-time Base-chain DeFi & on-chain intelligence for AI agents.

## Pricing & Payment
- Price: ${PRICE_USDC.toFixed(2)} USDC per call (${PRICE_RAW} raw USDC units, 6 decimals)
- Payment: x402 protocol on Base (chain ${CHAIN_ID}). Send USDC to ${WALLET_ADDRESS}, retry with X-PAYMENT header
- Token Contract: ${USDC_ADDRESS}
- Trial: ${TRIAL_CREDITS} free credits per wallet (X-TRIAL-WALLET header)
- Demo: Add ?demo=true for sample data without payment

## Paid Endpoints (0.10 USDC / call)
- /api/defi/yields: Top Base DeFi yield pools
- /api/defi/tvl-movers: Base protocols with biggest 1-day TVL changes
- /api/defi/lending-rates: Best lending and borrowing rates on Base
- /api/defi/dex-pools: Top DEX liquidity pools on Base
- /api/defi/protocol-safety: Risk scores for Base DeFi protocols
- /api/crypto/token-launches: Recently launched tokens on Base
- /api/crypto/token-security: Token security scanner (rug-pull & honeypot detection)
- /api/crypto/wallet-profile: On-chain wallet analysis & profiling
- /api/crypto/whale-moves: Large USDC transfers on Base
- /api/crypto/bridge-volume: Cross-chain bridge volume to/from Base

## Freemium Endpoints
- /api/crypto/token-prices: Real-time token prices from CoinGecko
- /api/crypto/gas-oracle: Base gas price estimates and transaction costs

## Free Endpoints
- /api/health: API health check and Web3 connectivity status
- /api/stats/public: Public API usage statistics
- /api/sales/recent: Recent sales and transaction log
- /api/credits: Check wallet trial credits and balance
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
