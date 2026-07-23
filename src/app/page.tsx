'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Activity,
  CircleDollarSign,
  Globe,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  ArrowRight,
  Zap,
  Shield,
  Send,
  Server,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  Bell,
  BellOff
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
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span className={`inline-block w-2.5 h-2.5 rounded-full ${online ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
  )
}

export default function Home() {
  const [health, setHealth] = useState<HealthData | null>(null)
  const [x402response, setX402response] = useState<X402Response | null>(null)
  const [loading, setLoading] = useState(true)
  const [testing, setTesting] = useState(false)
  const [lastCheck, setLastCheck] = useState<string>('-')
  const [logs, setLogs] = useState<Array<{ time: string; type: 'success' | 'error' | 'info' | 'payment'; message: string }>>([])
  const [basescan, setBasescan] = useState<BasescanData | null>(null)
  const [monitoring, setMonitoring] = useState(true)
  const prevTxCount = useRef(0)

  const addLog = useCallback((type: 'success' | 'error' | 'info' | 'payment', message: string) => {
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
        addLog('error', 'API не е наличен — Render може да спи')
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
      setBasescan(data)

      // Detect new payments
      if (data.count_24h > prevTxCount.current && prevTxCount.current >= 0) {
        const newCount = data.count_24h - prevTxCount.current
        addLog('payment', `НОВА ПРОДАЖБА! +${data.total_usdc} USDC (${newCount} транзакции за 24ч)`)
      }
      prevTxCount.current = data.count_24h

      // 24h no-sale warning
      if (data.count_24h === 0 && !data.error) {
        addLog('info', 'Няма продажби през последните 24 часа')
      }
    } catch {
      // Basescan free tier rate limited - ignore
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

  // Initial load
  useEffect(() => {
    checkHealth()
    checkPayments()
  }, [checkHealth, checkPayments])

  // Auto-monitoring every 60 seconds
  useEffect(() => {
    if (!monitoring) return
    const interval = setInterval(() => {
      checkPayments()
    }, 60000)
    return () => clearInterval(interval)
  }, [monitoring, checkPayments])

  const noSales24h = basescan !== null && basescan.count_24h === 0 && !basescan.error

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
              <p className="text-xs text-zinc-500">x402 Pay-per-Call Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon"
              className={monitoring ? 'text-emerald-400' : 'text-zinc-600'}
              onClick={() => {
                setMonitoring(!monitoring)
                addLog('info', monitoring ? 'Авто-мониторинг спрян' : 'Авто-мониторинг включен (всеки 60с)')
              }}
              title={monitoring ? 'Спри мониторинга' : 'Включи мониторинга'}
            >
              {monitoring ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline" size="sm"
              className="border-zinc-700 text-zinc-300"
              onClick={() => { checkHealth(); checkPayments() }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Обнови
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20">

        {/* 24h No-Sales Alert */}
        {noSales24h && (
          <Card className="border-amber-500/40 bg-amber-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Няма продажби през последните 24 часа</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    API-то работи, но нито един AI агент не е платил. За да генерирате трафик,
                    трябва да регистрирате API-то в x402 каталог или да го свържете с AI платформа.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* New Sale Alert */}
        {basescan && basescan.count_24h > 0 && (
          <Card className="border-emerald-500/40 bg-emerald-950/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-emerald-300">
                    {basescan.count_24h} {basescan.count_24h === 1 ? 'продажба' : 'продажби'} днес
                  </p>
                  <p className="text-2xl font-bold text-emerald-400 mt-1">${basescan.total_usdc} USDC</p>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                  LIVE
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

        {/* Recent Transactions */}
        {basescan && basescan.transactions.length > 0 && (
          <Card className="border-zinc-800 bg-zinc-900/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Последни плащания
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {basescan.transactions.slice(0, 5).map((tx) => (
                <div key={tx.hash} className="flex items-center justify-between bg-zinc-950/60 rounded-lg p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-emerald-300">+${tx.value} USDC</p>
                    <p className="text-[10px] text-zinc-500 font-mono">{tx.from.slice(0, 8)}...{tx.from.slice(-4)}</p>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[10px] text-zinc-500">{tx.timestamp}</p>
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
              <InfoItem label="Портфейл" value={`${health.wallet.slice(0, 8)}...${health.wallet.slice(-6)}`} />
              <InfoItem label="RPC" value={health.rpc} />
              <div className="pt-2">
                <a
                  href={`https://basescan.org/address/${health.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 text-sm underline underline-offset-2"
                >
                  Виж портфейла на Basescan →
                </a>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Live Test */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Тест на живо
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-500"
              onClick={testPayment}
              disabled={testing}
            >
              {testing ? (
                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Тестване...</>
              ) : (
                <><Zap className="w-4 h-4 mr-2" /> Тествай x402 Endpoint</>
              )}
            </Button>

            {x402response && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-amber-500 text-amber-400 text-xs">
                    HTTP 402
                  </Badge>
                  <span className="text-sm font-medium text-amber-300">Payment Required</span>
                </div>
                <div className="text-xs space-y-1.5 text-zinc-400">
                  <p>Сума: <span className="text-zinc-300">{x402response.accepts.amount} {x402response.accepts.asset}</span></p>
                  <p>Мрежа: <span className="text-zinc-300">{x402response.accepts.network}</span></p>
                  <p>Към: <span className="font-mono text-emerald-400">{x402response.accepts.payTo.slice(0, 10)}...{x402response.accepts.payTo.slice(-6)}</span></p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

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
            </CardTitle>
          </CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-zinc-600 text-center py-4">Няма активност</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className={`flex items-start gap-2 text-xs p-1.5 rounded ${log.type === 'payment' ? 'bg-emerald-950/30' : ''}`}>
                    <span className="text-zinc-600 font-mono shrink-0 pt-0.5">{log.time}</span>
                    <span className={`shrink-0 ${log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : log.type === 'payment' ? 'text-emerald-300' : 'text-sky-400'}`}>
                      {log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : log.type === 'payment' ? '💰' : 'ℹ'}
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
      <p className="text-sm font-mono text-zinc-200">{value}</p>
    </div>
  )
}