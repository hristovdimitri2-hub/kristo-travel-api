import { NextResponse } from 'next/server'

const KRISTO_API = 'https://kristo-travel-api.onrender.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || '/health'

  try {
    const res = await fetch(`${KRISTO_API}${endpoint}`, {
      headers: {
        'Accept': 'application/json',
        ...(searchParams.get('x-payment') ? { 'X-PAYMENT': searchParams.get('x-payment')! } : {})
      },
      signal: AbortSignal.timeout(15000)
    })

    const data = await res.json()
    return NextResponse.json({ status: res.status, data })
  } catch (error) {
    return NextResponse.json(
      { status: 503, data: { error: 'API unreachable. Render free tier may be sleeping. Try again in ~50 seconds.' } },
      { status: 503 }
    )
  }
}
