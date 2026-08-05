import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const domainFilter = searchParams.get('domain')
    const where: Record<string, unknown> = {}
    if (domainFilter) where.domain = domainFilter
    const knowledgeEntries = await db.knowledgeEntry.findMany({
      where, orderBy: { createdAt: 'desc' },
      include: { source: { select: { id: true, name: true, type: true } } },
    })
    return NextResponse.json(knowledgeEntries)
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при извличане на знанията' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, summary, domain, tags, sourceId } = body
    if (!title || !summary || !domain || !sourceId) return NextResponse.json({ error: 'Задължителни полета: title, summary, domain, sourceId' }, { status: 400 })
    const sourceExists = await db.knowledgeSource.findUnique({ where: { id: sourceId } })
    if (!sourceExists) return NextResponse.json({ error: 'Указаният източник не съществува' }, { status: 404 })
    const tagsStr = typeof tags === 'string' ? tags : JSON.stringify(tags || [])
    const entry = await db.knowledgeEntry.create({ data: { title, summary, domain, tags: tagsStr, sourceId, processedAt: new Date() } })
    return NextResponse.json(entry, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при създаване на знание' }, { status: 500 })
  }
}
