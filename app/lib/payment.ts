import {
  WALLET_ADDRESS,
  USDC_ADDRESS,
  CHAIN_ID,
  PRICE_USDC,
  PRICE_RAW,
  TRIAL_CREDITS,
  VOLUME_DISCOUNT_THRESHOLD,
  VOLUME_DISCOUNT_PRICE_RAW,
  ALCHEMY_RPC,
} from './config';
import {
  isTxHashUsed,
  recordUsedTx,
  recordSale,
  getWalletPaymentCount,
  useTrialCredit,
} from './db';

const DEFAULT_ERROR =
  'Payment required. Send USDC on Base to the payTo address, then retry with X-PAYMENT header containing the tx hash.';

export interface X402AcceptsV2 {
  scheme: string;
  network: string;
  amount: string;
  asset: string;
  payTo: string;
  maxTimeoutSeconds: number;
  extra: { name: string; version: string };
}

export interface X402Resource {
  url: string;
  description: string;
  mimeType: string;
  serviceName: string;
  tags: string[];
  iconUrl: string;
}

export interface X402AcceptsV1 {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  description: string;
}

export interface X402ResponseBody {
  x402Version: number;
  error: string;
  resource: X402Resource;
  accepts: X402AcceptsV2[];
  x402_version: number;
  accepts_v1: X402AcceptsV1;
}

export function createPaymentRequiredResponse(
  endpointPath: string,
  description: string,
  customError?: string
): Response {
  const errorText = customError || DEFAULT_ERROR;

  const acceptsV1: X402AcceptsV1 = {
    scheme: 'exact',
    network: 'base',
    asset: 'USDC',
    amount: PRICE_USDC.toFixed(2),
    payTo: WALLET_ADDRESS,
    description,
  };

  const body: X402ResponseBody = {
    x402Version: 2,
    error: errorText,
    resource: {
      url: `https://kristo-intelligence.vercel.app${endpointPath}`,
      description,
      mimeType: 'application/json',
      serviceName: 'Kristo Intelligence',
      tags: ['defi', 'base', 'crypto', 'ai-agents'],
      iconUrl: 'https://kristo-intelligence.vercel.app/icon.svg',
    },
    accepts: [
      {
        scheme: 'exact',
        network: `eip155:${CHAIN_ID}`,
        amount: String(PRICE_RAW),
        asset: USDC_ADDRESS,
        payTo: WALLET_ADDRESS,
        maxTimeoutSeconds: 60,
        extra: { name: 'USDC', version: '2' },
      },
    ],
    x402_version: 1,
    accepts_v1: acceptsV1,
  };

  const xPaymentRequiredHeader = JSON.stringify({
    x402_version: 1,
    accepts: acceptsV1,
    error: errorText,
  });

  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      'Content-Type': 'application/json',
      'X-PAYMENT-REQUIRED': xPaymentRequiredHeader,
      'access-control-expose-headers': 'PAYMENT-REQUIRED, X-PAYMENT-REQUIRED',
      'x-bounty-program': '50-free-credits-for-first-100-agents',
      'x-bounty-info-url': '/api/agent/welcome',
      'x-trial-credits': String(TRIAL_CREDITS),
      'x-trial-header': 'X-TRIAL-WALLET',
      'x-demo-mode': 'add ?demo=true for sample data',
    },
  });
}

async function verifyTxPayment(
  txHash: string,
  endpointPath: string,
  description: string
): Promise<{ ok: true; payer: string } | Response> {
  const cleanTxHash = txHash.trim();

  const txHashRegex = /^0x[0-9a-fA-F]{64}$/;
  if (!txHashRegex.test(cleanTxHash)) {
    return createPaymentRequiredResponse(
      endpointPath,
      description,
      'Invalid transaction hash format. Must be 0x followed by 64 hex characters.'
    );
  }

  const normalizedHash = cleanTxHash.toLowerCase();

  // ── Persistent replay protection via Turso ──
  try {
    const alreadyUsed = await isTxHashUsed(normalizedHash);
    if (alreadyUsed) {
      return createPaymentRequiredResponse(
        endpointPath,
        description,
        'Transaction hash has already been used.'
      );
    }
  } catch {
    // DB error — fail safe (allow the request, verify on-chain)
    console.error('DB error checking tx hash:', (new Error()).message);
  }

  // ── Fetch transaction receipt from Alchemy ──
  let receipt: any = null;
  try {
    const res = await fetch(ALCHEMY_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [cleanTxHash],
      }),
    });
    const data = await res.json();
    receipt = data.result;
  } catch {
    return createPaymentRequiredResponse(
      endpointPath,
      description,
      'Failed to fetch transaction receipt from Base network RPC.'
    );
  }

  if (!receipt || receipt.status !== '0x1') {
    return createPaymentRequiredResponse(
      endpointPath,
      description,
      'Transaction receipt not found or transaction failed.'
    );
  }

  // ── Verify USDC Transfer ──
  const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
  const logs = receipt.logs || [];
  let validPayer: string | null = null;
  let amountPaid = 0n;

  for (const log of logs) {
    if (
      log.address &&
      log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
      Array.isArray(log.topics) &&
      log.topics.length >= 3 &&
      log.topics[0].toLowerCase() === TRANSFER_TOPIC
    ) {
      const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
      const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();

      if (toAddress === WALLET_ADDRESS.toLowerCase()) {
        amountPaid = log.data && log.data !== '0x' ? BigInt(log.data) : 0n;

        // Check volume discount via persistent DB
        let paymentCount = 0;
        try {
          paymentCount = await getWalletPaymentCount(fromAddress);
        } catch {
          // DB error — no discount
        }

        const requiredAmount =
          paymentCount >= VOLUME_DISCOUNT_THRESHOLD
            ? BigInt(VOLUME_DISCOUNT_PRICE_RAW)
            : BigInt(PRICE_RAW);

        if (amountPaid >= requiredAmount) {
          validPayer = fromAddress;
          break;
        }
      }
    }
  }

  if (!validPayer) {
    return createPaymentRequiredResponse(
      endpointPath,
      description,
      'No valid USDC transfer to target wallet found in transaction.'
    );
  }

  // ── Persist: record tx hash + sale ──
  try {
    const blockNumber = receipt.blockNumber ? parseInt(receipt.blockNumber, 16) : 0;
    await recordUsedTx(normalizedHash, endpointPath, validPayer, Number(amountPaid), blockNumber);
    await recordSale(normalizedHash, endpointPath, validPayer, PRICE_USDC, blockNumber);
  } catch (e) {
    console.error('DB error recording sale:', (e as Error).message);
    // If we can't record, still serve the data — but this is a risk
  }

  return { ok: true, payer: validPayer };
}

export type VerifyPaymentResult =
  | { ok: true; demo?: boolean; trial?: boolean; wallet?: string; payer?: string }
  | Response;

export async function verifyPayment(
  request: Request,
  endpointPath: string,
  description: string
): Promise<VerifyPaymentResult> {
  // 1. Demo mode — ?demo=true returns sample data without payment
  try {
    const url = new URL(request.url, 'https://kristo-intelligence.vercel.app');
    if (url.searchParams.get('demo') === 'true') {
      return { ok: true, demo: true };
    }
  } catch {
    // ignore
  }

  // 2. X-PAYMENT header — verify on-chain USDC transaction
  const paymentHeader =
    request.headers.get('x-payment') || request.headers.get('X-PAYMENT');
  if (paymentHeader) {
    return await verifyTxPayment(paymentHeader, endpointPath, description);
  }

  // 3. X-TRIAL-WALLET header — persistent trial credits via Turso
  const trialWalletHeader =
    request.headers.get('x-trial-wallet') || request.headers.get('X-TRIAL-WALLET');
  if (trialWalletHeader) {
    const wallet = trialWalletHeader.trim();
    try {
      const used = await useTrialCredit(wallet);
      if (used) {
        return { ok: true, trial: true, wallet };
      }
    } catch {
      // DB error — fail safe, don't give free access
    }
  }

  // 4. No valid payment method — return 402
  return createPaymentRequiredResponse(endpointPath, description);
}

export function withPayment(
  endpointPath: string,
  description: string,
  handler: (req: Request, ...args: any[]) => Promise<any> | any
) {
  return async (req: Request, ...args: any[]): Promise<Response> => {
    const verification = await verifyPayment(req, endpointPath, description);

    if (verification instanceof Response) {
      return verification;
    }

    if (!verification || !(verification as any).ok) {
      return createPaymentRequiredResponse(endpointPath, description);
    }

    const result = await handler(req, { ...(verification as any) }, ...args);

    if (result instanceof Response) {
      return result;
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  };
}
