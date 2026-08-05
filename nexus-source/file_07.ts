import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import sdk from 'z-ai-web-dev-sdk'
import { emitNexusEvent } from '@/lib/ws-emit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { type, discoveryId, context } = body
    const validTypes = ['innovation', 'business', 'strategic']
    if (!type || !validTypes.includes(type)) return NextResponse.json({ error: 'Невалиден тип анализ. Позволени: innovation, business, strategic' }, { status: 400 })
    const llm = sdk.default()
    const typeLabels: Record<string, string> = { innovation: 'иновативен', business: 'бизнес', strategic: 'стратегически' }
    let discoveryContext = ''
    if (discoveryId) {
      const discovery = await db.discovery.findUnique({ where: { id: discoveryId }, include: { knowledge: { include: { source: { select: { name: true } } } } } })
      if (discovery) {
        discoveryContext = `\n## Изследвано откритие:\n- Заглавие: ${discovery.title}\n- Описание: ${discovery.description}\n- Тип: ${discovery.type}\n- Статус: ${discovery.status}\n- Приоритет: ${discovery.priority}\n- Пазарен резултат: ${discovery.marketScore ?? 'неоценен'}\n- Резултат по риск: ${discovery.riskScore ?? 'неоценен'}\n- Резултат по възвръщаемост: ${discovery.roiScore ?? 'неоценен'}\n- Осъществимост: ${discovery.feasibility ?? 'неоценена'}\n- Кръстосани домейни: ${discovery.crossDomains}\n- Обосновка: ${discovery.reasoning ?? 'няма'}\n`
        if (discovery.knowledge.length > 0) { discoveryContext += '\n### Свързани знания:\n'; for (const k of discovery.knowledge) discoveryContext += `- [${k.source.name}] ${k.title}: ${k.summary}\n` }
      }
    }
    const knowledgeEntries = await db.knowledgeEntry.findMany({ take: 10, orderBy: { relevance: 'desc' }, include: { source: { select: { name: true, type: true } } } })
    let knowledgeContext = ''
    if (knowledgeEntries.length > 0) { knowledgeContext = '\n## Събрани знания:\n'; for (const entry of knowledgeEntries) knowledgeContext += `- [${entry.source.name}] ${entry.title} (домейн: ${entry.domain}): ${entry.summary}\n` }
    const additionalContext = context ? `\n## Допълнителен контекст от потребителя:\n${context}\n` : ''
    const systemPrompt = `Ти си експертен AI анализатор в платформата NEXUS Discovery Engine. Твоята задача е да провеждаш задълбочен ${typeLabels[type]} анализ на научни открития. Отговаряй винаги на български език.`
    const userPrompt = `Проведи ${typeLabels[type]} анализ:\n${discoveryContext}\n${knowledgeContext}\n${additionalContext}\nФормат: 1. Обобщение 2. Анализ 3. Слаби места 4. Препоръки 5. Заключение`
    const messages = [{ role: 'system' as const, content: systemPrompt }, { role: 'user' as const, content: userPrompt }]
    const result = await llm.chat({ messages, temperature: 0.7 })
    const aiResponse = result.content
    const analysis = await db.analysis.create({ data: { type, input: JSON.stringify({ type, discoveryId: discoveryId || null, contextUsed: { knowledgeCount: knowledgeEntries.length, discoveryIncluded: !!discoveryId, hasUserContext: !!context } }), output: aiResponse, quality: 0.8, discoveryId: discoveryId || null } })
    if (discoveryId) await db.discovery.update({ where: { id: discoveryId }, data: { status: 'analyzing' } })
    emitNexusEvent('analysis_complete', { type, discoveryId: discoveryId || null })
    return NextResponse.json({ analysisId: analysis.id, text: aiResponse, type, quality: analysis.quality })
  } catch (error) {
    return NextResponse.json({ error: 'Възникна грешка при извършване на AI анализа' }, { status: 500 })
  }
}
