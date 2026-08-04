'use client';

import React, { useEffect, useState } from 'react';

interface Stats {
  revenue: { total_usdc: number; last_24h_usdc: number; last_7d_usdc: number };
  sales: { total: number; last_24h: number; last_7d?: number };
  customers: { unique_wallets: number };
  endpoints: { path: string; count: number }[];
}

interface Sale {
  endpoint: string;
  amount_usdc: number;
  from_address: string | null;
  consumed_at: string;
}

interface HealthData {
  status: string;
  block: number;
  web3_connected: boolean;
}

type Tab = 'paid' | 'freemium' | 'free' | 'discovery';

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('paid');

  async function loadData() {
    try {
      const [statsRes, salesRes, healthRes] = await Promise.all([
        fetch('/api/stats/public').then((r) => r.json()),
        fetch('/api/sales/recent').then((r) => r.json()),
        fetch('/api/health').then((r) => r.json()),
      ]);
      setStats(statsRes);
      setSales(salesRes.sales || []);
      setHealth(healthRes);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const hasSales = stats && stats.sales.total > 0;

  const paidEndpoints = [
    { path: '/api/defi/yields', desc: 'Top 10 Base yield pools by TVL & APY' },
    { path: '/api/defi/tvl-movers', desc: 'Base protocols with largest TVL shifts' },
    { path: '/api/defi/lending-rates', desc: 'Lending & borrow rates across Base protocols' },
    { path: '/api/defi/dex-pools', desc: 'Top DEX liquidity pools & volume statistics' },
    { path: '/api/defi/protocol-safety', desc: 'Risk scores & audit statuses for Base protocols' },
    { path: '/api/crypto/token-launches', desc: 'Recently launched tokens on Base' },
    { path: '/api/crypto/token-security', desc: 'Honeypot & rug-pull security analysis (?address=0x...)' },
    { path: '/api/crypto/wallet-profile', desc: 'On-chain wallet behavior & classification (?address=0x...)' },
    { path: '/api/crypto/whale-moves', desc: 'Large transfer alerts on Base' },
    { path: '/api/crypto/bridge-volume', desc: 'Cross-chain bridge metrics & net flows' },
  ];

  const freemiumEndpoints = [
    { path: '/api/crypto/token-prices', desc: 'Live crypto token prices via CoinGecko (60 req/min limit)' },
    { path: '/api/crypto/gas-oracle', desc: 'Real-time Base network gas prices (60 req/min limit)' },
  ];

  const freeEndpoints = [
    { path: '/api/health', desc: 'API health status & latest Base block' },
    { path: '/api/stats/public', desc: 'Public revenue and API metrics' },
    { path: '/api/sales/recent', desc: 'Recent sales transaction log' },
    { path: '/api/credits?address=0x...', desc: 'Check available trial credits' },
  ];

  const discoveryEndpoints = [
    { path: '/.well-known/x402.json', desc: 'x402 v2 protocol manifest' },
    { path: '/llms.txt', desc: 'LLM context & API documentation' },
    { path: '/agents.txt', desc: 'AI agent connection guidelines' },
    { path: '/openapi.json', desc: 'OpenAPI 3.1 specification' },
    { path: '/mcp', desc: 'Model Context Protocol (MCP) manifest' },
  ];

  const tabConfig: Record<Tab, { label: string; color: string; items: { path: string; desc: string }[]; badge: string }> = {
    paid: { label: '🔒 Paid', color: '#f87171', items: paidEndpoints, badge: '0.10 USDC/call' },
    freemium: { label: '⚡ Freemium', color: '#c084fc', items: freemiumEndpoints, badge: '60 req/min' },
    free: { label: '🟢 Free', color: '#4ade80', items: freeEndpoints, badge: 'unlimited' },
    discovery: { label: '🔍 Discovery', color: '#fcd34d', items: discoveryEndpoints, badge: 'AI agent docs' },
  };

  return (
    <main style={{ maxWidth: '960px', margin: '0 auto', padding: '1.5rem 1rem 3rem', lineHeight: '1.6' }}>
      {/* Header */}
      <header style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.9rem', fontWeight: 800, color: '#60a5fa', margin: 0 }}>
              Kristo Intelligence
            </h1>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', margin: '0.2rem 0 0 0' }}>
              Pay-per-call DeFi Intelligence for AI Agents on Base
            </p>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#111827',
              padding: '0.5rem 0.9rem',
              borderRadius: '999px',
              border: '1px solid #1f2937',
            }}
          >
            <span
              style={{
                width: '9px',
                height: '9px',
                borderRadius: '50%',
                background: health?.status === 'online' ? '#34d399' : error ? '#ef4444' : '#6b7280',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: '0.85rem', color: '#d1d5db' }}>
              {health?.status === 'online' ? 'API Online' : error ? 'API Error' : 'Checking...'}
            </span>
            {health?.block && (
              <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>· Block #{health.block.toLocaleString()}</span>
            )}
          </div>
        </div>
      </header>

      {/* Revenue Dashboard */}
      <section
        style={{
          background: 'linear-gradient(135deg, #111827 0%, #0f1729 100%)',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#e5e7eb' }}>📊 Revenue Dashboard</h2>
          {loading && <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Loading...</span>}
        </div>

        {!hasSales && !loading && (
          <div
            style={{
              background: '#1f2937',
              border: '1px dashed #374151',
              borderRadius: '0.5rem',
              padding: '1rem 1.25rem',
              marginBottom: '1.25rem',
              color: '#fbbf24',
              fontSize: '0.9rem',
            }}
          >
            ⚠️ No sales yet. The paywall is live and enforced — the dashboard will update automatically the moment the first payment lands.
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.9rem' }}>
          <StatCard
            label="Total Revenue"
            value={stats ? `$${stats.revenue.total_usdc.toFixed(2)}` : '—'}
            accent={hasSales ? '#34d399' : '#6b7280'}
          />
          <StatCard
            label="Total Sales"
            value={stats ? String(stats.sales.total) : '—'}
            accent={hasSales ? '#34d399' : '#6b7280'}
          />
          <StatCard
            label="Unique Wallets"
            value={stats ? String(stats.customers.unique_wallets) : '—'}
            accent={hasSales ? '#34d399' : '#6b7280'}
          />
          <StatCard
            label="Last 24h"
            value={stats ? `$${stats.revenue.last_24h_usdc.toFixed(2)} (${stats.sales.last_24h})` : '—'}
            accent="#60a5fa"
          />
        </div>
      </section>

      {/* Recent Sales */}
      <section
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          padding: '1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#e5e7eb' }}>🧾 Recent Sales</h2>
        {sales.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            No sales recorded yet. Once a payment is verified on-chain, it will show up here in real time.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {sales.map((s, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: '#0f1729',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.85rem',
                }}
              >
                <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{s.endpoint}</span>
                <span style={{ color: '#9ca3af' }}>{s.from_address || '—'}</span>
                <span style={{ color: '#34d399', fontWeight: 600 }}>${s.amount_usdc.toFixed(2)}</span>
                <span style={{ color: '#6b7280', fontSize: '0.78rem' }}>
                  {new Date(s.consumed_at).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Payment Info (compact) */}
      <section
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: '#f97316' }}>⚡ x402 Payment Info</h2>
        <p style={{ margin: '0 0 0.75rem 0', color: '#d1d5db', fontSize: '0.88rem' }}>
          Paid endpoints require <strong>0.10 USDC</strong> per call on Base mainnet, or 10 free trial calls via the{' '}
          <code style={{ background: '#1f2937', padding: '0.1rem 0.35rem', borderRadius: '0.25rem' }}>X-TRIAL-WALLET</code> header.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
          <AddressBox label="Payment Address" value="0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f" />
          <AddressBox label="USDC Contract (Base)" value="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" />
        </div>
      </section>

      {/* Endpoint Explorer (tabbed) */}
      <section
        style={{
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '0.75rem',
          padding: '1.25rem 1.5rem',
        }}
      >
        <h2 style={{ margin: '0 0 1rem 0', fontSize: '1.1rem', color: '#e5e7eb' }}>🧭 Endpoint Explorer</h2>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          {(Object.keys(tabConfig) as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                background: activeTab === tab ? tabConfig[tab].color : '#1f2937',
                color: activeTab === tab ? '#0b0f19' : '#d1d5db',
                border: 'none',
                borderRadius: '999px',
                padding: '0.4rem 0.9rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {tabConfig[tab].label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <span
            style={{
              fontSize: '0.75rem',
              color: '#6b7280',
              background: '#0f1729',
              padding: '0.15rem 0.6rem',
              borderRadius: '999px',
            }}
          >
            {tabConfig[activeTab].badge}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{tabConfig[activeTab].items.length} endpoints</span>
        </div>
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {tabConfig[activeTab].items.map((ep) => (
            <div
              key={ep.path}
              style={{
                backgroundColor: '#0f1729',
                padding: '0.7rem 1rem',
                borderRadius: '0.4rem',
                borderLeft: `3px solid ${tabConfig[activeTab].color}`,
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: '0.4rem',
              }}
            >
              <a
                href={ep.path}
                style={{ fontFamily: 'monospace', color: tabConfig[activeTab].color, fontWeight: 600, textDecoration: 'none', fontSize: '0.88rem' }}
              >
                {ep.path}
              </a>
              <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>{ep.desc}</span>
            </div>
          ))}
        </div>
      </section>

      <footer style={{ marginTop: '2.5rem', paddingTop: '1.25rem', borderTop: '1px solid #1f2937', color: '#6b7280', textAlign: 'center', fontSize: '0.8rem' }}>
        Kristo Intelligence v5.0.0 — Powered by Next.js 14 App Router & Base Blockchain
      </footer>
    </main>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ background: '#0f1729', borderRadius: '0.5rem', padding: '0.9rem 1rem', border: `1px solid ${accent}33` }}>
      <div style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.3rem' }}>{label}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: accent }}>{value}</div>
    </div>
  );
}

function AddressBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: '#0f1729', padding: '0.65rem 0.85rem', borderRadius: '0.4rem' }}>
      <div style={{ color: '#9ca3af', fontSize: '0.78rem', marginBottom: '0.2rem' }}>{label}</div>
      <div style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#34d399', wordBreak: 'break-all' }}>{value}</div>
    </div>
  );
}
