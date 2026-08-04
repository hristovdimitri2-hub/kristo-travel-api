export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getRecentSales } from '../../../lib/db';

export async function GET() {
  try {
    const sales = await getRecentSales(20);
    
    if (sales.length === 0) {
      return NextResponse.json({
        sales: [],
        count: 0,
        note: 'No sales yet. Be the first!',
      });
    }

    // Sanitize — don't expose full wallet addresses
    const sanitized = sales.map((s: any) => ({
      endpoint: s.endpoint,
      amount_usdc: s.amountUsdc,
      from_address: s.fromAddress ? `${s.fromAddress.slice(0, 6)}...${s.fromAddress.slice(-4)}` : null,
      consumed_at: s.consumedAt,
    }));

    return NextResponse.json({
      sales: sanitized,
      count: sales.length,
    });
  } catch (error) {
    return NextResponse.json({
      sales: [],
      count: 0,
      note: 'No sales yet. Be the first!',
    });
  }
}
