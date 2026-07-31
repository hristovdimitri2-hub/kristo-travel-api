'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Zap,
  Wallet,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  TrendingDown,
  Coins,
  Flame,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Globe,
  DollarSign,
  BarChart3,
  Database,
  Code,
  Lock,
  Cpu,
  Play,
  Pause,
  Info,
  ShieldCheck,
  Search
} from 'lucide-react';
import { ethers } from 'ethers';

// Configuration & Constants
const DEFAULT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://kristo-travel-api.onrender.com';
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const API_WALLET_ADDRESS = '0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f';
const PRICE_USDC = '0.01';
const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_ID_HEX = '0x2105';

// Interfaces
interface X402Accepts {
  scheme: string;
  network: string;
  asset: string;
  amount: string;
  payTo: string;
  description?: string;
}

interface X402Challenge {
  x402_version: number;
  accepts: X402Accepts;
  error: string;
  invalid_tx?: string;
}

interface HealthResponse {
  status: string;
  web3_connected: boolean;
  wallet: string;
  network: string;
  rpc: string;
  block: number;
}

interface SalesItem {
  id?: string;
  caller_address?: string;
  payer?: string;
  endpoint?: string;
  tx_hash?: string;
  amount?: string | number;
  timestamp?: string;
  created_at?: string;
}

interface SalesResponse {
  total_sales: number;
  recent: SalesItem[];
}

interface PingLogItem {
  id: string;
  timestamp: string;
  status: 'success' | 'error';
  latencyMs: number;
  statusCode?: number;
  block?: number;
  message?: string;
}

// Fallback Mock Preview Data for visualization prior to or in addition to live paid calls
const MOCK_PREVIEW_DATA: Record<string, any> = {
  '/defi/yields': {
    endpoint: '/defi/yields',
    updated_at: new Date().toISOString(),
    data: [
      {
        project: 'Aerodrome',
        pool: 'vAMM-USDC/AERO',
        apy: 42.85,
        base_apy: 12.10,
        reward_apy: 30.75,
        tvl_usd: 45200000,
        chain: 'Base',
        risk: 'Low',
        reward_tokens: ['AERO']
      },
      {
        project: 'Moonwell',
        pool: 'USDC Flagship Vault',
        apy: 18.42,
        base_apy: 8.20,
        reward_apy: 10.22,
        tvl_usd: 120800000,
        chain: 'Base',
        risk: 'Low',
        reward_tokens: ['WELL']
      },
      {
        project: 'Uniswap v3',
        pool: 'WETH/USDC (0.05%)',
        apy: 24.15,
        base_apy: 24.15,
        reward_apy: 0,
        tvl_usd: 89500000,
        chain: 'Base',
        risk: 'Medium',
        reward_tokens: []
      },
      {
        project: 'Extra Finance',
        pool: 'Leveraged USDC/cbETH',
        apy: 68.90,
        base_apy: 15.30,
        reward_apy: 53.60,
        tvl_usd: 14300000,
        chain: 'Base',
        risk: 'High Yield',
        reward_tokens: ['EXTRA']
      },
      {
        project: 'Morpho',
        pool: 'Gauntlet USDC Core',
        apy: 14.20,
        base_apy: 14.20,
        reward_apy: 0,
        tvl_usd: 67400000,
        chain: 'Base',
        risk: 'Low',
        reward_tokens: []
      },
      {
        project: 'BaseSwap',
        pool: 'BSWAP/WETH',
        apy: 88.40,
        base_apy: 18.20,
        reward_apy: 70.20,
        tvl_usd: 8200000,
        chain: 'Base',
        risk: 'High Yield',
        reward_tokens: ['BSWAP']
      }
    ]
  },
  '/defi/tvl-movers': {
    endpoint: '/defi/tvl-movers',
    updated_at: new Date().toISOString(),
    protocols: [
      { name: 'Aerodrome', category: 'DEX', tvl_usd: 845200000, change_1d: 5.42, change_7d: 18.90, change_30d: 42.10, dominance: 34.5 },
      { name: 'Morpho', category: 'Lending', tvl_usd: 420100000, change_1d: 12.80, change_7d: 31.40, change_30d: 88.20, dominance: 17.1 },
      { name: 'Moonwell', category: 'Lending', tvl_usd: 310500000, change_1d: -1.25, change_7d: 4.80, change_30d: 15.30, dominance: 12.6 },
      { name: 'Uniswap v3', category: 'DEX', tvl_usd: 285400000, change_1d: 2.10, change_7d: -3.15, change_30d: 8.40, dominance: 11.6 },
      { name: 'Aave V3', category: 'Lending', tvl_usd: 240000000, change_1d: 0.85, change_7d: 12.10, change_30d: 29.50, dominance: 9.8 },
      { name: 'Extra Finance', category: 'Yield', tvl_usd: 68900000, change_1d: -4.30, change_7d: 22.40, change_30d: 64.10, dominance: 2.8 }
    ]
  },
  '/crypto/token-prices': {
    endpoint: '/crypto/token-prices',
    updated_at: new Date().toISOString(),
    tokens: [
      { symbol: 'ETH', name: 'Ethereum', price_usd: 3482.50, change_24h: 3.45, volume_24h: 14200000000, market_cap: 418000000000, address: '0x4200000000000000000000000000000000000006', trend: 'up' },
      { symbol: 'USDC', name: 'USD Coin', price_usd: 1.00, change_24h: 0.01, volume_24h: 4500000000, market_cap: 34500000000, address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', trend: 'flat' },
      { symbol: 'AERO', name: 'Aerodrome Finance', price_usd: 1.28, change_24h: 8.92, volume_24h: 85400000, market_cap: 640000000, address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', trend: 'up' },
      { symbol: 'WELL', name: 'Moonwell', price_usd: 0.048, change_24h: -2.15, volume_24h: 12300000, market_cap: 142000000, address: '0xA885B03d73d31A9F6370D4822B487A4621A5826d', trend: 'down' },
      { symbol: 'DEGEN', name: 'Degen Token', price_usd: 0.0125, change_24h: 14.30, volume_24h: 38900000, market_cap: 185000000, address: '0x4ed4E862860be51a74b54338086938a3a0e63286', trend: 'up' },
      { symbol: 'BRETT', name: 'Brett Token', price_usd: 0.142, change_24h: -5.80, volume_24h: 62100000, market_cap: 1410000000, address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', trend: 'down' }
    ]
  },
  '/crypto/wallet-profile': {
    endpoint: '/crypto/wallet-profile',
    address: '0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f',
    net_worth_usd: 184520.50,
    risk_classification: 'Low Risk',
    risk_score: 18,
    label: 'API Treasury & DeFi Saver',
    balances: [
      { asset: 'ETH', amount: 12.45, value_usd: 43357.12, share: 23.5 },
      { asset: 'USDC', amount: 112500.00, value_usd: 112500.00, share: 61.0 },
      { asset: 'vAMM-USDC/AERO LP', amount: 15400.00, value_usd: 28663.38, share: 15.5 }
    ],
    stats: {
      total_tx_count: 1420,
      active_days: 184,
      first_tx_date: '2024-02-15',
      last_tx_date: '2026-07-31',
      frequent_interactions: ['Aerodrome Router', 'USDC Token', 'Moonwell Comptroller']
    }
  },
  '/crypto/whale-moves': {
    endpoint: '/crypto/whale-moves',
    updated_at: new Date().toISOString(),
    min_usd_threshold: 100000,
    transfers: [
      { tx_hash: '0x7a2b9183cd4e2f81903e12a4567890abcdef1234567890abcdef1234567890ab', token: 'USDC', amount: 750000, value_usd: 750000, from: '0xa1b2c3d4e5f67890123456789012345678901234', to: '0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f', type: 'API Payment Pool', time_ago: '2 mins ago', block: 49356220 },
      { tx_hash: '0x3f4e5d6c7b8a901234567890abcdef1234567890abcdef1234567890abcdef12', token: 'ETH', amount: 250, value_usd: 870625, from: '0x8888888888888888888888888888888888888888', to: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', type: 'DEX Liquidity Addition', time_ago: '8 mins ago', block: 49356215 },
      { tx_hash: '0x901234567890abcdef1234567890abcdef1234567890abcdef1234567890ab12', token: 'USDC', amount: 1200000, value_usd: 1200000, from: '0x1111222233334444555566667777888899990000', to: '0x4200000000000000000000000000000000000006', type: 'L2 Bridge Transfer', time_ago: '14 mins ago', block: 49356200 },
      { tx_hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678', token: 'AERO', amount: 450000, value_usd: 576000, from: '0x5555666677778888999900001111222233334444', to: '0x8888999900001111222233334444555566667777', type: 'Whale OTC Accumulation', time_ago: '28 mins ago', block: 49356180 }
    ]
  },
  '/crypto/gas-oracle': {
    endpoint: '/crypto/gas-oracle',
    updated_at: new Date().toISOString(),
    chain: 'Base (Layer 2)',
    recommendation: 'Optimal - Base gas is minimal',
    congestion_level: 'Low',
    base_fee_gwei: 0.008,
    gas_tiers: {
      slow: { gwei: 0.008, est_sec: 3 },
      standard: { gwei: 0.012, est_sec: 2 },
      fast: { gwei: 0.020, est_sec: 1 },
      instant: { gwei: 0.035, est_sec: 0.5 }
    },
    cost_estimates_usd: {
      usdc_transfer: 0.0018,
      eth_transfer: 0.0008,
      uniswap_v3_swap: 0.0142,
      aerodrome_add_lp: 0.0210,
      nft_mint: 0.0095
    }
  }
};

export default function KristoDashboard() {
  // Config & API Settings
  const [apiUrl, setApiUrl] = useState<string>(DEFAULT_API_URL);

  // Health & Status
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [healthLoading, setHealthLoading] = useState<boolean>(false);
  const [healthError, setHealthError] = useState<string | null>(null);

  // Keepalive Manager
  const [keepaliveActive, setKeepaliveActive] = useState<boolean>(true);
  const [keepaliveIntervalSec, setKeepaliveIntervalSec] = useState<number>(300); // 5 mins
  const [secondsToNextPing, setSecondsToNextPing] = useState<number>(300);
  const [pingLogs, setPingLogs] = useState<PingLogItem[]>([]);

  // Web3 / Wallet State
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [ethBalance, setEthBalance] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [walletError, setWalletError] = useState<string | null>(null);

  // Payment Execution & Testing State
  const [isSendingTx, setIsSendingTx] = useState<boolean>(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [manualTxHash, setManualTxHash] = useState<string>('');
  const [x402Challenge, setX402Challenge] = useState<X402Challenge | null>(null);

  // Active Endpoints Data & View State
  const [activeTab, setActiveTab] = useState<'endpoints' | 'payment' | 'sales' | 'keepalive' | 'docs'>('endpoints');
  const [selectedEndpoint, setSelectedEndpoint] = useState<string>('/defi/yields');
  const [walletProfileAddress, setWalletProfileAddress] = useState<string>('');

  const [endpointData, setEndpointData] = useState<Record<string, any>>({});
  const [endpointLoading, setEndpointLoading] = useState<Record<string, boolean>>({});
  const [endpointError, setEndpointError] = useState<Record<string, string | null>>({});
  const [endpointStatus, setEndpointStatus] = useState<Record<string, number | null>>({});
  const [endpointPaidTx, setEndpointPaidTx] = useState<Record<string, string>>({});

  // Sales Monitor
  const [salesData, setSalesData] = useState<SalesResponse | null>(null);
  const [salesLoading, setSalesLoading] = useState<boolean>(false);

  // Copy helper
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Helper for formatting USD
  const formatUSD = (val: number | string | undefined) => {
    if (val === undefined || val === null) return '$0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(num);
  };

  // Helper for formatting Large Numbers
  const formatCompactUSD = (val: number | string | undefined) => {
    if (val === undefined || val === null) return '$0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(num);
  };

  // 1. Health Check & Ping Function
  const checkHealth = useCallback(async (isKeepalivePing = false) => {
    const startTime = Date.now();
    setHealthLoading(true);
    setHealthError(null);
    try {
      const res = await fetch(`${apiUrl}/health`, { cache: 'no-store' });
      const latency = Date.now() - startTime;
      setApiLatency(latency);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data: HealthResponse = await res.json();
      setHealthData(data);

      if (isKeepalivePing) {
        setPingLogs((prev) => [
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            status: 'success',
            latencyMs: latency,
            statusCode: res.status,
            block: data.block
          },
          ...prev.slice(0, 24)
        ]);
      }
    } catch (err: any) {
      const latency = Date.now() - startTime;
      setHealthError(err.message || 'Health check failed');
      setHealthData(null);
      if (isKeepalivePing) {
        setPingLogs((prev) => [
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toLocaleTimeString(),
            status: 'error',
            latencyMs: latency,
            message: err.message || 'Ping failed'
          },
          ...prev.slice(0, 24)
        ]);
      }
    } finally {
      setHealthLoading(false);
    }
  }, [apiUrl]);

  // Initial Health Check
  useEffect(() => {
    checkHealth(false);
  }, [checkHealth]);

  // Keepalive Timer logic (5 min interval)
  useEffect(() => {
    if (!keepaliveActive) return;

    const timer = setInterval(() => {
      setSecondsToNextPing((prev) => {
        if (prev <= 1) {
          checkHealth(true);
          return keepaliveIntervalSec;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [keepaliveActive, keepaliveIntervalSec, checkHealth]);

  // 2. Web3 Wallet Connection Logic
  const connectWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setWalletError('MetaMask or Web3 wallet extension not found in browser.');
      return;
    }

    setIsConnecting(true);
    setWalletError(null);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const accounts = await provider.send('eth_requestAccounts', []);

      if (accounts && accounts.length > 0) {
        const addr = accounts[0];
        setAccount(addr);

        const network = await provider.getNetwork();
        const cId = Number(network.chainId);
        setChainId(cId);

        // Fetch Native ETH Balance
        const balance = await provider.getBalance(addr);
        setEthBalance(ethers.formatEther(balance));

        // Fetch USDC Balance if on Base
        if (cId === BASE_CHAIN_ID) {
          try {
            const usdcContract = new ethers.Contract(
              USDC_CONTRACT_ADDRESS,
              ['function balanceOf(address owner) view returns (uint256)'],
              provider
            );
            const rawUsdc = await usdcContract.balanceOf(addr);
            setUsdcBalance(ethers.formatUnits(rawUsdc, 6));
          } catch (usdcErr) {
            console.error('USDC balance check failed:', usdcErr);
          }
        }
      }
    } catch (err: any) {
      console.error('Wallet connection error:', err);
      setWalletError(err.message || 'Failed to connect wallet.');
    } finally {
      setIsConnecting(false);
    }
  };

  // Switch to Base Network
  const switchToBase = async () => {
    if (!(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: BASE_CHAIN_ID_HEX }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await (window as any).ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: BASE_CHAIN_ID_HEX,
                chainName: 'Base Mainnet',
                nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://mainnet.base.org'],
                blockExplorerUrls: ['https://basescan.org'],
              },
            ],
          });
        } catch (addError: any) {
          setWalletError(addError.message || 'Failed to add Base network');
        }
      } else {
        setWalletError(switchError.message || 'Failed to switch network');
      }
    }
  };

  // Listen to Wallet Account or Chain Changes
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const handleAccountsChanged = (accs: string[]) => {
        if (accs.length > 0) {
          setAccount(accs[0]);
        } else {
          setAccount(null);
          setEthBalance(null);
          setUsdcBalance(null);
        }
      };

      const handleChainChanged = (hexChainId: string) => {
        const newChainId = parseInt(hexChainId, 16);
        setChainId(newChainId);
      };

      (window as any).ethereum.on?.('accountsChanged', handleAccountsChanged);
      (window as any).ethereum.on?.('chainChanged', handleChainChanged);

      return () => {
        (window as any).ethereum.removeListener?.('accountsChanged', handleAccountsChanged);
        (window as any).ethereum.removeListener?.('chainChanged', handleChainChanged);
      };
    }
  }, []);

  // 3. API Endpoint Fetching with x402 Header Support
  const fetchEndpoint = async (endpointPath: string, customPaymentHash?: string) => {
    setEndpointLoading((prev) => ({ ...prev, [endpointPath]: true }));
    setEndpointError((prev) => ({ ...prev, [endpointPath]: null }));

    const paymentHash = customPaymentHash || endpointPaidTx[endpointPath] || txHash || manualTxHash;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (paymentHash) {
      headers['X-PAYMENT'] = paymentHash.trim();
    }

    let url = `${apiUrl}${endpointPath}`;
    if (endpointPath === '/crypto/wallet-profile') {
      const targetAddr = walletProfileAddress.trim() || account || API_WALLET_ADDRESS;
      url = `${apiUrl}${endpointPath}?address=${targetAddr}`;
    }

    try {
      const res = await fetch(url, { headers, cache: 'no-store' });
      setEndpointStatus((prev) => ({ ...prev, [endpointPath]: res.status }));

      const data = await res.json();

      if (res.status === 402) {
        setX402Challenge(data);
        setEndpointError((prev) => ({
          ...prev,
          [endpointPath]: data.error || 'Payment required (0.25 USDC on Base)',
        }));
      } else if (!res.ok) {
        setEndpointError((prev) => ({
          ...prev,
          [endpointPath]: data.error || data.detail || `HTTP Error ${res.status}`,
        }));
      } else {
        setEndpointData((prev) => ({ ...prev, [endpointPath]: data }));
        if (paymentHash) {
          setEndpointPaidTx((prev) => ({ ...prev, [endpointPath]: paymentHash }));
        }
        setX402Challenge(null);
      }
    } catch (err: any) {
      setEndpointError((prev) => ({
        ...prev,
        [endpointPath]: err.message || 'Failed to fetch endpoint data',
      }));
    } finally {
      setEndpointLoading((prev) => ({ ...prev, [endpointPath]: false }));
    }
  };

  // 4. Payment Flow Tester: Send 0.25 USDC & Fetch Endpoint
  const sendUsdcPayment = async (targetEndpoint: string = selectedEndpoint) => {
    if (!account) {
      setWalletError('Please connect your wallet first.');
      return;
    }

    if (chainId !== BASE_CHAIN_ID) {
      await switchToBase();
    }

    setIsSendingTx(true);
    setWalletError(null);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();

      const usdcContract = new ethers.Contract(
        USDC_CONTRACT_ADDRESS,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address owner) view returns (uint256)'
        ],
        signer
      );

      // Verify USDC balance
      const rawBalance = await usdcContract.balanceOf(account);
      const requiredAmount = ethers.parseUnits(PRICE_USDC, 6); // 250000

      if (rawBalance < requiredAmount) {
        throw new Error(`Insufficient USDC on Base. You need at least 0.25 USDC. Current balance: ${ethers.formatUnits(rawBalance, 6)} USDC`);
      }

      // Execute USDC Transfer
      const tx = await usdcContract.transfer(API_WALLET_ADDRESS, requiredAmount);
      const receipt = await tx.wait();

      const hash = receipt.hash || tx.hash;
      setTxHash(hash);
      setEndpointPaidTx((prev) => ({ ...prev, [targetEndpoint]: hash }));

      // Refresh USDC Balance
      const updatedBalance = await usdcContract.balanceOf(account);
      setUsdcBalance(ethers.formatUnits(updatedBalance, 6));

      // Retry Endpoint with payment header
      await fetchEndpoint(targetEndpoint, hash);
    } catch (err: any) {
      console.error('USDC Tx Error:', err);
      setWalletError(err.message || 'Payment transaction failed or rejected.');
    } finally {
      setIsSendingTx(false);
    }
  };

  // 5. Sales Monitor Fetcher
  const fetchSalesRecent = async () => {
    setSalesLoading(true);
    try {
      const res = await fetch(`${apiUrl}/sales/recent`, { cache: 'no-store' });
      if (res.ok) {
        const data: SalesResponse = await res.json();
        setSalesData(data);
      }
    } catch (err) {
      console.error('Failed to fetch sales stats:', err);
    } finally {
      setSalesLoading(false);
    }
  };

  // Fetch sales when sales tab is opened
  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesRecent();
    }
  }, [activeTab]);

  // Formatted countdown timer string
  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"></div>
        <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl"></div>
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* TOP NAVIGATION BAR */}
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            {/* Brand Logo & Protocol Status */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-cyan-500/20">
                <Cpu className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-lg tracking-tight text-slate-100">Kristo Intelligence</h1>
                  <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                    x402 Pay-Per-Call
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">On-Chain DeFi & Crypto Intelligence on Base</p>
              </div>
            </div>

            {/* Header Right Actions / Status */}
            <div className="flex items-center gap-3">
              {/* API Health Pill */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                <span className={`w-2 h-2 rounded-full ${healthData?.status === 'online' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                <span className="font-medium text-slate-300">
                  {healthData?.status === 'online' ? 'API Online' : healthLoading ? 'Checking...' : 'API Offline'}
                </span>
                {apiLatency !== null && (
                  <span className="text-slate-500 border-l border-slate-800 pl-2 font-mono">
                    {apiLatency}ms
                  </span>
                )}
              </div>

              {/* Keepalive Status Indicator */}
              <button
                onClick={() => setActiveTab('keepalive')}
                className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs transition-colors"
                title="Click to manage keepalive settings"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-slate-400">Keepalive:</span>
                <span className="font-mono text-cyan-400 font-medium">{formatCountdown(secondsToNextPing)}</span>
              </button>

              {/* Wallet Connection */}
              {!account ? (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-slate-950 font-semibold text-xs sm:text-sm shadow-md transition-all disabled:opacity-50"
                >
                  <Wallet className="w-4 h-4 text-slate-950" />
                  {isConnecting ? 'Connecting...' : 'Connect Wallet'}
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {chainId !== BASE_CHAIN_ID ? (
                    <button
                      onClick={switchToBase}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors animate-bounce"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Switch to Base
                    </button>
                  ) : (
                    <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                      <span className="text-cyan-400 font-semibold">{usdcBalance !== null ? `${parseFloat(usdcBalance).toFixed(2)} USDC` : '0.00 USDC'}</span>
                      <span className="text-slate-600">|</span>
                      <span className="text-slate-400">{ethBalance !== null ? `${parseFloat(ethBalance).toFixed(3)} ETH` : '0 ETH'}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-300">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>{account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BODY CONTAINER */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* TOP METRICS SUMMARY STRIP */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: API & Network Status */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Target API Network</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-lg font-bold text-slate-100">Base Mainnet</p>
                  <span className="text-xs text-indigo-400 font-mono font-semibold">ChainID 8453</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[180px]">{apiUrl}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Globe className="w-5 h-5" />
              </div>
            </div>

            {/* Metric 2: Pricing Structure */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">x402 Cost Per Call</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-lg font-bold text-cyan-400">0.25 USDC</p>
                  <span className="text-xs text-slate-400 font-mono">(250,000 raw)</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Pay-per-call on Base</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Coins className="w-5 h-5" />
              </div>
            </div>

            {/* Metric 3: Block & RPC Sync */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Latest Block</p>
                <p className="text-lg font-bold text-slate-100 font-mono mt-1">
                  {healthData?.block ? `#${healthData.block.toLocaleString()}` : 'Syncing...'}
                </p>
                <p className="text-xs text-emerald-400 mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Web3 Connected
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Database className="w-5 h-5" />
              </div>
            </div>

            {/* Metric 4: API Wallet Recipient */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 backdrop-blur-md flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">API Payment Wallet</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm font-bold font-mono text-slate-200">
                    {API_WALLET_ADDRESS.substring(0, 6)}...{API_WALLET_ADDRESS.substring(API_WALLET_ADDRESS.length - 4)}
                  </span>
                  <button
                    onClick={() => handleCopy(API_WALLET_ADDRESS, 'apiWallet')}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                    title="Copy API Wallet Address"
                  >
                    {copiedKey === 'apiWallet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <a
                  href={`https://basescan.org/address/${API_WALLET_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-400 hover:underline flex items-center gap-1 mt-0.5"
                >
                  View on Basescan <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Wallet className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* ERROR ALERT BANNER */}
          {walletError && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-3 animate-fade-in">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-rose-200">Wallet / Network Error</p>
                <p className="text-xs text-rose-300/90 mt-0.5">{walletError}</p>
              </div>
              <button
                onClick={() => setWalletError(null)}
                className="text-rose-400 hover:text-rose-200 text-xs font-bold"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* MAIN NAVIGATION TABS */}
          <div className="border-b border-slate-800 flex items-center gap-2 overflow-x-auto pb-px">
            <button
              onClick={() => setActiveTab('endpoints')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'endpoints'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Live Endpoint Visualizations
            </button>

            <button
              onClick={() => setActiveTab('payment')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'payment'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Zap className="w-4 h-4 text-amber-400" />
              x402 Payment Flow Tester
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'sales'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4 text-emerald-400" />
              Sales Monitor
            </button>

            <button
              onClick={() => setActiveTab('keepalive')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'keepalive'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-4 h-4 text-indigo-400" />
              Keepalive Guard
            </button>

            <button
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'docs'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/50 rounded-t-xl'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code className="w-4 h-4 text-purple-400" />
              x402 Integration Docs
            </button>
          </div>

          {/* TAB 1: ENDPOINT VISUALIZATIONS */}
          {activeTab === 'endpoints' && (
            <div className="space-y-6">
              {/* Endpoint Selector Pills */}
              <div className="flex flex-wrap items-center gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800">
                {[
                  { path: '/defi/yields', label: 'DeFi Yields', icon: Flame },
                  { path: '/defi/tvl-movers', label: 'TVL Movers', icon: TrendingUp },
                  { path: '/crypto/token-prices', label: 'Token Prices', icon: Coins },
                  { path: '/crypto/wallet-profile', label: 'Wallet Profile', icon: Wallet },
                  { path: '/crypto/whale-moves', label: 'Whale Moves', icon: Activity },
                  { path: '/crypto/gas-oracle', label: 'Gas Oracle', icon: Zap },
                ].map((ep) => {
                  const IconComp = ep.icon;
                  const isSelected = selectedEndpoint === ep.path;
                  const hasPaid = !!endpointPaidTx[ep.path];

                  return (
                    <button
                      key={ep.path}
                      onClick={() => {
                        setSelectedEndpoint(ep.path);
                        if (!endpointData[ep.path]) {
                          fetchEndpoint(ep.path);
                        }
                      }}
                      className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                        isSelected
                          ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-transparent'
                      }`}
                    >
                      <IconComp className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-500'}`} />
                      {ep.label}
                      {hasPaid && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400" title="x402 Payment Verified" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ENDPOINT ACTION & STATUS BAR */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-slate-100 font-mono">{selectedEndpoint}</h2>
                    {endpointStatus[selectedEndpoint] === 200 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> 200 OK
                      </span>
                    )}
                    {endpointStatus[selectedEndpoint] === 402 && (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Lock className="w-3 h-3" /> 402 Payment Required
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {selectedEndpoint === '/defi/yields' && 'Top Base-chain DeFi yield pools with APY, TVL & protocol breakdown'}
                    {selectedEndpoint === '/defi/tvl-movers' && 'Protocols on Base with highest 1d/7d/30d TVL shifts'}
                    {selectedEndpoint === '/crypto/token-prices' && 'Real-time token prices, 24h market metrics, and contract addresses'}
                    {selectedEndpoint === '/crypto/wallet-profile' && 'On-chain Base wallet analysis, risk scoring, and asset distribution'}
                    {selectedEndpoint === '/crypto/whale-moves' && 'Large USDC & ERC20 transfers on Base with Basescan links'}
                    {selectedEndpoint === '/crypto/gas-oracle' && 'Live Base gas prices (gwei), cost estimates, and optimal recommendation'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {/* Address input if wallet profile endpoint */}
                  {selectedEndpoint === '/crypto/wallet-profile' && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Wallet Address (0x...)"
                        value={walletProfileAddress}
                        onChange={(e) => setWalletProfileAddress(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
                      />
                    </div>
                  )}

                  <button
                    onClick={() => fetchEndpoint(selectedEndpoint)}
                    disabled={endpointLoading[selectedEndpoint]}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${endpointLoading[selectedEndpoint] ? 'animate-spin text-cyan-400' : ''}`} />
                    Query API
                  </button>

                  <button
                    onClick={() => sendUsdcPayment(selectedEndpoint)}
                    disabled={isSendingTx}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-md transition-all disabled:opacity-50"
                  >
                    <Zap className="w-3.5 h-3.5 text-slate-950 fill-slate-950" />
                    {isSendingTx ? 'Processing Tx...' : 'Pay 0.25 USDC & Fetch'}
                  </button>
                </div>
              </div>

              {/* 402 PAYMENT CHALLENGE BOX IF RETURNED */}
              {endpointError[selectedEndpoint] && (
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Lock className="w-4 h-4 text-amber-400" />
                      <span className="font-bold text-amber-300">x402 Payment Required</span>
                    </div>
                    <span className="text-amber-400 font-mono">0.25 USDC on Base</span>
                  </div>
                  <p className="text-slate-300">{endpointError[selectedEndpoint]}</p>

                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 font-mono text-slate-300 space-y-1">
                    <p><span className="text-slate-500">Scheme:</span> exact</p>
                    <p><span className="text-slate-500">Asset:</span> USDC on Base ({USDC_CONTRACT_ADDRESS})</p>
                    <p><span className="text-slate-500">Recipient:</span> {API_WALLET_ADDRESS}</p>
                    <p><span className="text-slate-500">Header Required:</span> X-PAYMENT: &lt;transaction_hash&gt;</p>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-slate-400">Previewing high-fidelity sample response below until transaction is completed:</span>
                    <button
                      onClick={() => sendUsdcPayment(selectedEndpoint)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold hover:bg-amber-400 transition-colors"
                    >
                      Pay Now with Connected Wallet
                    </button>
                  </div>
                </div>
              )}

              {/* VISUALIZATION CONTAINER FOR SELECTED ENDPOINT */}
              {(() => {
                // Determine data source (Live response if 200 OK, otherwise Mock Preview)
                const isLive = endpointStatus[selectedEndpoint] === 200 && endpointData[selectedEndpoint];
                const activeData = isLive ? endpointData[selectedEndpoint] : MOCK_PREVIEW_DATA[selectedEndpoint];

                return (
                  <div className="space-y-4">
                    {/* Mode Indicator Banner */}
                    <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        {isLive ? (
                          <>
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                            <span className="font-semibold text-emerald-400">Live x402 Paid Data</span>
                            {endpointPaidTx[selectedEndpoint] && (
                              <span className="text-slate-400 font-mono truncate max-w-xs">
                                Tx: {endpointPaidTx[selectedEndpoint].substring(0, 10)}...
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="font-medium text-amber-300">Interactive Preview Mode</span>
                            <span className="text-slate-500">(Connect wallet & send 0.25 USDC to verify live backend)</span>
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(JSON.stringify(activeData, null, 2), 'rawJson')}
                          className="flex items-center gap-1 text-slate-400 hover:text-slate-200 transition-colors"
                        >
                          {copiedKey === 'rawJson' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          Copy Raw JSON
                        </button>
                      </div>
                    </div>

                    {/* ENDPOINT 1: YIELDS VISUALIZATION */}
                    {selectedEndpoint === '/defi/yields' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(activeData?.data || activeData?.yields || []).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/40 transition-all hover:shadow-lg hover:shadow-cyan-500/5 group"
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-100 text-base">{item.project}</span>
                                  <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                                    {item.chain || 'Base'}
                                  </span>
                                </div>
                                <p className="text-xs font-mono text-slate-400 mt-0.5">{item.pool}</p>
                              </div>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  item.risk === 'Low'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : item.risk === 'Medium'
                                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}
                              >
                                {item.risk || 'DeFi'}
                              </span>
                            </div>

                            <div className="my-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-baseline justify-between">
                              <div>
                                <p className="text-[10px] text-slate-400 uppercase font-medium">Total APY</p>
                                <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
                                  {item.apy}%
                                </p>
                              </div>
                              <div className="text-right text-xs space-y-0.5">
                                <p className="text-slate-400">Base: <span className="text-slate-200 font-mono">{item.base_apy}%</span></p>
                                {item.reward_apy > 0 && (
                                  <p className="text-indigo-400 font-medium">Rewards: <span className="font-mono">{item.reward_apy}%</span></p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/60">
                              <span>TVL</span>
                              <span className="font-mono font-bold text-slate-200">{formatCompactUSD(item.tvl_usd)}</span>
                            </div>

                            {item.reward_tokens && item.reward_tokens.length > 0 && (
                              <div className="mt-3 flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500">Rewards in:</span>
                                {item.reward_tokens.map((tok: string, tIdx: number) => (
                                  <span key={tIdx} className="px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 text-[10px] font-mono border border-indigo-500/20">
                                    ${tok}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ENDPOINT 2: TVL MOVERS VISUALIZATION */}
                    {selectedEndpoint === '/defi/tvl-movers' && (
                      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                              <th className="py-3 px-4">Protocol</th>
                              <th className="py-3 px-4">Category</th>
                              <th className="py-3 px-4">TVL ($)</th>
                              <th className="py-3 px-4">1d Change</th>
                              <th className="py-3 px-4">7d Change</th>
                              <th className="py-3 px-4">30d Change</th>
                              <th className="py-3 px-4 text-right">Dominance</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-sm font-mono">
                            {(activeData?.protocols || activeData?.data || []).map((p: any, idx: number) => (
                              <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                                <td className="py-3 px-4 font-sans font-bold text-slate-100 flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-lg bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-xs font-bold">
                                    {p.name.substring(0, 1)}
                                  </span>
                                  {p.name}
                                </td>
                                <td className="py-3 px-4 text-xs font-sans text-slate-400">
                                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                    {p.category}
                                  </span>
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-200">
                                  {formatCompactUSD(p.tvl_usd)}
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                    p.change_1d >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {p.change_1d >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                    {p.change_1d >= 0 ? `+${p.change_1d}%` : `${p.change_1d}%`}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                    p.change_7d >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {p.change_7d >= 0 ? `+${p.change_7d}%` : `${p.change_7d}%`}
                                  </span>
                                </td>
                                <td className="py-3 px-4">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                                    p.change_30d >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                  }`}>
                                    {p.change_30d >= 0 ? `+${p.change_30d}%` : `${p.change_30d}%`}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                      <div
                                        className="h-full bg-cyan-400 rounded-full"
                                        style={{ width: `${Math.min(p.dominance || 10, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs text-slate-400">{p.dominance}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* ENDPOINT 3: TOKEN PRICES VISUALIZATION */}
                    {selectedEndpoint === '/crypto/token-prices' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {(activeData?.tokens || activeData?.data || []).map((tok: any, idx: number) => (
                          <div key={idx} className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center font-bold text-cyan-400">
                                  ${tok.symbol}
                                </div>
                                <div>
                                  <h3 className="font-bold text-slate-100 text-sm">{tok.name}</h3>
                                  <span className="text-xs text-slate-500 font-mono">${tok.symbol}</span>
                                </div>
                              </div>

                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                tok.change_24h >= 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              }`}>
                                {tok.change_24h >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                                {tok.change_24h >= 0 ? `+${tok.change_24h}%` : `${tok.change_24h}%`}
                              </span>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80">
                              <p className="text-[10px] text-slate-400 uppercase font-medium">Price (USD)</p>
                              <p className="text-2xl font-black font-mono text-slate-100 mt-0.5">
                                {formatUSD(tok.price_usd)}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                              <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/50">
                                <span className="text-[10px] text-slate-500 block">24h Volume</span>
                                <span className="font-bold text-slate-300">{formatCompactUSD(tok.volume_24h)}</span>
                              </div>
                              <div className="p-2 rounded-lg bg-slate-950/50 border border-slate-800/50">
                                <span className="text-[10px] text-slate-500 block">Market Cap</span>
                                <span className="font-bold text-slate-300">{formatCompactUSD(tok.market_cap)}</span>
                              </div>
                            </div>

                            {tok.address && (
                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                                <span>Address:</span>
                                <div className="flex items-center gap-1">
                                  <span>{tok.address.substring(0, 6)}...{tok.address.substring(tok.address.length - 4)}</span>
                                  <button
                                    onClick={() => handleCopy(tok.address, `tok_${tok.symbol}`)}
                                    className="p-1 hover:text-slate-200"
                                  >
                                    {copiedKey === `tok_${tok.symbol}` ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ENDPOINT 4: WALLET PROFILE VISUALIZATION */}
                    {selectedEndpoint === '/crypto/wallet-profile' && (
                      <div className="space-y-4">
                        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 grid grid-cols-1 lg:grid-cols-3 gap-6">
                          {/* Wallet Header & Risk Card */}
                          <div className="lg:col-span-1 space-y-4">
                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-400 font-medium">Risk Score</span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {activeData?.risk_classification || 'Low Risk'}
                                </span>
                              </div>

                              <div>
                                <p className="text-xs text-slate-400">Analyzed Address</p>
                                <p className="text-sm font-mono font-bold text-cyan-400 truncate mt-0.5">
                                  {activeData?.address || walletProfileAddress || account || API_WALLET_ADDRESS}
                                </p>
                              </div>

                              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                                <span className="text-xs text-slate-400">Total Net Worth</span>
                                <span className="text-lg font-bold font-mono text-slate-100">
                                  {formatUSD(activeData?.net_worth_usd)}
                                </span>
                              </div>
                            </div>

                            <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2 text-xs">
                              <p className="font-semibold text-slate-300">Activity Overview</p>
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Total Transactions</span>
                                <span className="font-mono text-slate-200">{activeData?.stats?.total_tx_count || 1420}</span>
                              </div>
                              <div className="flex justify-between py-1 border-b border-slate-800/60">
                                <span className="text-slate-400">Active Days</span>
                                <span className="font-mono text-slate-200">{activeData?.stats?.active_days || 184} days</span>
                              </div>
                              <div className="flex justify-between py-1">
                                <span className="text-slate-400">First Active</span>
                                <span className="font-mono text-slate-200">{activeData?.stats?.first_tx_date || '2024-02-15'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Asset Allocation Breakdown */}
                          <div className="lg:col-span-2 space-y-4">
                            <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                              <PieChart className="w-4 h-4 text-cyan-400" />
                              Asset Breakdown & Positions
                            </h3>

                            <div className="space-y-3">
                              {(activeData?.balances || []).map((b: any, bIdx: number) => (
                                <div key={bIdx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                                  <div className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-2 font-bold text-slate-200">
                                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                                      {b.asset}
                                    </div>
                                    <div className="text-right font-mono">
                                      <span className="font-bold text-slate-100">{formatUSD(b.value_usd)}</span>
                                      <span className="text-slate-500 ml-2">({b.amount} {b.asset})</span>
                                    </div>
                                  </div>
                                  <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                    <div
                                      className="h-full bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full"
                                      style={{ width: `${Math.min(b.share || 20, 100)}%` }}
                                    />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ENDPOINT 5: WHALE MOVES VISUALIZATION */}
                    {selectedEndpoint === '/crypto/whale-moves' && (
                      <div className="space-y-3">
                        {(activeData?.transfers || activeData?.moves || []).map((m: any, mIdx: number) => (
                          <div
                            key={mIdx}
                            className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-cyan-500/30 transition-all flex flex-wrap items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                                <Activity className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-100 text-sm font-mono">
                                    {m.amount.toLocaleString()} {m.token}
                                  </span>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                                    {m.type || 'Transfer'}
                                  </span>
                                </div>
                                <p className="text-xs font-mono text-slate-400 mt-0.5">
                                  From: <span className="text-slate-300">{m.from.substring(0, 6)}...</span> → To: <span className="text-slate-300">{m.to.substring(0, 6)}...</span>
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="text-sm font-bold text-emerald-400 font-mono">{formatUSD(m.value_usd)}</p>
                                <p className="text-[10px] text-slate-500">{m.time_ago || 'Recently'}</p>
                              </div>

                              <a
                                href={`https://basescan.org/tx/${m.tx_hash}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                                title="View on Basescan"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* ENDPOINT 6: GAS ORACLE VISUALIZATION */}
                    {selectedEndpoint === '/crypto/gas-oracle' && (
                      <div className="space-y-6">
                        {/* Recommendation Banner */}
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/30 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 text-emerald-400" />
                            <div>
                              <h3 className="font-bold text-slate-100 text-sm">{activeData?.recommendation || 'Optimal Network Conditions'}</h3>
                              <p className="text-xs text-slate-400">Congestion Level: <span className="text-emerald-400 font-semibold">{activeData?.congestion_level || 'Low'}</span></p>
                            </div>
                          </div>
                          <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                            Base L2 Gas
                          </span>
                        </div>

                        {/* Gas Speed Tiers */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          {[
                            { key: 'slow', label: 'Slow', color: 'slate' },
                            { key: 'standard', label: 'Standard', color: 'cyan' },
                            { key: 'fast', label: 'Fast', color: 'indigo' },
                            { key: 'instant', label: 'Instant', color: 'emerald' },
                          ].map((tier) => {
                            const info = activeData?.gas_tiers?.[tier.key] || { gwei: 0.01, est_sec: 2 };
                            return (
                              <div key={tier.key} className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 text-center space-y-1">
                                <span className="text-xs text-slate-400 uppercase font-medium">{tier.label}</span>
                                <p className="text-xl font-bold font-mono text-slate-100">{info.gwei} Gwei</p>
                                <p className="text-[10px] text-slate-500">~{info.est_sec}s confirmation</p>
                              </div>
                            );
                          })}
                        </div>

                        {/* Cost Estimates in USD */}
                        <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
                          <h3 className="font-bold text-sm text-slate-200">Transaction Cost Estimates (USD)</h3>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                              <p className="text-xs text-slate-400">USDC Transfer</p>
                              <p className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                                ${activeData?.cost_estimates_usd?.usdc_transfer || '0.0018'}
                              </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                              <p className="text-xs text-slate-400">Uniswap V3 Swap</p>
                              <p className="text-lg font-bold font-mono text-indigo-400 mt-0.5">
                                ${activeData?.cost_estimates_usd?.uniswap_v3_swap || '0.0142'}
                              </p>
                            </div>

                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                              <p className="text-xs text-slate-400">Aerodrome Deposit</p>
                              <p className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                                ${activeData?.cost_estimates_usd?.aerodrome_add_lp || '0.0210'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* TAB 2: x402 PAYMENT FLOW TESTER */}
          {activeTab === 'payment' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    x402 Protocol Payment Sandbox
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Test the complete x402 payment cycle: receive a 402 Payment Challenge, execute a 0.25 USDC transfer on Base, and retry with the transaction hash in the X-PAYMENT header.
                  </p>
                </div>

                {/* Step Flow Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1 */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-cyan-400">
                      <span className="w-5 h-5 rounded-full bg-cyan-500/20 flex items-center justify-center">1</span>
                      Connect & Check Base
                    </div>
                    <p className="text-xs text-slate-400">
                      Ensure wallet is connected to Base Mainnet (Chain ID 8453) with at least 0.25 USDC balance.
                    </p>
                    <div className="pt-2">
                      {!account ? (
                        <button
                          onClick={connectWallet}
                          className="w-full py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold text-xs hover:bg-cyan-400 transition-colors"
                        >
                          Connect Wallet
                        </button>
                      ) : (
                        <div className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Connected: {account.substring(0, 6)}...
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-amber-400">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">2</span>
                      Send 0.25 USDC
                    </div>
                    <p className="text-xs text-slate-400">
                      Transfers 0.25 USDC directly to API Wallet <span className="font-mono text-slate-300">{API_WALLET_ADDRESS.substring(0, 6)}...</span>
                    </p>
                    <div className="pt-2">
                      <button
                        onClick={() => sendUsdcPayment(selectedEndpoint)}
                        disabled={!account || isSendingTx}
                        className="w-full py-2 rounded-lg bg-gradient-to-r from-amber-500 to-emerald-500 text-slate-950 font-bold text-xs hover:from-amber-400 hover:to-emerald-400 transition-colors disabled:opacity-50"
                      >
                        {isSendingTx ? 'Processing Tx...' : 'Send 0.25 USDC Payment'}
                      </button>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-xs text-indigo-400">
                      <span className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center">3</span>
                      Fetch with X-PAYMENT
                    </div>
                    <p className="text-xs text-slate-400">
                      Include transaction hash in header <span className="font-mono text-slate-300">X-PAYMENT</span> to verify and unlock response.
                    </p>
                    <div className="pt-2">
                      {txHash ? (
                        <div className="text-xs font-mono text-cyan-400 truncate">
                          Tx: {txHash.substring(0, 10)}...
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Awaiting transaction...</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Manual Tx Hash Input for Verification */}
                <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-xs text-slate-300">Or Enter Pre-existing Transaction Hash for Manual Verification</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="0x... (Base Tx Hash)"
                      value={manualTxHash}
                      onChange={(e) => setManualTxHash(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      onClick={() => fetchEndpoint(selectedEndpoint, manualTxHash)}
                      disabled={!manualTxHash}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors disabled:opacity-50"
                    >
                      Verify & Fetch
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SALES MONITOR */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-100">API Sales & Revenue Monitor</h2>
                  <p className="text-xs text-slate-400">Real-time payment history fetched from /sales/recent</p>
                </div>
                <button
                  onClick={fetchSalesRecent}
                  disabled={salesLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${salesLoading ? 'animate-spin text-cyan-400' : ''}`} />
                  Refresh Sales
                </button>
              </div>

              {/* Revenue Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium">Total Calls Sold</p>
                    <p className="text-3xl font-black font-mono text-cyan-400 mt-1">
                      {salesData?.total_sales ?? 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-medium">Total Revenue Generated</p>
                    <p className="text-3xl font-black font-mono text-emerald-400 mt-1">
                      {formatUSD((salesData?.total_sales ?? 0) * 0.01)}
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </div>
              </div>

              {/* Recent Sales Table */}
              <div className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4">
                <h3 className="font-bold text-sm text-slate-200">Recent API Purchase Feed</h3>

                {(!salesData?.recent || salesData.recent.length === 0) ? (
                  <div className="p-8 text-center text-slate-500 text-xs space-y-2">
                    <Info className="w-6 h-6 mx-auto text-slate-600" />
                    <p>No recent purchases recorded yet on this instance.</p>
                    <p className="text-slate-600">Transactions processed via x402 headers will automatically show here.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                          <th className="py-2.5 px-3">Caller</th>
                          <th className="py-2.5 px-3">Endpoint</th>
                          <th className="py-2.5 px-3">Amount</th>
                          <th className="py-2.5 px-3">Tx Hash</th>
                          <th className="py-2.5 px-3 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs font-mono text-slate-300">
                        {salesData.recent.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-800/40">
                            <td className="py-2.5 px-3 font-semibold text-cyan-400">
                              {s.caller_address || s.payer ? `${(s.caller_address || s.payer!).substring(0, 6)}...` : 'Anonymous'}
                            </td>
                            <td className="py-2.5 px-3 text-slate-200">{s.endpoint || '/defi/yields'}</td>
                            <td className="py-2.5 px-3 text-emerald-400 font-bold">{s.amount || '0.25'} USDC</td>
                            <td className="py-2.5 px-3">
                              {s.tx_hash ? (
                                <a
                                  href={`https://basescan.org/tx/${s.tx_hash}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-indigo-400 hover:underline flex items-center gap-1"
                                >
                                  {s.tx_hash.substring(0, 10)}... <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                'Verified'
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-500">
                              {s.timestamp || s.created_at || 'Just now'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: KEEPALIVE MANAGER */}
          {activeTab === 'keepalive' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                      <Activity className="w-5 h-5 text-indigo-400" />
                      Render Cold-Start Keepalive Guard
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      Periodically pings the API health endpoint every 5 minutes to prevent Render free-tier instance spinning down.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setKeepaliveActive(!keepaliveActive)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 ${
                        keepaliveActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {keepaliveActive ? <Play className="w-3.5 h-3.5 fill-emerald-300" /> : <Pause className="w-3.5 h-3.5" />}
                      {keepaliveActive ? 'Keepalive Active' : 'Keepalive Paused'}
                    </button>

                    <button
                      onClick={() => {
                        checkHealth(true);
                        setSecondsToNextPing(keepaliveIntervalSec);
                      }}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
                    >
                      Ping Health Now
                    </button>
                  </div>
                </div>

                {/* Timer Display */}
                <div className="p-6 rounded-2xl bg-slate-950/90 border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Next Scheduled Health Ping In</p>
                  <p className="text-5xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400">
                    {formatCountdown(secondsToNextPing)}
                  </p>
                  <p className="text-xs text-slate-500">Interval: Every 5 minutes (300 seconds)</p>
                </div>

                {/* Ping History Log */}
                <div className="space-y-3">
                  <h3 className="font-bold text-sm text-slate-200">Recent Ping Audit Log</h3>
                  {pingLogs.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/50 rounded-xl border border-slate-800">
                      No keepalive pings logged yet in this session.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pingLogs.map((log) => (
                        <div
                          key={log.id}
                          className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs font-mono"
                        >
                          <div className="flex items-center gap-3">
                            {log.status === 'success' ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                            )}
                            <span className="text-slate-300">{log.timestamp}</span>
                            <span className="text-slate-500">GET /health</span>
                          </div>

                          <div className="flex items-center gap-4">
                            {log.block && (
                              <span className="text-slate-400 hidden sm:inline">Block #{log.block}</span>
                            )}
                            <span className={`font-bold ${log.status === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {log.latencyMs}ms
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: x402 INTEGRATION DOCS & CODE */}
          {activeTab === 'docs' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                    <Code className="w-5 h-5 text-purple-400" />
                    x402 AI Agent Developer Documentation
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    How AI agents and applications interact with Kristo Intelligence pay-per-call API endpoints using HTTP 402 headers.
                  </p>
                </div>

                {/* Example 1: cURL */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                    <span>1. cURL Request with X-PAYMENT Header</span>
                    <button
                      onClick={() => handleCopy(`curl -X GET "${apiUrl}/defi/yields" \\\n  -H "X-PAYMENT: 0x_YOUR_BASE_USDC_TX_HASH"`, 'curl')}
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'curl' ? 'Copied!' : 'Copy cURL'}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-cyan-300 overflow-x-auto">
{`curl -X GET "${apiUrl}/defi/yields" \\
  -H "X-PAYMENT: 0x_YOUR_BASE_USDC_TX_HASH"`}
                  </pre>
                </div>

                {/* Example 2: Python */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300 font-semibold">
                    <span>2. Python Requests Integration</span>
                    <button
                      onClick={() => handleCopy(`import requests\n\nheaders = {"X-PAYMENT": "0x_YOUR_BASE_USDC_TX_HASH"}\nresponse = requests.get("${apiUrl}/defi/yields", headers=headers)\nprint(response.json())`, 'py')}
                      className="text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      {copiedKey === 'py' ? 'Copied!' : 'Copy Python'}
                    </button>
                  </div>
                  <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-indigo-300 overflow-x-auto">
{`import requests

headers = {"X-PAYMENT": "0x_YOUR_BASE_USDC_TX_HASH"}
response = requests.get("${apiUrl}/defi/yields", headers=headers)
print(response.json())`}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* FOOTER */}
        <footer className="border-t border-slate-800/80 bg-slate-900/40 backdrop-blur-md py-6 mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300">Kristo Intelligence</span>
              <span>•</span>
              <span>x402 Pay-Per-Call Monitoring Dashboard</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Base Mainnet (8453)</span>
              <span>•</span>
              <span>0.25 USDC / call</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
