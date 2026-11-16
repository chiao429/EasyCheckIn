import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';

const COOKIE = 'easycheckin_admin_session';
const SESSION_MS = 15 * 60 * 1000;

function sign(value: string) {
  return createHmac('sha256', process.env.ADMIN_PASSWORD || '').update(value).digest('base64url');
}

export function setAdminSession(response: NextResponse, eventId: string) {
  const payload = Buffer.from(JSON.stringify({ eventId, expiresAt: Date.now() + SESSION_MS })).toString('base64url');
  response.cookies.set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MS / 1000,
  });
}

export function hasAdminSession(request: NextRequest, eventId: string) {
  const token = request.cookies.get(COOKIE)?.value;
  const [payload, signature, ...rest] = token?.split('.') || [];
  if (!payload || !signature || rest.length) return false;
  const expected = sign(payload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { eventId?: string; expiresAt?: number };
    return session.eventId === eventId && typeof session.expiresAt === 'number' && session.expiresAt > Date.now();
  } catch {
    return false;
  }
}
