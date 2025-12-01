import { NextRequest, NextResponse } from 'next/server';
import { checkIn, logManagerAction } from '@/lib/google-sheets';

// 簡單的併發/速率限制：每個執行個體每分鐘最多允許 30 次簽到請求
// 注意：這是記憶體內的計數，對單一 serverless function 實例有效，
// 對目前活動規模已足夠防止瞬間大量寫入。
let currentWindowStart = Date.now();
let requestCountInWindow = 0;
const WINDOW_SIZE_MS = 60_000; // 1 分鐘
const MAX_REQUESTS_PER_WINDOW = 30; // 每分鐘最多 30 次

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
    return NextResponse.json(
      { success: false, message: '系統錯誤，請稍後再試' },
      { status: 500 }
    );
  }
}
