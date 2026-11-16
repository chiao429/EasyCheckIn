import { NextRequest, NextResponse } from 'next/server';
import { logManagerAction } from '@/lib/google-sheets';
import { registryConfigured, resolveYearEvent } from '@/lib/year-registry';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventId, configId, sheetId,
      type,
      success,
      failed,
      limited,
    }: {
      eventId?: string;
      configId?: string;
      sheetId?: string;
      type?: 'loadtest' | 'random_write';
      success?: number;
      failed?: number;
      limited?: number;
    } = body;

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: '缺少 eventId' },
        { status: 400 }
      );
    }

    const s = success ?? 0;
    const f = failed ?? 0;
    const l = limited ?? 0;
    const total = s + f + l;

    const identifier = type === 'random_write' ? 'admin-random-write' : 'admin-loadtest';
    const message = `壓力測試 summary (${identifier}): total=${total}, success=${s}, failed=${f}, limited=${l}`;

    const annual = registryConfigured();
    const match = annual && (configId || sheetId) ? await resolveYearEvent(eventId, configId, sheetId) : null;
    if (annual && !match) return NextResponse.json({ success: false, message: '找不到對應活動' }, { status: 404 });
    await logManagerAction({
      logSheetId: annual ? match?.event.logSheetId || null : undefined,
      eventId,
      action: 'system_warning',
      identifier,
      result: f > 0 || l > 0 ? 'FAILED' : 'SUCCESS',
      message,
      operator: 'Admin後台-壓測',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Log loadtest summary API error:', error);
    return NextResponse.json(
      { success: false, message: '寫入壓測 summary 失敗' },
      { status: 500 }
    );
  }
}
