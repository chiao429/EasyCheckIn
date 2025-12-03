import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient, logManagerAction } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sheetId, identifier, eventId, operator, attendeeName } = body as {
      sheetId?: string;
      identifier?: string;
      eventId?: string;
      operator?: string;
      attendeeName?: string;
    };

    if (!sheetId || !identifier || !eventId) {
      return NextResponse.json(
        { success: false, message: '缺少 sheetId、identifier 或 eventId' },
        { status: 400 }
      );
    }

    const sheets = getGoogleSheetsClient();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:F',
    });

    const rows = response.data.values || [];

    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const serial = (row[4] || '').toString(); // E: 報名序號
      const name = (row[5] || '').toString(); // F: 兒童姓名
      if (serial === identifier || name === identifier) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
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

    // 兒童版：A=已到, B=到達時間，標記不會出席時寫入 A=CANCELLED、B 清空
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `A${actualRowIndex}:B${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['CANCELLED', '']],
      },
    });

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
      message: '已標記為不會出席（兒童）',
    });
  } catch (error) {
    console.error('Kids manager mark-cancelled error:', error);

    try {
      const body = await request.json().catch(() => null as any);
      const identifier = body?.identifier as string | undefined;
      const eventId = body?.eventId as string | undefined;
      const operator = body?.operator as string | undefined;
      const attendeeName = body?.attendeeName as string | undefined;
      const anyError = error as any;
      const googleErrorMessage =
        anyError?.response?.data?.error?.message || anyError?.message || undefined;
      const baseMessage = '標記不會出席時發生錯誤（兒童版）';
      const detailedMessage = googleErrorMessage
        ? `${baseMessage}（Google: ${googleErrorMessage}）`
        : baseMessage;
      if (identifier && eventId) {
        await logManagerAction({
          eventId,
          action: 'mark_cancelled_failed',
          identifier,
          attendeeName,
          result: 'FAILED',
          message: detailedMessage,
          operator,
        });

        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/kids/manager/mark-cancelled',
          result: 'FAILED',
          message:
            'Kids manager mark-cancelled error: ' +
            (googleErrorMessage ||
              (error instanceof Error ? error.message : String(error ?? 'unknown error'))),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('Kids manager mark-cancelled logging error:', logError);
    }

    return NextResponse.json(
      { success: false, message: '標記不會出席時發生錯誤' },
      { status: 500 }
    );
  }
}
