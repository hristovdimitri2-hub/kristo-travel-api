import { NextRequest, NextResponse } from 'next/server';
import { getTrialCredits } from '../../lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');

  if (!address || !address.trim()) {
    return NextResponse.json(
      {
        error: 'Missing address parameter',
        usage: '/api/credits?address=0x...',
      },
      { status: 400 }
    );
  }

  try {
    const trialCredits = await getTrialCredits(address.trim());
    return NextResponse.json({
      address: address.trim(),
      credits: 0,
      trial_credits: trialCredits,
      note: 'Trial credits reset daily at UTC midnight. Use X-TRIAL-WALLET header to spend them.',
    });
  } catch (error) {
    return NextResponse.json({
      address: address.trim(),
      credits: 0,
      trial_credits: 10,
      note: 'Trial credits reset daily at UTC midnight.',
    });
  }
}
