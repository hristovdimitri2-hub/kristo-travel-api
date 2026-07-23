'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity, CircleDollarSign, Globe, RefreshCw, Clock, Wallet,
  Zap, Server, AlertTriangle, TrendingUp, ExternalLink,
  Bell, BellOff, Radio, Eye, Wifi, WifiOff, Timer,
  Copy, Check, ArrowRight, Send, Loader2, CreditCard, ShieldCheck
} from 'lucide-react'

interface HealthData {
  status: string
  web3_connected: boolean
  wallet: string
  network: string
  rpc: string
}

interface X402Response {
  x402_version: number
  accepts: {
    scheme: string
    network: string
    asset: string
    amount: string
    payTo: string
    description: string
  }
  error: string
}

interface Transaction {
  hash: string
  from: string
  value: string
  timestamp: string
  block: string
}

interface BasescanData {
  transactions: Transaction[]
  total_usdc: string
  count_24h: number
  error?: string
  source?: string
}

interface KeepaliveData {
  ok: boolean
  render_status: string
  last_pings: string[]
  next_ping_in: string
}

type PaymentStep = 'idle' | 'connecting' | 'ready' | 'sending' | 'confirming' | 'fetching' | 'success' | 'error' | 'manual'

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
  )
}

function SaleFlash({ children }: { children: React.ReactNode }) {
  return (
    <div className="animate-pulse bg-emerald-500/10 rounded-lg p-4 border border-emerald-500/30">
      {children}
    </div>
  )
}

// Minimal ABI for USDC transfer
const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)'
]

const BASE_CHAIN_ID = '0x2105' // 8453 in hex
const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
const API_WALLET = '0xd4cdA980839C8FED4374EE37EA8DBE8c4ECfd88f'
const PRICE_USDC = '0.25'

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [x402response, setX402response] = useState<X402Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>('-')
  const [logs, setLogs] = useState<Array<{ time: string; type: 'success' | 'error' | 'info' | 'payment' | 'warning'; message: string }>>([])
  const [basescan, setBasescan] = useState<BasescanData | null>(null)
  const [keepalive, setKeepalive] = useState<KeepaliveData | null>(null)
  const [monitoring, setMonitoring] = useState(true)
  const [newSaleFlash, setNewSaleFlash] = useState(false)
  const prevTxCount = useRef(0)
  const prevTxHashes = useRef<Set<string>>(new Set())
  const saleSoundRef = useRef(false)

  // Payment test state
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle')
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [walletBalance, setWalletBalance] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string>('')
  const [manualTxHash, setManualTxHash] = useState<string>('')
  const [travelData, setTravelData] = useState<any>(null)
  const [paymentError, setPaymentError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const playSaleSound = useCallback(() => {
    if (saleSoundRef.current) return
    try {
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      osc.type = 'sine'
      gain.gain.value = 0.1
      osc.start()
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
      osc.stop(ctx.currentTime + 0.5)
      saleSoundRef.current = true
      setTimeout(() => { saleSoundRef.current = false }, 5000)
    } catch { /* Audio not available */ }
  }, [])

  const sendNotification = useCallback((title: string, body: string) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/logo.svg',
          badge: '/logo.svg',
          tag: 'kristo-sale-' + Date.now(),
        })
      } catch { /* Notification failed */ }
    }
  }, [])

  const addLog = useCallback((type: 'success' | 'error' | 'info' | 'payment' | 'warning', message: string) => {
    const now = new Date().toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [{ time: now, type, message }, ...prev].slice(0, 50))
  }, [])

  const checkHealth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kristo?endpoint=/health')
      const json = await res.json()
      if (json.status === 200) {
        setHealth(json.data)
      } else {
        setHealth(null)
        addLog('error', 'API недостъпен — сървърът може да спи')
      }
      setLastCheck(new Date().toLocaleTimeString('bg-BG'))
    } catch {
      addLog('error', 'Грешка при свързване с API')
    }
    setLoading(false)
  }, [addLog])

  const checkPayments = useCallback(async () => {
    try {
      const res = await fetch('/api/basescan')
      const data: BasescanData = await res.json()
      
      const currentHashes = new Set(data.transactions.map(t => t.hash))
      const newHashes = [...currentHashes].filter(h => !prevTxHashes.current.has(h))
      
      if (newHashes.length > 0 && prevTxHashes.current.size > 0) {
        const newTxs = data.transactions.filter(t => newHashes.includes(t.hash))
        const totalNew = newTxs.reduce((s, t) => s + parseFloat(t.value), 0)
        
        addLog('payment', `НОВА ПРОДАЖБА! +${totalNew.toFixed(2)} USDC от ${newTxs.length} транзакции!`)
        playSaleSound()
        sendNotification(
          `${totalNew.toFixed(2)} USDC Продажба!`,
          `Нова продажба в Kristo Travel API: +${totalNew.toFixed(2)} USDC`
        )
        setNewSaleFlash(true)
        setTimeout(() => setNewSaleFlash(false), 10000)
      }
      
      if (prevTxCount.current >= 0 && newHashes.length === 0 && data.count_24h > prevTxCount.current && prevTxCount.current > 0) {
        addLog('payment', `Продажби: ${data.total_usdc} USDC (${data.count_24h} транзакции за 24ч)`)
      }
      
      prevTxCount.current = data.count_24h
      prevTxHashes.current = currentHashes
      setBasescan(data)

      if (data.count_24h === 0 && !data.error && prevTxHashes.current.size === 1) {
        addLog('warning', 'Няма продажби през последните 24 часа')
      }
    } catch {
      // RPC might fail
    }
  }, [addLog, playSaleSound, sendNotification])

  const checkKeepalive = useCallback(async () => {
    try {
      const res = await fetch('/api/keepalive')
      const data: KeepaliveData = await res.json()
      setKeepalive(data)
      if (data.render_status === 'online') {
        addLog('info', 'Render API е буден (auto-ping)')
      } else if (data.render_status === 'unreachable') {
        addLog('warning', 'Render API не отговаря — събуждане...')
      }
    } catch {
      // ignore
    }
  }, [addLog])

  const testPayment = useCallback(async () => {
    setTesting(true)
    addLog('info', 'Тестване на x402 платежен endpoint...')
    try {
      const res = await fetch('/api/kristo?endpoint=/travel/weekend-getaway')
      const json = await res.json()
      if (json.data?.x402_version) {
        setX402response(json.data)
        addLog('success', 'x402 връща 402 — чака плащане от 0.25 USDC')
      } else if (json.data?.product) {
        addLog('payment', 'ПЛАЩАНЕ ПОТВЪРДЕНО! Данните са доставени.')
      } else {
        addLog('error', 'Неочакван отговор от API-то')
      }
    } catch {
      addLog('error', 'Грешка при тестване')
    }
    setTesting(false)
  }, [addLog])

  // ===== WALLET PAYMENT FLOW =====
  const hasWallet = typeof window !== 'undefined' && !!(window as any).ethereum

  const connectWallet = useCallback(async () => {
    setPaymentStep('connecting')
    setPaymentError('')
    try {
      const ethereum = (window as any).ethereum
      if (!ethereum) {
        setPaymentError('Крипто портфейл не е намерен. Инсталирай MetaMask или отвори в crypto browser.')
        setPaymentStep('error')
        return
      }
      
      // Request accounts
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' })
      const addr = accounts[0]
      setWalletAddress(addr)
      addLog('info', `Портфейл свързан: ${addr.slice(0, 10)}...${addr.slice(-6)}`)
      
      // Switch to Base network
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: BASE_CHAIN_ID }]
        })
      } catch (switchError: any) {
        // If chain not added, add it
        if (switchError.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: BASE_CHAIN_ID,
              chainName: 'Base',
              nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org']
            }]
          })
        } else {
          throw switchError
        }
      }
      
      // Check USDC balance using raw eth_call
      const balanceHex = await ethereum.request({
        method: 'eth_call',
        params: [{
          to: USDC_ADDRESS,
          data: '0x70a08231' + addr.slice(2).padStart(64, '0')
        }, 'latest']
      })
      const balanceRaw = parseInt(balanceHex, 16)
      const balanceUSDC = balanceRaw / 1e6
      setWalletBalance(balanceUSDC.toFixed(2))
      
      if (balanceUSDC < 0.25) {
        addLog('warning', `Баланс: ${balanceUSDC.toFixed(2)} USDC — нужни са 0.25 USDC`)
      } else {
        addLog('success', `USDC баланс: ${balanceUSDC.toFixed(2)} — готов за плащане`)
      }
      
      setPaymentStep('ready')
    } catch (err: any) {
      setPaymentError(err.message || 'Грешка при свързване с портфейла')
      setPaymentStep('error')
      addLog('error', `Грешка портфейл: ${err.message || 'неизвестна'}`)
    }
  }, [addLog])

  const sendUSDCTransfer = useCallback(async () => {
    if (!walletAddress) return
    setPaymentStep('sending')
    setPaymentError('')
    addLog('info', 'Изпращане на 0.25 USDC на Base...')
    
    try {
      const ethereum = (window as any).ethereum
      
      // USDC transfer(address to, uint256 amount)
      // amount = 0.25 * 10^6 = 250000
      const amountHex = '0x' + (250000).toString(16).padStart(64, '0')
      const toPadded = API_WALLET.slice(2).padStart(64, '0')
      
      const txHashResult = await ethereum.request({
        method: 'eth_sendTransaction',
        params: [{
          from: walletAddress,
          to: USDC_ADDRESS,
          data: '0xa9059cbb' + toPadded + amountHex,
        }]
      })
      
      setTxHash(txHashResult)
      setPaymentStep('confirming')
      addLog('info', `Транзакция изпратена: ${txHashResult.slice(0, 18)}...`)
      
      // Wait for confirmation
      let receipt: any = null
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 2000))
        try {
          receipt = await ethereum.request({
            method: 'eth_getTransactionReceipt',
            params: [txHashResult]
          })
          if (receipt) break
        } catch { /* retry */ }
      }
      
      if (!receipt || receipt.status !== '0x1') {
        setPaymentError('Транзакцията се потвърждава или е неуспешна. Моля изчакайте и опитайте отново.')
        setPaymentStep('error')
        addLog('error', 'Транзакцията не е потвърдена')
        return
      }
      
      addLog('success', 'USDC транзакция потвърдена на Base!')
      setPaymentStep('fetching')
      
      // Now call the API with the tx hash
      addLog('info', 'Заявка за данни с tx_hash...')
      const apiRes = await fetch(`/api/kristo?endpoint=/travel/weekend-getaway&x-payment=${txHashResult}`)
      const apiJson = await apiRes.json()
      
      if (apiJson.status === 200 && apiJson.data?.product) {
        setTravelData(apiJson.data)
        setPaymentStep('success')
        addLog('payment', 'УСПЕХ! Данните за пътуване са получени след реално плащане!')
        playSaleSound()
        sendNotification(
          'Плащане потвърдено!',
          '0.25 USDC получени — данните са доставени.'
        )
        // Refresh payments
        setTimeout(() => checkPayments(), 3000)
      } else {
        setPaymentError(apiJson.data?.error || 'API не прие плащането. Опитайте отново.')
        setPaymentStep('error')
        addLog('error', `API отхвърли плащането: ${apiJson.data?.error || 'неизвестна грешка'}`)
      }
    } catch (err: any) {
      setPaymentError(err.message || 'Грешка при изпращане на USDC')
      setPaymentStep('error')
      addLog('error', `USDC грешка: ${err.message || 'неизвестна'}`)
    }
  }, [walletAddress, addLog, playSaleSound, sendNotification, checkPayments])

  const fetchWithManualTx = useCallback(async () => {
    if (!manualTxHash.trim()) return
    setPaymentStep('fetching')
    setPaymentError('')
    addLog('info', `Проверка на tx: ${manualTxHash.slice(0, 18)}...`)
    
    try {
      const apiRes = await fetch(`/api/kristo?endpoint=/travel/weekend-getaway&x-payment=${manualTxHash.trim()}`)
      const apiJson = await apiRes.json()
      
      if (apiJson.status === 200 && apiJson.data?.product) {
        setTravelData(apiJson.data)
        setTxHash(manualTxHash.trim())
        setPaymentStep('success')
        addLog('payment', 'УСПЕХ! Данните са доставени след потвърждение на плащането!')
        playSaleSound()
        sendNotification('Плащане потвърдено!', '0.25 USDC получени — данните са доставени.')
        setTimeout(() => checkPayments(), 3000)
      } else {
        setPaymentError(apiJson.data?.error || 'Транзакцията не е валидно плащане')
        setPaymentStep('error')
        addLog('error', `Невалидно: ${apiJson.data?.error || 'неизвестна грешка'}`)
      }
    } catch (err: any) {
      setPaymentError('Грешка при проверка на транзакцията')
      setPaymentStep('error')
    }
  }, [manualTxHash, addLog, playSaleSound, sendNotification, checkPayments])

  const copyAddress = useCallback(() => {
    navigator.clipboard.writeText(API_WALLET)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  // Initial load
  useEffect(() => {
    checkHealth()
    checkPayments()
  }, [checkHealth, checkPayments])

  // Auto-monitoring every 30s
  useEffect(() => {
    if (!monitoring) return
    const interval = setInterval(() => { checkPayments() }, 30000)
    return () => clearInterval(interval)
  }, [monitoring, checkPayments])

  // Keep-alive every 14 min
  useEffect(() => {
    const ping = () => checkKeepalive()
    ping()
    const interval = setInterval(ping, 14 * 60 * 1000)
    return () => clearInterval(interval)
  }, [checkKeepalive])

  const noSales24h = basescan !== null && basescan.count_24h === 0 && !basescan.error
  const hasSales = basescan !== null && basescan.count_24h > 0
  const renderOnline = keepalive?.render_status === 'online'

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Kristo Travel</h1>
              <p className="text-xs text-zinc-500">x402 Pay-per-Call</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {renderOnline ? (
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px]">
                <Wifi className="w-3 h-3 mr-1" /> LIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px]">
                <WifiOff className="w-3 h-3 mr-1" /> OFFLINE
              </Badge>
            )}
            <Button
              variant="ghost" size="icon"
              className={monitoring ? 'text-emerald-400' : 'text-zinc-600'}
              onClick={() => {
                setMonitoring(!monitoring)
                addLog('info', monitoring ? 'Мониторинг спрян' : 'Мониторинг включен (всеки 30с)')
              }}
              title={monitoring ? 'Спри мониторинга' : 'Включи мониторинга'}
            >
              {monitoring ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline" size="sm"
              className="border-zinc-700 text-zinc-300"
              onClick={() => { checkHealth(); checkPayments(); checkKeepalive() }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обнови
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20">

        {/* NEW SALE FLASH */}
        {newSaleFlash && hasSales && (
          <SaleFlash>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center animate-bounce">
                <CircleDollarSign className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-300">НОВА ПРОДАЖБА!</p>
                <p className="text-2xl font-bold text-emerald-400">+{basescan.total_usdc} USDC</p>
              </div>
            </div>
          </SaleFlash>
        )}

        {/* 24h No-Sales Warning */}
        {noSales24h && (
          <Card className="border-amber-500/40 bg-amber-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-300">Няма продажби 24 часа</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Използвай бутона &quot;Тестово плащане&quot; по-долу за да провериш системата.
                  </p>
                </div>
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-[10px] shrink-0">
                  <Timer className="w-3 h-3 mr-1" /> 24ч
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Sales Banner */}
        {hasSales && !newSaleFlash && (
          <Card className="border-emerald-500/40 bg-emerald-950/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-medium text-emerald-300">
                      {basescan.count_24h} {basescan.count_24h === 1 ? 'продажба' : 'продажби'} днес
                    </p>
                    <p className="text-xl font-bold text-emerald-400">${basescan.total_usdc} USDC</p>
                  </div>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  <Radio className="w-3 h-3 mr-1" /> LIVE
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Banner */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusDot online={health?.status === 'online'} />
                <span className="font-medium">
                  {health ? 'API Онлайн' : 'API Недостъпен'}
                </span>
                {monitoring && <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-[10px] ml-1">АВТО</Badge>}
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                {lastCheck}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revenue & Stats */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-3 text-center">
              <CircleDollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-zinc-100">${basescan?.total_usdc || '0.00'}</p>
              <p className="text-[10px] text-zinc-500">Приходи 24ч (USDC)</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-3 text-center">
              <Activity className="w-5 h-5 text-sky-400 mx-auto mb-1" />
              <p className="text-xl font-bold text-zinc-100">{basescan?.count_24h ?? '-'}</p>
              <p className="text-[10px] text-zinc-500">Транзакции 24ч</p>
            </CardContent>
          </Card>
        </div>

        {/* ===== REAL PAYMENT TEST ===== */}
        <Card className={`border-2 ${
          paymentStep === 'success' ? 'border-emerald-500/60 bg-emerald-950/20' :
          paymentStep === 'error' ? 'border-red-500/40 bg-red-950/20' :
          paymentStep !== 'idle' ? 'border-sky-500/40 bg-sky-950/20' :
          'border-amber-500/30 bg-zinc-900/60'
        }`}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Тестово плащане
              <Badge variant="outline" className="border-amber-500/40 text-amber-400 text-[10px] ml-auto">
                РЕАЛНО USDC
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* Payment flow steps indicator */}
            <div className="flex items-center gap-1 text-[10px]">
              {['Свържи', 'Плати', 'Потвърди', 'Данни'].map((label, i) => {
                const steps: PaymentStep[] = ['connecting', 'sending', 'confirming', 'fetching', 'success']
                const stepIdx = steps.indexOf(paymentStep)
                const isActive = stepIdx >= i || paymentStep === 'success'
                return (
                  <div key={i} className="flex items-center gap-1 flex-1">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                      paymentStep === 'success' ? 'bg-emerald-500/30 text-emerald-400' :
                      isActive && paymentStep !== 'idle' && paymentStep !== 'error' ? 'bg-sky-500/30 text-sky-400' :
                      'bg-zinc-800 text-zinc-600'
                    }`}>
                      {paymentStep === 'success' ? '✓' : i + 1}
                    </div>
                    <span className={`hidden sm:inline ${isActive ? 'text-zinc-300' : 'text-zinc-600'}`}>{label}</span>
                    {i < 3 && <div className={`flex-1 h-px ${isActive ? 'bg-sky-500/30' : 'bg-zinc-800'}`} />}
                  </div>
                )
              })}
            </div>

            {/* Step: Idle / Connect */}
            {paymentStep === 'idle' && (
              <div className="space-y-3">
                <div className="rounded-lg bg-zinc-950/60 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-zinc-400">Плати на:</p>
                    <button onClick={copyAddress} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Копирано!' : 'Копирай'}
                    </button>
                  </div>
                  <p className="font-mono text-xs text-emerald-300 break-all">{API_WALLET}</p>
                  <div className="flex gap-4 text-[10px] text-zinc-500">
                    <span>Мрежа: <span className="text-zinc-300">Base</span></span>
                    <span>Сума: <span className="text-zinc-300">0.25 USDC</span></span>
                  </div>
                </div>
                
                {hasWallet ? (
                  <Button
                    className="w-full bg-amber-600 hover:bg-amber-500 text-white"
                    onClick={connectWallet}
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    Свържи портфейл и плати
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400 text-center">Крипто портфейл не е открит</p>
                    <Button
                      className="w-full bg-zinc-700 hover:bg-zinc-600"
                      onClick={() => setPaymentStep('manual')}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Ръчно въвеждане на tx hash
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Step: Connecting */}
            {paymentStep === 'connecting' && (
              <div className="flex items-center justify-center py-4 gap-2 text-amber-400">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm">Свързване с портфейла...</span>
              </div>
            )}

            {/* Step: Ready to send */}
            {paymentStep === 'ready' && (
              <div className="space-y-3">
                <div className="rounded-lg bg-zinc-950/60 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">Портфейл:</span>
                    <span className="text-xs font-mono text-sky-300">{walletAddress?.slice(0,10)}...{walletAddress?.slice(-6)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-400">USDC баланс:</span>
                    <span className={`text-xs font-bold ${walletBalance && parseFloat(walletBalance) >= 0.25 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {walletBalance} USDC
                    </span>
                  </div>
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                  onClick={sendUSDCTransfer}
                  disabled={walletBalance ? parseFloat(walletBalance) < 0.25 : true}
                >
                  <Send className="w-4 h-4 mr-2" />
                  Изпрати 0.25 USDC
                </Button>
                {walletBalance && parseFloat(walletBalance) < 0.25 && (
                  <p className="text-[10px] text-amber-400 text-center">Недостатъчен USDC баланс. Трябват 0.25 USDC на Base.</p>
                )}
              </div>
            )}

            {/* Step: Sending / Confirming / Fetching */}
            {(paymentStep === 'sending' || paymentStep === 'confirming' || paymentStep === 'fetching') && (
              <div className="space-y-3 py-2">
                <div className="flex items-center justify-center gap-2 text-sky-400">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">{
                    paymentStep === 'sending' ? 'Изпращане на USDC...' :
                    paymentStep === 'confirming' ? 'Чакане на потвърждение...' :
                    'Получаване на данните...'
                  }</span>
                </div>
                {txHash && (
                  <a
                    href={`https://basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-center text-[10px] text-sky-400 hover:underline"
                  >
                    Виж в Basescan ↗
                  </a>
                )}
              </div>
            )}

            {/* Step: Manual tx hash input */}
            {paymentStep === 'manual' && (
              <div className="space-y-3">
                <div className="rounded-lg bg-zinc-950/60 p-3">
                  <p className="text-xs text-zinc-400 mb-2">1. Изпрати 0.25 USDC на Base към:</p>
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-xs text-emerald-300 break-all">{API_WALLET}</p>
                    <button onClick={copyAddress} className="text-emerald-400 shrink-0 ml-2">
                      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-2">2. Въведи tx hash:</p>
                  <input
                    type="text"
                    value={manualTxHash}
                    onChange={(e) => setManualTxHash(e.target.value)}
                    placeholder="0x..."
                    className="w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500"
                  />
                </div>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-500"
                  onClick={fetchWithManualTx}
                  disabled={!manualTxHash.trim().startsWith('0x')}
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Провери плащане и вземи данните
                </Button>
              </div>
            )}

            {/* Step: Error */}
            {paymentStep === 'error' && (
              <div className="space-y-3">
                <div className="rounded-lg bg-red-950/30 border border-red-500/30 p-3">
                  <p className="text-xs text-red-400">{paymentError}</p>
                </div>
                <Button
                  className="w-full bg-zinc-700 hover:bg-zinc-600"
                  onClick={() => { setPaymentStep('idle'); setPaymentError(''); setTxHash(''); setTravelData(null) }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Опитай отново
                </Button>
              </div>
            )}

            {/* Step: Success */}
            {paymentStep === 'success' && travelData && (
              <div className="space-y-3">
                <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-5 h-5 text-emerald-400" />
                    <span className="text-sm font-bold text-emerald-300">Плащане потвърдено!</span>
                  </div>
                  {txHash && (
                    <a
                      href={`https://basescan.org/tx/${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-400 hover:underline mb-3 block"
                    >{txHash.slice(0, 22)}...{txHash.slice(-8)} — Basescan ↗</a>
                  )}
                  <div className="border-t border-emerald-500/20 pt-3 mt-3">
                    <p className="text-xs font-medium text-zinc-300 mb-2">Получени данни:</p>
                    <p className="text-sm font-bold text-emerald-400">{travelData.product}</p>
                    <p className="text-[10px] text-zinc-500 mt-1">{travelData.seasonality_context}</p>
                    <div className="mt-3 space-y-1">
                      {travelData.top_locations?.map((loc: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <span className="text-zinc-300">{loc.city}, {loc.country}</span>
                          <span className="text-emerald-400">${loc.avg_budget_usd}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <Button
                  className="w-full bg-zinc-700 hover:bg-zinc-600"
                  onClick={() => { setPaymentStep('idle'); setTxHash(''); setTravelData(null); setWalletAddress(null) }}
                >
                  <ArrowRight className="w-4 h-4 mr-2" />
                  Ново плащане
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        {basescan && basescan.transactions.length > 0 && (
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="w-4 h-4 text-emerald-400" />
                Последни плащания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {basescan.transactions.slice(0, 5).map((tx) => (
                <div key={tx.hash} className="flex items-center justify-between bg-zinc-950/60 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-emerald-300">+${tx.value} USDC</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{tx.from.slice(0, 10)}...{tx.from.slice(-4)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[10px] text-zinc-500">Block #{tx.block}</p>
                    <a
                      href={`https://basescan.org/tx/${tx.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-sky-400 flex items-center gap-0.5 justify-end"
                    >
                      Basescan <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* API Details */}
        {health && (
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Server className="w-4 h-4 text-emerald-400" />
                Състояние на сървъра
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <InfoItem label="Мрежа" value={health.network.toUpperCase()} />
                <InfoItem label="Web3" value={health.web3_connected ? 'Свързан' : 'Изключен'} />
              </div>
              <InfoItem label="Портфейл" value={`${health.wallet.slice(0, 10)}...${health.wallet.slice(-6)}`} />
              <InfoItem label="RPC" value={health.rpc} />
              <div className="pt-2 flex gap-4">
                <a
                  href={`https://basescan.org/address/${health.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 text-sm underline underline-offset-2"
                >Портфейл на Basescan</a>
                <a
                  href="https://kristo-travel-api.onrender.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 text-sm underline underline-offset-2"
                >API документация</a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Info */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-3 text-center">
              <CircleDollarSign className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-zinc-100">$0.25</p>
              <p className="text-[10px] text-zinc-500">Цена/заявка</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-3 text-center">
              <Globe className="w-5 h-5 text-sky-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-zinc-100">Base</p>
              <p className="text-[10px] text-zinc-500">Мрежа</p>
            </CardContent>
          </Card>
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardContent className="p-3 text-center">
              <Wallet className="w-5 h-5 text-amber-400 mx-auto mb-1" />
              <p className="text-lg font-bold text-zinc-100">USDC</p>
              <p className="text-[10px] text-zinc-500">Актив</p>
            </CardContent>
          </Card>
        </div>

        {/* Activity Log */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-zinc-400" />
              Лог на активността
              {monitoring && <Badge variant="outline" className="border-zinc-700 text-zinc-500 text-[10px] ml-2">AUTO 30s</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-4">Зареждане...</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 text-xs p-1.5 rounded ${
                    log.type === 'payment' ? 'bg-emerald-950/40 border border-emerald-500/20' :
                    log.type === 'warning' ? 'bg-amber-950/20' : ''
                  }`}>
                    <span className="text-zinc-600 font-mono shrink-0 pt-0.5">{log.time}</span>
                    <span className={`shrink-0 ${
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'error' ? 'text-red-400' :
                      log.type === 'payment' ? 'text-emerald-300' :
                      log.type === 'warning' ? 'text-amber-400' :
                      'text-sky-400'
                    }`}>
                      {log.type === 'success' ? 'OK' : log.type === 'error' ? '!!' : log.type === 'payment' ? '$$' : log.type === 'warning' ? '?!' : '>>'}
                    </span>
                    <span className={log.type === 'payment' ? 'text-emerald-200 font-medium' : 'text-zinc-400'}>{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-mono text-zinc-200 break-all">{value}</p>
    </div>
  )
}