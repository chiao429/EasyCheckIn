import { NextRequest, NextResponse } from 'next/server';
import { checkInKids, logManagerAction } from '@/lib/google-sheets';

let currentWindowStart = Date.now();
let requestCountInWindow = 0;
const WINDOW_SIZE_MS = 1_000;
const MAX_REQUESTS_PER_WINDOW = 40;

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
    const { identifier, sheetId, eventId, operator, attendeeName } = body as {
      identifier?: string;
      sheetId?: string;
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

    const result = await checkInKids(sheetId, identifier);

    if (eventId) {
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
        console.error('Kids manager check-in logging error:', logError);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Kids check-in API error:', error);
    const BUSY_MESSAGE = '多人訪問系統中，請稍後10秒再重試';

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

        try {
          const body = await request.json().catch(() => null as any);
          const eventId = body?.eventId as string | undefined;
          const identifier = body?.identifier as string | undefined;
          if (eventId) {
            await logManagerAction({
              eventId,
              action: 'system_warning',
              identifier: identifier || '/api/kids/checkin',
              result: 'FAILED',
              message:
                'Kids check-in API rate limited: ' +
                (error instanceof Error ? error.message : String(error ?? 'unknown error')),
              operator: 'System',
            });
          }
        } catch (logError) {
          console.error('System warning logging failed (kids check-in 429):', logError);
        }

        return NextResponse.json(
          { success: false, message: BUSY_MESSAGE },
          { status: 429 }
        );
      }
    } catch (inspectError) {
      console.error('Error while inspecting kids check-in error:', inspectError);
    }

    try {
      const body = await request.json().catch(() => null as any);
      const eventId = body?.eventId as string | undefined;
      const identifier = body?.identifier as string | undefined;
      if (eventId) {
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: identifier || '/api/kids/checkin',
          result: 'FAILED',
          message:
            'Kids check-in API error: ' +
            (error instanceof Error ? error.message : String(error ?? 'unknown error')),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('System error logging failed (kids check-in):', logError);
    }

    return NextResponse.json(
      { success: false, message: BUSY_MESSAGE },
      { status: 500 }
    );
  }
}
