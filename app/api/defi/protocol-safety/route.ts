export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { withPayment } from '../../../lib/payment';

export const runtime = 'nodejs';

const PROTOCOL_SAFETY = [
  { name: 'Aerodrome', category: 'DEX', audit_status: 'Audited by Spearbit', risk_score: 25, risk_level: 'Low', tvl_usd: 1240000000, last_audit: '2024-03-15', notes: 'Well-audited, battle-tested AMM on Base' },
  { name: 'Aave V3', category: 'Lending', audit_status: 'Audited by Trail of Bits', risk_score: 15, risk_level: 'Low', tvl_usd: 380000000, last_audit: '2024-01-20', notes: 'Tier-1 lending protocol, multi-chain deployed' },
  { name: 'Compound V3', category: 'Lending', audit_status: 'Audited by OpenZeppelin', risk_score: 18, risk_level: 'Low', tvl_usd: 145000000, last_audit: '2024-02-10', notes: 'Established lending market on Base' },
  { name: 'Morpho Blue', category: 'Lending', audit_status: 'Audited by Certora', risk_score: 30, risk_level: 'Low', tvl_usd: 210000000, last_audit: '2024-04-05', notes: 'Permissionless lending vaults' },
  { name: 'Uniswap V3', category: 'DEX', audit_status: 'Audited by Consensys Diligence', risk_score: 12, risk_level: 'Low', tvl_usd: 89000000, last_audit: '2023-11-30', notes: 'Industry standard AMM' },
  { name: 'Moonwell', category: 'Lending', audit_status: 'Audited by Certora', risk_score: 35, risk_level: 'Low', tvl_usd: 67000000, last_audit: '2024-05-01', notes: 'Base-native lending protocol' },
  { name: 'Seamless Protocol', category: 'Lending', audit_status: 'Audited by Sigma Prime', risk_score: 40, risk_level: 'Medium', tvl_usd: 42000000, last_audit: '2024-03-22', notes: 'Newer protocol, limited track record' },
  { name: 'Extra Finance', category: 'Yield', audit_status: 'Audited by Paladin', risk_score: 55, risk_level: 'Medium', tvl_usd: 28000000, last_audit: '2024-04-15', notes: 'Leveraged yield strategies, higher risk profile' },
];

export const GET = withPayment('/api/defi/protocol-safety', 'Risk scores & audit statuses for Base protocols', async (req, ctx) => {
  const url = new URL(req.url);
  const isDemo = ctx?.demo || url.searchParams.get('demo') === 'true';

  return NextResponse.json({
    network: 'base',
    protocols: PROTOCOL_SAFETY,
    count: PROTOCOL_SAFETY.length,
    data_source: isDemo ? 'demo' : 'static',
    ...(isDemo ? { demo: true, note: 'Sample data — pay 0.10 USDC for full protocol risk analysis.' } : {}),
    queried_at: new Date().toISOString(),
  });
});
