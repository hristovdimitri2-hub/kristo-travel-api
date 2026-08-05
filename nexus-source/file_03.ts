import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest) {
  try {
    const [totalDiscoveries, totalKnowledge, totalAgents, totalAnalyses,
      recentDiscoveries, knowledgeByDomain, discoveriesByType, engineConfig, avgScores
    ] = await Promise.all([
      db.discovery.count(),
      db.knowledgeEntry.count(),
      db.agent.count(),
      db.analysis.count(),
      db.discovery.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      db.knowledgeEntry.groupBy({ by: ['domain'], _count: { domain: true } }),
      db.discovery.groupBy({ by: ['type'], _count: { type: true } }),
      db.systemConfig.findMany({ where: { key: { startsWith: 'engine_' } } }),
      db.discovery.aggregate({ _avg: { marketScore: true, riskScore: true, roiScore: true, feasibility: true } }),
    ])
    const domainDistribution: Record<string, number> = {}
    for (const item of knowledgeByDomain) domainDistribution[item.domain] = item._count.domain
    const discoveryTypeBreakdown: Record<string, number> = {}
    for (const item of discoveriesByType) discoveryTypeBreakdown[item.type] = item._count.type
    const engineStatus: Record<string, string> = {}
    for (const cfg of engineConfig) engineStatus[cfg.key] = cfg.value
    const roundedAvgScores = {
      marketScore: avgScores._avg.marketScore != null ? Math.round(avgScores._avg.marketScore * 100) / 100 : 0,
      riskScore: avgScores._avg.riskScore != null ? Math.round(avgScores._avg.riskScore * 100) / 100 : 0,
      roiScore: avgScores._avg.roiScore != null ? Math.round(avgScores._avg.roiScore * 100) / 100 : 0,
      feasibility: avgScores._avg.feasibility != null ? Math.round(avgScores._avg.feasibility * 100) / 100 : 0,
    }
    return NextResponse.json({ totalDiscoveries, totalKnowledge, totalAgents, totalAnalyses, recentDiscoveries, domainDistribution, discoveryTypeBreakdown, engineStatus, avgScores: roundedAvgScores })
  } catch (error) {
    console.error('Грешка при зареждане на таблото:', error)
    return NextResponse.json({ error: 'Възникна грешка при зареждане на таблото за управление' }, { status: 500 })
  }
}
