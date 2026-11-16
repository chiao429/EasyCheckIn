import { randomBytes, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createDriveConsentUrl } from '@/lib/year-drive-oauth';
import { hasYearAdminSession } from '@/lib/year-registry';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await hasYearAdminSession())) return NextResponse.json({ success: false }, { status: 401 });
  try {
    const state = randomBytes(32).toString('base64url');
    const response = NextResponse.redirect(createDriveConsentUrl(state));
    response.cookies.set('easycheckin_year_oauth_state', state, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/api/admin/years/oauth/callback', maxAge: 600,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : '無法開始 Google 授權' }, { status: 503 });
  }
}
