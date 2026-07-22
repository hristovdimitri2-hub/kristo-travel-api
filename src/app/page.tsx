'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
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
  Server
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
  const [logs, setLogs] = useState<Array<{ time: string; type: 'success' | 'error' | 'info'; message: string }>>([])

  const addLog = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const now = new Date().toLocaleTimeString('bg-BG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setLogs(prev => [{ time: now, type, message }, ...prev].slice(0, 20))
  }, [])

  const checkHealth = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/kristo?endpoint=/health')
      const json = await res.json()
      if (json.status === 200) {
        setHealth(json.data)
        addLog('success', 'API е онлайн и работи')
      } else {
        setHealth(null)
        addLog('error', 'API не е наличен — Render може да спи')
      }
      setLastCheck(new Date().toLocaleTimeString('bg-BG'))
    } catch {
      addLog('error', 'Грешка при свързване')
    }
    setLoading(false)
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
        addLog('success', 'Плащането е потвърдено! Данните са получени.')
      } else {
        addLog('error', 'Неочакван отговор от API-то')
      }
    } catch {
      addLog('error', 'Грешка при тестване')
    }
    setTesting(false)
  }, [addLog])

  useEffect(() => {
    checkHealth()
  }, [checkHealth])

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
          <Button
            variant="outline" size="sm"
            className="border-zinc-700 text-zinc-300"
            onClick={checkHealth}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Обнови
          </Button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-6 pb-20">

        {/* Status Banner */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusDot online={health?.status === 'online'} />
                <span className="font-medium">
                  {health ? 'API Онлайн' : 'API Недостъпен'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="w-3 h-3" />
                {lastCheck}
              </div>
            </div>
          </CardContent>
        </Card>

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
              <div className="space-y-1">
                <InfoItem label="Портфейл" value={`${health.wallet.slice(0, 8)}...${health.wallet.slice(-6)}`} />
              </div>
              <div className="space-y-1">
                <InfoItem label="RPC" value={health.rpc} />
              </div>
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

        {/* How It Works */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-400" />
              Как работи x402
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Процесът на плащане стъпка по стъпка
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            <FlowStep
              step={1}
              title="AI Агент прави заявка"
              description="GET /travel/weekend-getaway"
              icon={<Send className="w-4 h-4" />}
            />
            <FlowArrow />
            <FlowStep
              step={2}
              title="API връща 402 Payment Required"
              description="Указва: 0.25 USDC на Base към вашия портфейл"
              icon={<XCircle className="w-4 h-4" />}
              highlight="error"
            />
            <FlowArrow />
            <FlowStep
              step={3}
              title="Агентът прати USDC на блокчейна"
              description="Транзакцията се записва в Base мрежата"
              icon={<CircleDollarSign className="w-4 h-4" />}
            />
            <FlowArrow />
            <FlowStep
              step={4}
              title="Агентът повтаря заявката с TX hash"
              description="X-PAYMENT хедър с доказателство за плащане"
              icon={<ArrowRight className="w-4 h-4" />}
            />
            <FlowArrow />
            <FlowStep
              step={5}
              title="API валидира на блокчейна"
              description="Проверява tx, amount, recipient → връща данните"
              icon={<CheckCircle2 className="w-4 h-4" />}
              highlight="success"
            />
          </CardContent>
        </Card>

        {/* Live Test */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-sky-400" />
              Тест на живо
            </CardTitle>
            <CardDescription className="text-zinc-500 text-xs">
              Симулирайте заявка от AI агент и вижте отговора
            </CardDescription>
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
                  <p>🔑 <span className="text-zinc-300">Сума:</span> {x402response.accepts.amount} {x402response.accepts.asset}</p>
                  <p>🔗 <span className="text-zinc-300">Мрежа:</span> {x402response.accepts.network}</p>
                  <p>💰 <span className="text-zinc-300">Към:</span> <span className="font-mono text-emerald-400">{x402response.accepts.payTo.slice(0, 10)}...{x402response.accepts.payTo.slice(-6)}</span></p>
                  <p>📋 <span className="text-zinc-300">Описание:</span> {x402response.accepts.description}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            icon={<CircleDollarSign className="w-5 h-5 text-emerald-400" />}
            label="Цена на заявка"
            value="$0.25"
          />
          <StatCard
            icon={<Globe className="w-5 h-5 text-sky-400" />}
            label="Мрежа"
            value="Base"
          />
          <StatCard
            icon={<Wallet className="w-5 h-5 text-amber-400" />}
            label="Актив"
            value="USDC"
          />
        </div>

        {/* API URL */}
        <Card className="border-zinc-800 bg-zinc-900/60">
          <CardContent className="p-4">
            <p className="text-xs text-zinc-500 mb-2">Вашият публичен API адрес:</p>
            <div className="flex items-center gap-2 bg-zinc-950 rounded-lg p-3">
              <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
              <code className="text-sm text-emerald-300 break-all select-all">
                https://kristo-travel-api.onrender.com
              </code>
            </div>
          </CardContent>
        </Card>

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
              <div className="max-h-64 overflow-y-auto space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="text-zinc-600 font-mono shrink-0 pt-0.5">{log.time}</span>
                    <span className={`shrink-0 ${log.type === 'success' ? 'text-emerald-400' : log.type === 'error' ? 'text-red-400' : 'text-sky-400'}`}>
                      {log.type === 'success' ? '✓' : log.type === 'error' ? '✗' : 'ℹ'}
                    </span>
                    <span className="text-zinc-400">{log.message}</span>
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

function FlowStep({ step, title, description, icon, highlight }: {
  step: number; title: string; description: string; icon: React.ReactNode; highlight?: 'success' | 'error'
}) {
  const colorClass = highlight === 'success'
    ? 'border-emerald-500/30 bg-emerald-950/20'
    : highlight === 'error'
    ? 'border-amber-500/30 bg-amber-950/20'
    : 'border-zinc-800 bg-zinc-900/40'

  const numColor = highlight === 'success'
    ? 'bg-emerald-500 text-white'
    : highlight === 'error'
    ? 'bg-amber-500 text-white'
    : 'bg-zinc-800 text-zinc-400'

  return (
    <div className={`rounded-lg border p-3 flex items-start gap-3 ${colorClass}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${numColor}`}>
        {step}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium flex items-center gap-2">
          <span className={highlight === 'success' ? 'text-emerald-300' : highlight === 'error' ? 'text-amber-300' : ''}>
            {title}
          </span>
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">{description}</p>
      </div>
      <div className="shrink-0 text-zinc-500 mt-0.5">{icon}</div>
    </div>
  )
}

function FlowArrow() {
  return (
    <div className="flex justify-center py-1">
      <ArrowRight className="w-4 h-4 text-zinc-700" />
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="border-zinc-800 bg-zinc-900/60">
      <CardContent className="p-3 text-center">
        <div className="flex justify-center mb-2">{icon}</div>
        <p className="text-lg font-bold text-zinc-100">{value}</p>
        <p className="text-[10px] text-zinc-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}
