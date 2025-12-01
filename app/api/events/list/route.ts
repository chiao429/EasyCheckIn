import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient, extractSheetIdFromUrl } from '@/lib/google-sheets';

export async function GET(_req: NextRequest) {
  try {
    const configSheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;

    if (!configSheetId) {
      return NextResponse.json(
        { success: false, message: 'GOOGLE_EVENT_CONFIG_SHEET_ID 未設定' },
        { status: 500 }
      );
    }

    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
      range: 'A2:D',
    });

    const rows = response.data.values || [];

    const events = rows
      .filter((row) => row[2])
      .map((row) => {
        const name = row[0] || '';
        const link = row[1] || '';
        const eventId = row[2] || '';
        const note = row[3] || '';
        const sheetId = extractSheetIdFromUrl(link);

        return {
          eventId,
          name,
          sheetId,
          note,
        };
      });

    return NextResponse.json({ success: true, data: events });
  } catch (error) {
    console.error('Events list API error:', error);
    return NextResponse.json(
      { success: false, message: '載入活動設定時發生錯誤' },
      { status: 500 }
    );
  }
}
