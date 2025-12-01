import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient, logManagerAction } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sheetId, identifier, eventId, operator, attendeeName } = body;

    if (!sheetId || !identifier || !eventId) {
      return NextResponse.json(
        { success: false, message: '缺少 sheetId、identifier 或 eventId' },
        { status: 400 }
      );
    }

    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:D',
    });

    const rows = response.data.values || [];

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === identifier || row[1] === identifier) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      // 紀錄管理員操作：標記不會來失敗（找不到資料）
      await logManagerAction({
        eventId,
        action: 'mark_cancelled_failed',
        identifier,
        attendeeName,
        result: 'FAILED',
        message: '找不到此序號或姓名',
        operator,
      });

      return NextResponse.json(
        { success: false, message: '找不到此序號或姓名' },
        { status: 404 }
      );
    }

    const actualRowIndex = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `C${actualRowIndex}:D${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['', 'CANCELLED']],
      },
    });

    // 紀錄管理員操作：標記不會來
    await logManagerAction({
      eventId,
      action: 'mark_cancelled',
      identifier,
      attendeeName,
      result: 'SUCCESS',
      message: '',
      operator,
    });

    return NextResponse.json({
      success: true,
      message: '已標記為不會來',
    });
  } catch (error) {
    console.error('Manager mark-cancelled error:', error);

    // 嘗試寫入失敗 log
    try {
      const body = await request.json().catch(() => null);
      const identifier = body?.identifier as string | undefined;
      const eventId = body?.eventId as string | undefined;
      const operator = body?.operator as string | undefined;
      const attendeeName = body?.attendeeName as string | undefined;
      if (identifier && eventId) {
        await logManagerAction({
          eventId,
          action: 'mark_cancelled_failed',
          identifier,
          attendeeName,
          result: 'FAILED',
          message: '標記不會來時發生錯誤',
          operator,
        });
      }
    } catch (logError) {
      console.error('Manager mark-cancelled logging error:', logError);
    }

    return NextResponse.json(
      { success: false, message: '標記不會來時發生錯誤' },
      { status: 500 }
    );
  }
}
