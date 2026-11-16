import { NextRequest, NextResponse } from 'next/server';
import { getAdminPasswordFromConfigSheet, logManagerAction } from '@/lib/google-sheets';
import { registryConfigured, resolveYearEvent } from '@/lib/year-registry';
import { setAdminSession } from '@/lib/admin-session';

export async function POST(req: NextRequest) {
  try {
    const { password, eventId, configId, sheetId } = (await req.json()) as {
      password?: string;
      eventId?: string;
      configId?: string;
      sheetId?: string;
    };

    const annual = registryConfigured();
    const match = annual && eventId && (configId || sheetId)
      ? await resolveYearEvent(eventId, configId, sheetId || undefined)
      : null;
    if (annual && !match) return NextResponse.json({ success: false, message: '找不到對應活動' }, { status: 404 });
    const logSheetId = annual ? match?.event.logSheetId || null : undefined;

    if (typeof password !== 'string' || !password) {
      // 密碼格式不正確視為系統警告
      if (eventId) {
        try {
          await logManagerAction({
            logSheetId,
            eventId,
            action: 'system_warning',
            identifier: '/api/admin/login',
            result: 'FAILED',
            message: 'Admin login failed: 密碼格式不正確',
            operator: 'System',
          });
        } catch (logError) {
          console.error('Admin login warning logging error (400):', logError);
        }
      }

      return NextResponse.json(
        { success: false, message: '密碼格式不正確' },
        { status: 400 }
      );
    }

    const adminPassword = process.env.ADMIN_PASSWORD || (!annual ? await getAdminPasswordFromConfigSheet() : null);

    if (!adminPassword) {
      return NextResponse.json(
        { success: false, message: '尚未設定活動後台密碼，請在伺服器 .env 設定 ADMIN_PASSWORD' },
        { status: 500 }
      );
    }

    if (password === adminPassword) {
      // 登入成功也記錄 log（若有 eventId）
      if (eventId) {
        try {
          await logManagerAction({
            logSheetId,
            eventId,
            action: 'admin_login',
            identifier: '/api/admin/login',
            result: 'SUCCESS',
            message: '',
            operator: 'Admin後台',
          });
        } catch (logError) {
          console.error('Admin login success logging error:', logError);
        }
      }

      const response = NextResponse.json({ success: true });
      if (process.env.ADMIN_PASSWORD) setAdminSession(response, eventId || '');
      return response;
    }

    // 密碼錯誤也記錄為系統警告
    if (eventId) {
      try {
        await logManagerAction({
            logSheetId,
          eventId,
          action: 'system_warning',
          identifier: '/api/admin/login',
          result: 'FAILED',
          message: 'Admin login failed: 密碼錯誤',
          operator: 'System',
        });
      } catch (logError) {
        console.error('Admin login warning logging error (401):', logError);
      }
    }

    return NextResponse.json(
      { success: false, message: '密碼錯誤' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Admin login API error:', error);

    // 若有 eventId，寫入系統錯誤 log
    try {
      const body = await req.json().catch(() => null as any);
      const eventId = body?.eventId as string | undefined;
      if (eventId) {
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/admin/login',
          result: 'FAILED',
          message:
            'Admin login API error: ' +
            (error instanceof Error ? error.message : String(error ?? 'unknown error')),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('System error logging failed (admin login):', logError);
    }
    return NextResponse.json(
      { success: false, message: '登入驗證時發生錯誤' },
      { status: 500 }
    );
  }
}
