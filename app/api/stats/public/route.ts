import { NextResponse } from 'next/server';
import { getSalesStats, getRecentSales } from '../../../lib/db';

export async function GET() {
  try {
    const stats = await getSalesStats();
    const recentSales = await getRecentSales(5);
    
    // Build per-endpoint stats
    const endpointCounts: Record<string, number> = {};
    for (const sale of recentSales) {
      const ep = (sale as any).endpoint || 'unknown';
      endpointCounts[ep] = (endpointCounts[ep] || 0) + 1;
    }

    return NextResponse.json({
      service: 'Kristo Intelligence',
      version: '5.0.0',
      pricing_usdc: 0.10,
      revenue: {
        total_usdc: stats.totalUsdc,
        last_24h_usdc: stats.last24hUsdc,
        last_7d_usdc: stats.last7dUsdc,
      },
      sales: {
        total: stats.total,
        last_24h: stats.last24h,
        last_7d: stats.last7d,
      },
      customers: {
        unique_wallets: stats.uniqueWallets,
      },
      endpoints: Object.entries(endpointCounts).map(([path, count]) => ({ path, count })),
      generated_at: new Date().toISOString(),
      note: 'Public stats for transparency. No wallet addresses are exposed.',
    });
  } catch (error) {
    // Fallback to zeros if DB is unavailable
    return NextResponse.json({
      service: 'Kristo Intelligence',
      version: '5.0.0',
      pricing_usdc: 0.10,
      revenue: { total_usdc: 0, last_24h_usdc: 0, last_7d_usdc: 0 },
      sales: { total: 0, last_24h: 0 },
      customers: { unique_wallets: 0 },
      endpoints: [],
      generated_at: new Date().toISOString(),
      note: 'Public stats for transparency. No wallet addresses are exposed.',
    });
  }
}
