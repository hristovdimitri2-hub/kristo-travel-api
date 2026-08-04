import { NextResponse } from 'next/server';
import {
  WALLET_ADDRESS,
  USDC_ADDRESS,
  CHAIN_ID,
  PRICE_USDC,
  PRICE_RAW,
} from '@/app/lib/config';

export const dynamic = 'force-static';

export async function GET() {
  const x402PaymentMeta = {
    price_usdc: PRICE_USDC,
    amount_raw: PRICE_RAW,
    asset: 'USDC',
    asset_contract: USDC_ADDRESS,
    recipient: WALLET_ADDRESS,
    chain_id: CHAIN_ID,
  };

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Kristo Base-chain Intelligence API',
      version: '5.0.0',
      description:
        'Base-chain DeFi & on-chain intelligence API for AI agents. Real-time yields, TVL, prices, wallet analysis. 0.10 USDC per call.',
    },
    servers: [
      {
        url: 'https://kristo-intelligence.vercel.app',
        description: 'Production Server',
      },
    ],
    paths: {
      '/api/health': {
        get: {
          summary: 'System Health Check',
          description:
            'Returns system health status and current Base RPC block height.',
          responses: {
            '200': { description: 'Health status details' },
          },
        },
      },
      '/api/stats/public': {
        get: {
          summary: 'Public API Usage Statistics',
          description:
            'Returns overall request counts, total revenue, and active wallet metrics.',
          responses: {
            '200': { description: 'Public usage statistics' },
          },
        },
      },
      '/api/sales/recent': {
        get: {
          summary: 'Recent Verified Sales',
          description:
            'Returns logs of recent verified x402 payment transactions.',
          responses: {
            '200': { description: 'List of recent sales transactions' },
          },
        },
      },
      '/api/credits': {
        get: {
          summary: 'Wallet Credits Check',
          description:
            'Queries remaining trial credits and balance for a specific wallet address.',
          parameters: [
            {
              name: 'address',
              in: 'query',
              required: false,
              schema: { type: 'string' },
              description: 'Wallet address to check credits for',
            },
          ],
          responses: {
            '200': { description: 'Credit balance details' },
          },
        },
      },
      '/api/crypto/token-prices': {
        get: {
          summary: 'Token Prices (Freemium)',
          description:
            'Fetches real-time market prices for specified tokens from CoinGecko.',
          parameters: [
            {
              name: 'tokens',
              in: 'query',
              required: false,
              schema: { type: 'string', default: 'ETH,USDC,WETH,BASE' },
              description: 'Comma-separated list of token symbols',
            },
          ],
          responses: {
            '200': { description: 'Real-time token prices' },
          },
        },
      },
      '/api/crypto/gas-oracle': {
        get: {
          summary: 'Base Gas Oracle (Freemium)',
          description:
            'Provides current gas price estimates and cost calculations on Base L2.',
          responses: {
            '200': { description: 'Base gas price estimates' },
          },
        },
      },
      '/api/defi/yields': {
        get: {
          summary: 'Top Base Yield Pools (Paid)',
          description:
            'Returns top 10 Base DeFi yield pools ordered by APY and TVL.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'Top yield pools data' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/defi/tvl-movers': {
        get: {
          summary: 'Base TVL Movers (Paid)',
          description:
            'Returns protocols on Base with significant 1-day TVL changes.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'Top TVL mover protocols' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/defi/lending-rates': {
        get: {
          summary: 'Lending & Borrowing Rates (Paid)',
          description:
            'Returns top lending and borrowing APYs across Base lending markets.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'Lending and borrowing rates' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/defi/dex-pools': {
        get: {
          summary: 'Top DEX Liquidity Pools (Paid)',
          description:
            'Returns top liquidity pools, volume, and fee stats across Base DEXes.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'DEX pool statistics' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/defi/protocol-safety': {
        get: {
          summary: 'Protocol Safety Scores (Paid)',
          description:
            'Returns risk and safety ratings for major Base smart contract protocols.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'Protocol safety ratings' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/crypto/token-launches': {
        get: {
          summary: 'Base Token Launches (Paid)',
          description:
            'Lists recently created token contracts and initial liquidity on Base.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'Recent token launches' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/crypto/token-security': {
        get: {
          summary: 'Token Security Scanner (Paid)',
          description:
            'Scans a token contract address for rug-pull indicators and honeypot code.',
          'x-x402-payment': x402PaymentMeta,
          parameters: [
            {
              name: 'address',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Token contract address on Base',
            },
          ],
          responses: {
            '200': { description: 'Token security analysis report' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/crypto/wallet-profile': {
        get: {
          summary: 'Wallet Profile & Analysis (Paid)',
          description:
            'Analyzes on-chain wallet balance, transaction counts, and DeFi classification.',
          'x-x402-payment': x402PaymentMeta,
          parameters: [
            {
              name: 'address',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Wallet address to analyze',
            },
          ],
          responses: {
            '200': { description: 'Wallet profile report' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/crypto/whale-moves': {
        get: {
          summary: 'Whale USDC Transfers (Paid)',
          description: 'Monitors large USDC transfer transactions on Base.',
          'x-x402-payment': x402PaymentMeta,
          parameters: [
            {
              name: 'min_usdc',
              in: 'query',
              required: false,
              schema: { type: 'number', default: 10000 },
              description: 'Minimum USDC amount filter',
            },
          ],
          responses: {
            '200': { description: 'Whale transfer logs' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
      '/api/crypto/bridge-volume': {
        get: {
          summary: 'Cross-chain Bridge Volume (Paid)',
          description:
            'Tracks capital flows and cross-chain bridge volumes into Base.',
          'x-x402-payment': x402PaymentMeta,
          responses: {
            '200': { description: 'Bridge volume analytics' },
            '402': { description: 'Payment Required via x402 protocol' },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
