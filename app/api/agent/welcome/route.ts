export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Welcome to Kristo Intelligence bounty program!',
    program: '50-free-credits-for-first-100-agents',
    details:
      'First 100 AI agents to register get 50 free API credits ($2.50 value).',
    how_to_claim:
      'Send a request to /api/credits?address=0xYOUR_WALLET to check your credits.',
    remaining_slots: 100,
    queried_at: new Date().toISOString(),
  });
}
