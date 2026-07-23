import { NextResponse } from 'next/server'

const WALLET = '0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASE_RPC = 'https://mainnet.base.org'
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

// Cache to avoid hammering the RPC
let cache: { data: any; ts: number } | null = null
const CACHE_TTL = 30000 // 30 seconds

export async function GET() {
  try {
    // Return cached data if fresh
    if (cache && Date.now() - cache.ts < CACHE_TTL) {
      return NextResponse.json(cache.data)
    }

    const now = Math.floor(Date.now() / 1000)
    // ~24 hours ago in seconds (approx 7200 blocks at 12s/block)
    const blocksPerDay = 7200

    // Get current block number
    const blockRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
    })
    const blockData = await blockRes.json()
    const currentBlock = parseInt(blockData.result, 16)
    const fromBlock = currentBlock - blocksPerDay

    // Query USDC Transfer events TO our wallet in the last ~24h
    const walletTopic = '0x' + WALLET.toLowerCase().replace('0x', '').padStart(64, '0')
    
    const logsRes = await fetch(BASE_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_getLogs',
        params: [{
          fromBlock: '0x' + fromBlock.toString(16),
          toBlock: 'latest',
          address: USDC,
          topics: [TRANSFER_TOPIC, null, walletTopic]
        }],
        id: 2
      })
    })
    const logsData = await logsRes.json()
    const logs = logsData.result || []

    // Parse transfers
    const transfers = logs.map((log: any) => ({
      hash: log.transactionHash,
      from: '0x' + (log.topics[1] || '').slice(26),
      value: (parseInt(log.data, 16) / 1e6).toFixed(2),
      block: parseInt(log.blockNumber, 16),
      timestamp: '', // We don't have exact timestamps from logs, but block number is enough
    }))

    const totalUsdc = transfers
      .reduce((sum: number, tx: { value: string }) => sum + parseFloat(tx.value), 0)
      .toFixed(2)

    const result = {
      transactions: transfers,
      total_usdc: totalUsdc,
      count_24h: transfers.length,
      source: 'base-rpc',
      checked_at: new Date().toISOString()
    }

    cache = { data: result, ts: Date.now() }
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { transactions: [], total_usdc: '0', count_24h: 0, error: 'RPC query failed' },
      { status: 503 }
    )
  }
}