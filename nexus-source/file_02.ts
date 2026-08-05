import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { db } from '@/lib/db'

const DEMO_USER = {
  email: 'nexus@demo.bg',
  password: 'nexus2025',
  name: 'NEXUS Оператор',
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return `${salt}:${derivedKey.toString('hex')}`
}

function verifyPassword(password: string, hash: string): boolean {
  const [salt, key] = hash.split(':')
  const derivedKey = crypto.scryptSync(password, salt, 64)
  return derivedKey.toString('hex') === key
}

function createSessionCookie(user: { email: string; name: string; role?: string }) {
  const payload = JSON.stringify({
    email: user.email,
    name: user.name,
    role: user.role || 'operator',
    exp: Date.now() + 86400000,
  })
  const token = Buffer.from(payload).toString('base64')
  return token
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('nexus_session')?.value
    if (!session) return NextResponse.json({ user: null })
    try {
      const data = JSON.parse(Buffer.from(session, 'base64').toString())
      if (data.exp && data.exp < Date.now()) return NextResponse.json({ user: null })
      return NextResponse.json({ user: { email: data.email, name: data.name, role: data.role || 'operator' } })
    } catch {
      return NextResponse.json({ user: null })
    }
  } catch {
    return NextResponse.json({ user: null })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      const token = createSessionCookie({ email: DEMO_USER.email, name: DEMO_USER.name, role: 'admin' })
      const response = NextResponse.json({ user: { email: DEMO_USER.email, name: DEMO_USER.name, role: 'admin' } })
      response.cookies.set('nexus_session', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400, path: '/' })
      return response
    }
    try {
      const user = await db.user.findUnique({ where: { email } })
      if (!user || !user.isActive) return NextResponse.json({ error: 'Невалиден имейл или парола' }, { status: 401 })
      if (!verifyPassword(password, user.password)) return NextResponse.json({ error: 'Невалиден имейл или парола' }, { status: 401 })
      const token = createSessionCookie({ email: user.email, name: user.name, role: user.role })
      const response = NextResponse.json({ user: { email: user.email, name: user.name, role: user.role } })
      response.cookies.set('nexus_session', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400, path: '/' })
      return response
    } catch {
      return NextResponse.json({ error: 'Невалиден имейл или парола' }, { status: 401 })
    }
  } catch {
    return NextResponse.json({ error: 'Грешка при вход' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { name, email, password } = await req.json()
    if (!name || !email || !password) return NextResponse.json({ error: 'Задължителни полета: name, email, password' }, { status: 400 })
    if (password.length < 6) return NextResponse.json({ error: 'Паролата трябва да е поне 6 символа' }, { status: 400 })
    try {
      const existing = await db.user.findUnique({ where: { email } })
      if (existing) return NextResponse.json({ error: 'Потребител с този имейл вече съществува' }, { status: 409 })
      const hashedPassword = hashPassword(password)
      const user = await db.user.create({ data: { email, name, password: hashedPassword, role: 'operator', isActive: true } })
      const token = createSessionCookie({ email: user.email, name: user.name, role: user.role })
      const response = NextResponse.json({ user: { email: user.email, name: user.name, role: user.role }, message: 'Регистрацията е успешна' })
      response.cookies.set('nexus_session', token, { httpOnly: true, secure: false, sameSite: 'lax', maxAge: 86400, path: '/' })
      return response
    } catch {
      return NextResponse.json({ error: 'Грешка при регистрация. Опитайте отново.' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ error: 'Грешка при регистрация' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true })
  response.cookies.set('nexus_session', '', { maxAge: 0, path: '/' })
  return response
}
