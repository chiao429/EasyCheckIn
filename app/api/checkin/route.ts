import { NextRequest, NextResponse } from 'next/server';
import { checkIn, logManagerAction } from '@/lib/google-sheets';

// 簡單的併發/速率限制：每個執行個體每秒最多允許 45 次簽到請求
// 注意：這是記憶體內的計數，對單一 serverless function 實例有效。
let currentWindowStart = Date.now();
let requestCountInWindow = 0;
const WINDOW_SIZE_MS = 1_000; // 1 秒
const MAX_REQUESTS_PER_WINDOW = 45; // 每秒最多 45 次

function canProceedCheckIn() {
  const now = Date.now();
  const elapsed = now - currentWindowStart;

  if (elapsed > WINDOW_SIZE_MS) {
    currentWindowStart = now;
    requestCountInWindow = 0;
  }

  if (requestCountInWindow >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  requestCountInWindow += 1;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    if (!canProceedCheckIn()) {
      return NextResponse.json(
        {
          success: false,
          message:
            '目前簽到人數過多，系統正在保護中，請稍候幾秒再試一次，現場工作人員也會協助您。',
        },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { identifier, sheetId, source, eventId, operator, attendeeName } = body as {
      identifier?: string;
      sheetId?: string;
      source?: 'self' | 'manager';
      eventId?: string;
      operator?: string;
      attendeeName?: string;
    };

    if (!identifier || !sheetId) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    const result = await checkIn(sheetId, identifier);

    // 若是由 manager 代為簽到，記錄成功/失敗 log
    if (source === 'manager' && eventId) {
      try {
        await logManagerAction({
          eventId,
          action: result.success ? 'manager_checkin' : 'manager_checkin_failed',
          identifier,
          attendeeName,
          result: result.success ? 'SUCCESS' : 'FAILED',
          message: result.success ? '' : result.message,
          operator,
        });
      } catch (logError) {
        console.error('Manager check-in logging error:', logError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Check-in API error:', error);
    const BUSY_MESSAGE = '多人訪問系統中，請稍後10秒再重試';

    // 嘗試判斷是否為 Google Sheets 配額 / 限流問題
    let handled = false;
    try {
      const anyError = error as any;
      const status = anyError?.code || anyError?.response?.status;
      const reason =
        anyError?.errors?.[0]?.reason ||
        anyError?.response?.data?.error?.reason ||
        anyError?.response?.data?.error?.status;

      if (status === 429 || reason === 'rateLimitExceeded') {
        handled = true;

        // 若有 eventId，可嘗試寫入系統錯誤 log
        try {
          const body = await request.json().catch(() => null as any);
          const eventId = body?.eventId as string | undefined;
          const identifier = body?.identifier as string | undefined;
          if (eventId) {
            await logManagerAction({
              eventId,
              action: 'system_warning',
              identifier: identifier || '/api/checkin',
              result: 'FAILED',
              message:
                'Check-in API rate limited: ' +
                (error instanceof Error ? error.message : String(error ?? 'unknown error')),
              operator: 'System',
            });
          }
        } catch (logError) {
          console.error('System warning logging failed (check-in 429):', logError);
        }

        return NextResponse.json(
          { success: false, message: BUSY_MESSAGE },
          { status: 429 }
        );
      }
    } catch (inspectError) {
      console.error('Error while inspecting check-in error:', inspectError);
    }

    // 其他非配額型錯誤：照舊寫入系統錯誤 log，並回傳 500
    try {
      const body = await request.json().catch(() => null as any);
      const eventId = body?.eventId as string | undefined;
      const identifier = body?.identifier as string | undefined;
      if (eventId) {
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: identifier || '/api/checkin',
          result: 'FAILED',
          message:
            'Check-in API error: ' +
            (error instanceof Error ? error.message : String(error ?? 'unknown error')),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('System error logging failed (check-in):', logError);
    }

    return NextResponse.json(
      { success: false, message: '多人訪問系統中，請稍後10秒再重試' },
      { status: 500 }
    );
  }
}
