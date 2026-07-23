import { NextResponse } from 'next/server'

const KRISTO_API = 'https://kristo-travel-api.onrender.com'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || '/health'

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }
    if (searchParams.get('x-payment')) {
      headers['X-PAYMENT'] = searchParams.get('x-payment')!
    }

    const res = await fetch(`${KRISTO_API}${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(15000)
    })

    const data = await res.json()
    return NextResponse.json({ status: res.status, data, headers: { 'x-payment-required': res.headers.get('x-payment-required') } })
  } catch (error) {
    return NextResponse.json(
      { status: 503, data: { error: 'API unreachable. Render free tier may be sleeping. Try again in ~50 seconds.' } },
      { status: 503 }
    )
  }
}

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url)
  const endpoint = searchParams.get('endpoint') || '/travel/weekend-getaway'

  try {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    }
    
    // Get X-PAYMENT from either header or query param
    const xPayment = request.headers.get('x-payment') || searchParams.get('x-payment')
    if (xPayment) {
      headers['X-PAYMENT'] = xPayment
    }

    const res = await fetch(`${KRISTO_API}${endpoint}`, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(30000) // longer timeout for payment verification
    })

    const data = await res.json()
    return NextResponse.json({ status: res.status, data, headers: { 'x-payment-required': res.headers.get('x-payment-required') } })
  } catch (error) {
    return NextResponse.json(
      { status: 503, data: { error: 'API unreachable or timeout during payment verification.' } },
      { status: 503 }
    )
  }
}
