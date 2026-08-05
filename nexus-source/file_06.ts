import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { emitNexusEvent } from '@/lib/ws-emit'

export async function GET() {
  try {
    const agents = await db.agent.findMany({ orderBy: { createdAt: 'desc' }, include: { analyses: { select: { id: true }, take: 1 } } })
    return NextResponse.json(agents)
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при извличане на агентите' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, domain, role, systemPrompt, model } = body
    if (!name || !domain || !role || !systemPrompt) return NextResponse.json({ error: 'Задължителни полета: name, domain, role, systemPrompt' }, { status: 400 })
    const agent = await db.agent.create({ data: { name, domain, role, systemPrompt, model: model || 'default', isActive: true } })
    return NextResponse.json(agent, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при създаване на агент' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, isActive } = body
    if (!id || typeof isActive !== 'boolean') return NextResponse.json({ error: 'Задължителни полета: id (string) и isActive (boolean)' }, { status: 400 })
    const existingAgent = await db.agent.findUnique({ where: { id } })
    if (!existingAgent) return NextResponse.json({ error: 'Агентът не е намерен' }, { status: 404 })
    const updatedAgent = await db.agent.update({ where: { id }, data: { isActive } })
    emitNexusEvent('agent_toggled', { agentId: id, agentName: existingAgent.name, isActive })
    return NextResponse.json(updatedAgent)
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при обновяване на агент' }, { status: 500 })
  }
}
