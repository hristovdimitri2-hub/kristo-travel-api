import { NextResponse } from 'next/server';
import {
  WALLET_ADDRESS,
  USDC_ADDRESS,
  CHAIN_ID,
  PRICE_USDC,
} from '@/app/lib/config';

export async function GET() {
  const mcpManifest = {
    mcpServers: {
      'kristo-intelligence': {
        name: 'Kristo Intelligence',
        description:
          'Pay-per-call DeFi intelligence API for AI agents on Base blockchain. 10 paid endpoints (0.10 USDC/call) including rug-pull detection, yield pools, DEX analytics, and whale tracking. 2 freemium endpoints (token prices, gas oracle). Uses x402 HTTP 402 payment protocol with USDC micropayments.',
        version: '5.0.0',
        transport: {
          type: 'streamable-http',
          url: 'https://kristo-intelligence.vercel.app/mcp',
        },
        tools: [
          {
            name: 'get_defi_yields',
            description: 'Top 10 Base DeFi yield pools by APY and TVL',
            endpoint: 'https://kristo-intelligence.vercel.app/api/defi/yields',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'get_tvl_movers',
            description: 'Base protocols with biggest 1-day TVL changes',
            endpoint: 'https://kristo-intelligence.vercel.app/api/defi/tvl-movers',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'get_lending_rates',
            description: 'Best lending and borrowing rates on Base',
            endpoint: 'https://kristo-intelligence.vercel.app/api/defi/lending-rates',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'get_dex_pools',
            description: 'Top DEX liquidity pools on Base',
            endpoint: 'https://kristo-intelligence.vercel.app/api/defi/dex-pools',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'get_protocol_safety',
            description: 'Risk scores for Base DeFi protocols',
            endpoint: 'https://kristo-intelligence.vercel.app/api/defi/protocol-safety',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'get_token_launches',
            description: 'Recently launched tokens on Base',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/token-launches',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'scan_token_security',
            description: 'Rug-pull and honeypot detection scanner',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/token-security',
            paid: true,
            price_usdc: PRICE_USDC,
            inputSchema: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  pattern: '^0x[a-fA-F0-9]{40}$',
                  description: 'Token contract address on Base',
                },
              },
              required: ['address'],
            },
          },
          {
            name: 'get_wallet_profile',
            description: 'On-chain wallet analysis and classification',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/wallet-profile',
            paid: true,
            price_usdc: PRICE_USDC,
            inputSchema: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  pattern: '^0x[a-fA-F0-9]{40}$',
                  description: 'Wallet address to analyze',
                },
              },
              required: ['address'],
            },
          },
          {
            name: 'get_whale_moves',
            description: 'Large USDC transfers on Base',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/whale-moves',
            paid: true,
            price_usdc: PRICE_USDC,
            inputSchema: {
              type: 'object',
              properties: {
                min_usdc: {
                  type: 'number',
                  description: 'Minimum USDC transfer threshold',
                  default: 10000,
                },
              },
            },
          },
          {
            name: 'get_bridge_volume',
            description: 'Cross-chain bridge volume to/from Base',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/bridge-volume',
            paid: true,
            price_usdc: PRICE_USDC,
          },
          {
            name: 'get_token_prices',
            description: 'Real-time token prices (freemium)',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/token-prices',
            paid: false,
            inputSchema: {
              type: 'object',
              properties: {
                tokens: {
                  type: 'string',
                  description: 'Comma-separated token symbols (e.g., ETH,USDC)',
                },
              },
            },
          },
          {
            name: 'get_gas_oracle',
            description: 'Base gas price estimates (freemium)',
            endpoint: 'https://kristo-intelligence.vercel.app/api/crypto/gas-oracle',
            paid: false,
          },
          {
            name: 'get_health',
            description: 'API health check and block height',
            endpoint: 'https://kristo-intelligence.vercel.app/api/health',
            paid: false,
          },
          {
            name: 'get_stats_public',
            description: 'Public usage statistics',
            endpoint: 'https://kristo-intelligence.vercel.app/api/stats/public',
            paid: false,
          },
          {
            name: 'get_recent_sales',
            description: 'Recent sales logs',
            endpoint: 'https://kristo-intelligence.vercel.app/api/sales/recent',
            paid: false,
          },
          {
            name: 'get_credits',
            description: 'Query wallet trial credits',
            endpoint: 'https://kristo-intelligence.vercel.app/api/credits',
            paid: false,
            inputSchema: {
              type: 'object',
              properties: {
                address: {
                  type: 'string',
                  description: 'Wallet address',
                },
              },
            },
          },
        ],
        payment: {
          protocol: 'x402',
          network: 'base',
          chain_id: CHAIN_ID,
          asset: 'USDC',
          asset_contract: USDC_ADDRESS,
          price_per_call: PRICE_USDC,
          pay_to: WALLET_ADDRESS,
        },
        links: {
          api: 'https://kristo-intelligence.vercel.app',
          dashboard: 'https://kristo-intelligence.vercel.app',
          github: 'https://github.com/hristovdimitri2-hub/kristo-travel-api',
          openapi: 'https://kristo-intelligence.vercel.app/openapi.json',
          discovery: 'https://kristo-intelligence.vercel.app/.well-known/x402.json',
        },
      },
    },
  };

  return NextResponse.json(mcpManifest);
}
