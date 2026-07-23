import { NextResponse } from 'next/server'

const WALLET = '0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f'
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const BASESCAN_API = 'https://api.basescan.org/api'

export async function GET() {
  try {
    const url = `${BASESCAN_API}?module=account&action=tokentx&address=${WALLET}&startblock=0&endblock=99999999&sort=desc&apikey=YourApiKeyToken`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const json = await res.json()

    if (json.status !== '1' || !json.result) {
      return NextResponse.json({ transactions: [], total_usdc: '0', count_24h: 0 })
    }

    const now = Math.floor(Date.now() / 1000)
    const dayAgo = now - 86400

    const usdcTransfers = json.result
      .filter((tx: Record<string, string>) =>
        tx.contractAddress.toLowerCase() === USDC.toLowerCase() &&
        tx.to.toLowerCase() === WALLET.toLowerCase() &&
        parseInt(tx.timeStamp) >= dayAgo
      )
      .map((tx: Record<string, string>) => ({
        hash: tx.hash,
        from: tx.from,
        value: (parseInt(tx.value) / 1e6).toFixed(2),
        timestamp: new Date(parseInt(tx.timeStamp) * 1000).toLocaleString('bg-BG'),
        block: tx.blockNumber,
      }))

    const totalUsdc = usdcTransfers
      .reduce((sum: number, tx: { value: string }) => sum + parseFloat(tx.value), 0)
      .toFixed(2)

    return NextResponse.json({
      transactions: usdcTransfers,
      total_usdc: totalUsdc,
      count_24h: usdcTransfers.length,
    })
  } catch {
    return NextResponse.json({ transactions: [], total_usdc: '0', count_24h: 0, error: 'Basescan unavailable' })
  }
}
