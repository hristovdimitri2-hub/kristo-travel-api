import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const typeFilter = searchParams.get('type')
    const statusFilter = searchParams.get('status')
    const where: Record<string, unknown> = {}
    if (typeFilter) where.type = typeFilter
    if (statusFilter) where.status = statusFilter
    const discoveries = await db.discovery.findMany({ where, orderBy: { priority: 'desc' }, include: { analyses: true } })
    return NextResponse.json(discoveries)
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при извличане на откритията' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, description, type, status, priority, marketScore, riskScore, roiScore, feasibility, crossDomains, reasoning } = body
    if (!title || !description || !type) return NextResponse.json({ error: 'Задължителни полета: title, description, type' }, { status: 400 })
    const crossDomainsStr = typeof crossDomains === 'string' ? crossDomains : JSON.stringify(crossDomains || [])
    const discovery = await db.discovery.create({
      data: { title, description, type, status: status || 'new', priority: priority ?? 0,
        marketScore: marketScore ?? null, riskScore: riskScore ?? null, roiScore: roiScore ?? null,
        feasibility: feasibility ?? null, crossDomains: crossDomainsStr, reasoning: reasoning ?? null, knowledgeIds: JSON.stringify([]) },
    })
    return NextResponse.json(discovery, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при създаване на откритие' }, { status: 500 })
  }
}
