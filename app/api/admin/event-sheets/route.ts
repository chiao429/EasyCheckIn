import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient, extractSheetIdFromUrl } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');

    if (!eventId) {
      return NextResponse.json(
        { success: false, message: '缺少 eventId 參數' },
        { status: 400 }
      );
    }

    const configSheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
    if (!configSheetId) {
      return NextResponse.json(
        { success: false, message: 'GOOGLE_EVENT_CONFIG_SHEET_ID 未設定' },
        { status: 500 }
      );
    }

    const sheets = getGoogleSheetsClient();

    // 結構同 logManagerAction 註解：
    // A: 活動名稱
    // B: 活動試算表連結
    // C: eventId
    // D: 備註
    // E: 操作紀錄連結（log Sheet 連結）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
      range: 'A2:E',
    });

    const rows = response.data.values || [];

    let activitySheetLink: string | null = null;
    let logSheetLink: string | null = null;

    for (const row of rows) {
      const rowEventId = (row[2] || '').toString();
      if (!rowEventId) continue;
      if (rowEventId === eventId) {
        activitySheetLink = (row[1] || '').toString();
        logSheetLink = (row[4] || '').toString();
        break;
      }
    }

    if (!activitySheetLink && !logSheetLink) {
      return NextResponse.json(
        { success: false, message: '找不到對應活動的設定資料' },
        { status: 404 }
      );
    }

    const activitySheetId = activitySheetLink
      ? extractSheetIdFromUrl(activitySheetLink)
      : null;
    const logSheetId = logSheetLink ? extractSheetIdFromUrl(logSheetLink) : null;

    // 也一併回傳標準化後的 Google Sheets 直接編輯網址，方便前端使用
    const activitySheetUrl = activitySheetId
      ? `https://docs.google.com/spreadsheets/d/${activitySheetId}/edit`
      : null;
    const logSheetUrl = logSheetId
      ? `https://docs.google.com/spreadsheets/d/${logSheetId}/edit`
      : null;

    return NextResponse.json({
      success: true,
      data: {
        eventId,
        activitySheetLink,
        logSheetLink,
        activitySheetId,
        logSheetId,
        activitySheetUrl,
        logSheetUrl,
      },
    });
  } catch (error) {
    console.error('event-sheets API error:', error);
    return NextResponse.json(
      { success: false, message: '無法讀取活動試算表設定' },
      { status: 500 }
    );
  }
}
