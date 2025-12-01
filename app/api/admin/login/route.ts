import { NextRequest, NextResponse } from 'next/server';
import { getAdminPasswordFromConfigSheet, logManagerAction } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  try {
    const { password, eventId } = (await req.json()) as {
      password?: string;
      eventId?: string;
    };

    if (typeof password !== 'string' || !password) {
      // 密碼格式不正確視為系統警告
      if (eventId) {
        try {
          await logManagerAction({
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

    const sheetPassword = await getAdminPasswordFromConfigSheet();

    if (!sheetPassword) {
      return NextResponse.json(
        { success: false, message: '尚未在活動設定試算表中設定後台密碼（資訊!A2）' },
        { status: 500 }
      );
    }

    if (password === sheetPassword) {
      // 登入成功也記錄 log（若有 eventId）
      if (eventId) {
        try {
          await logManagerAction({
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

      return NextResponse.json({ success: true });
    }

    // 密碼錯誤也記錄為系統警告
    if (eventId) {
      try {
        await logManagerAction({
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
