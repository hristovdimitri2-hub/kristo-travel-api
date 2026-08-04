import {
  WALLET_ADDRESS,
  USDC_ADDRESS,
  CHAIN_ID,
  PRICE_USDC,
  PRICE_RAW,
  TRIAL_CREDITS,
  VOLUME_DISCOUNT_THRESHOLD,
  VOLUME_DISCOUNT_PRICE_RAW,
} from '@/app/lib/config';

export const dynamic = 'force-static';

export async function GET() {
  const content = `# Kristo Intelligence AI Agent Discovery (agents.txt)

AGENT-NAME: Kristo Intelligence
SERVICE: Base-chain DeFi & On-Chain Intelligence API
VERSION: 5.0.0
BASE_URL: https://kristo-intelligence.vercel.app
MANIFEST: https://kristo-intelligence.vercel.app/.well-known/x402.json
OPENAPI: https://kristo-intelligence.vercel.app/openapi.json
MCP_SERVER: https://kristo-intelligence.vercel.app/mcp

## PAYMENT PROTOCOL
SCHEME: x402 (HTTP 402 Payment Required)
NETWORK: base
CHAIN_ID: ${CHAIN_ID}
ASSET: USDC
ASSET_CONTRACT: ${USDC_ADDRESS}
RECIPIENT: ${WALLET_ADDRESS}
PRICE_PER_CALL: ${PRICE_USDC.toFixed(2)} USDC (${PRICE_RAW} raw units, 6 decimals)
TRIAL_CREDITS: ${TRIAL_CREDITS} per wallet (X-TRIAL-WALLET header)
VOLUME_DISCOUNT: ${VOLUME_DISCOUNT_THRESHOLD}+ calls -> 0.05 USDC (${VOLUME_DISCOUNT_PRICE_RAW} raw)

## PAYMENT FLOW FOR AGENTS
1. Issue GET request to desired paid endpoint.
2. If unauthenticated, server responds with HTTP 402 Payment Required and payment headers.
3. Send ${PRICE_USDC.toFixed(2)} USDC on Base (Chain ID ${CHAIN_ID}) to recipient address: ${WALLET_ADDRESS}.
4. Retry request with header: X-PAYMENT: <tx_hash>
5. Alternatively, supply header X-TRIAL-WALLET: <your_wallet_address> for ${TRIAL_CREDITS} trial credits.
6. Alternatively, add query parameter ?demo=true to receive sample data without payment.

## ENDPOINTS DIRECTORY

### Paid Endpoints (0.10 USDC per call)
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

### Freemium Endpoints
- /api/crypto/token-prices: Real-time token prices from CoinGecko
- /api/crypto/gas-oracle: Base gas price estimates

### Free Endpoints
- /api/health: API health check and Web3 connectivity status
- /api/stats/public: Public usage statistics
- /api/sales/recent: Recent verified x402 sales logs
- /api/credits: Check trial and promo credit balance
`;

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
