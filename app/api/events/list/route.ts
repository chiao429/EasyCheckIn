import { readActivityStates, type ActivityState } from '@/lib/activity-state';
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient, extractSheetIdFromUrl } from '@/lib/google-sheets';
import { activityBindings, readYearConfigs, registryConfigured } from '@/lib/year-registry';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const onlyEventId = req.nextUrl.searchParams.get('onlyEventId') || undefined;
    const requestedConfigId = req.nextUrl.searchParams.get('configId') || undefined;
    let configSheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
    let publishedBindings: string | undefined;
    let configId: string | undefined;
    let states: Map<string, ActivityState> | undefined;
    let acceptsCheckins = true;
    let currentYear: { year: string; name: string; folderUrl: string } | null = null;
    if (registryConfigured()) {
      const registry = await readYearConfigs();
      const active = registry.configs.find((config) => config.configId === registry.activeConfigId);
      const selected = onlyEventId && requestedConfigId
        ? registry.configs.find((config) => config.configId === requestedConfigId && ['active', 'validated', 'archived'].includes(config.status))
        : active;
      if (!selected || (!onlyEventId && !['validated', 'active'].includes(selected.status))) {
        return NextResponse.json({ success: false, message: '目前沒有已驗證的啟用年度' }, { status: 503 });
      }
      configSheetId = selected.configSheetId;
      acceptsCheckins = selected.acceptsCheckins;
      states = await readActivityStates(registry.registryId);
      configId = selected.configId;
      currentYear = {
        year: selected.year,
        name: selected.name,
        folderUrl: /^https:\/\/drive\.google\.com\/drive\/folders\/[\w-]+/.test(selected.folderUrl) ? selected.folderUrl : '',
      };
      publishedBindings = selected.publishedBindings;
    }

    if (!configSheetId) {
      return NextResponse.json(
        { success: false, message: 'GOOGLE_EVENT_CONFIG_SHEET_ID 未設定' },
        { status: 500 }
      );
    }

    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
      range: configId ? '工作表1!A2:G' : 'A2:G',
    });

    const rows = response.data.values || [];

    if (configId && publishedBindings !== activityBindings(rows)) {
      return NextResponse.json({ success: false, message: '活動對應已變更' }, { status: 503 });
    }

    const events = rows
      .filter((row) => row[2] && (!onlyEventId || String(row[2]) === onlyEventId))
      .map((row) => {
        const name = row[0] || '';
        const link = row[1] || '';
        const eventId = row[2] || '';
        const note = row[3] || '';
        // F 欄為版本（同工/兒童），G 欄為活動類型
        const version = row[5] || '';
        const eventType = row[6] || '';
        const sheetId = extractSheetIdFromUrl(link);

        return {
          checkinOpen: acceptsCheckins && (states?.get(`${eventId}:${sheetId}`) || 'open') === 'open',
          eventId,
          name,
          sheetId,
          note,
          version,
          eventType,
          ...(configId ? { configId } : {}),
        };
      })
      .filter(({ eventId, sheetId }) => states?.get(`${eventId}:${sheetId}`) !== 'deleted');

    return NextResponse.json({ success: true, data: events, currentYear, configSheetId });
  } catch (error) {
    console.error('Events list API error:', error);
    return NextResponse.json(
      { success: false, message: '載入活動設定時發生錯誤' },
      { status: 500 }
    );
  }
}
