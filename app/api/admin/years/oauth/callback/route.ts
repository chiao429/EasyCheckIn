import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeDriveCode, saveDriveRefreshToken } from '@/lib/year-drive-oauth';
import { makeYearAdminToken, YEAR_ADMIN_COOKIE } from '@/lib/year-registry';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') || '';
  const expected = request.cookies.get('easycheckin_year_oauth_state')?.value || '';
  const response = NextResponse.redirect(new URL('/years', request.url));
  response.cookies.set('easycheckin_year_oauth_state', '', { path: '/api/admin/years/oauth/callback', maxAge: 0 });
  if (!state || !expected || Buffer.byteLength(state) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    response.headers.set('Location', new URL('/years?drive=state-error', request.url).toString());
    return response;
  }
  const code = url.searchParams.get('code');
  if (!code || url.searchParams.has('error')) {
    response.headers.set('Location', new URL('/years?drive=cancelled', request.url).toString());
    return response;
  }
  try {
    await saveDriveRefreshToken(await exchangeDriveCode(code));
    response.headers.set('Location', new URL('/years?drive=connected', request.url).toString());
    response.cookies.set(YEAR_ADMIN_COOKIE, makeYearAdminToken(), {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60,
    });
  } catch {
    response.headers.set('Location', new URL('/years?drive=failed', request.url).toString());
  }
  return response;
}
