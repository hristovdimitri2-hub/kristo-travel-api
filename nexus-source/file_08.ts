import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { analysisId, feedback, quality } = body
    if (!analysisId) return NextResponse.json({ error: 'Липсва идентификатор на анализ (analysisId).' }, { status: 400 })
    const analysis = await db.analysis.findUnique({ where: { id: analysisId } })
    if (!analysis) return NextResponse.json({ error: 'Анализът не е намерен.' }, { status: 404 })
    const updateData: Record<string, unknown> = {}
    if (typeof feedback === 'string' && feedback.trim() !== '') updateData.feedback = feedback.trim()
    if (typeof quality === 'number' && quality >= 0 && quality <= 1) updateData.quality = quality
    if (Object.keys(updateData).length === 0) return NextResponse.json({ error: 'Няма валидни данни за актуализация.' }, { status: 400 })
    const updated = await db.analysis.update({ where: { id: analysisId }, data: updateData })
    return NextResponse.json({ success: true, analysis: { id: updated.id, quality: updated.quality, feedback: updated.feedback }, message: 'Обратната връзка е записана успешно.' })
  } catch (error) {
    return NextResponse.json({ error: 'Възникна неочаквана грешка при запис на обратна връзка' }, { status: 500 })
  }
}
