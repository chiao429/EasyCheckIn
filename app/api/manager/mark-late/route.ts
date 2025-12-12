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
      range: 'A2:D',
    });

    const rows = response.data.values || [];

    let rowIndex = -1;
    let currentStatus = '';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === identifier || row[1] === identifier) {
        rowIndex = i;
        currentStatus = (row[3] || '').toString();
        break;
      }
    }

    if (rowIndex === -1) {
      await logManagerAction({
        eventId,
        action: 'mark_late_failed',
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

    const isCurrentlyLate = currentStatus === '晚到';
    const newValues: string[] = isCurrentlyLate ? ['', ''] : ['', '晚到'];

    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `C${actualRowIndex}:D${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [newValues],
      },
    });

    await logManagerAction({
      eventId,
      action: 'mark_late',
      identifier,
      attendeeName,
      result: 'SUCCESS',
      message: isCurrentlyLate ? '取消晚到標記' : '標記為晚到',
      operator,
    });

    return NextResponse.json({
      success: true,
      message: isCurrentlyLate ? '已取消晚到標記' : '已標記為晚到',
      newStatus: isCurrentlyLate ? '' : '晚到',
    });
  } catch (error) {
    console.error('Manager mark-late error:', error);

    try {
      const body = await request.json().catch(() => null as any);
      const identifier = body?.identifier as string | undefined;
      const eventId = body?.eventId as string | undefined;
      const operator = body?.operator as string | undefined;
      const attendeeName = body?.attendeeName as string | undefined;
      const anyError = error as any;
      const googleErrorMessage =
        anyError?.response?.data?.error?.message || anyError?.message || undefined;
      const baseMessage = '標記晚到時發生錯誤';
      const detailedMessage = googleErrorMessage
        ? `${baseMessage}（Google: ${googleErrorMessage}）`
        : baseMessage;
      if (identifier && eventId) {
        await logManagerAction({
          eventId,
          action: 'mark_late_failed',
          identifier,
          attendeeName,
          result: 'FAILED',
          message: detailedMessage,
          operator,
        });

        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/manager/mark-late',
          result: 'FAILED',
          message:
            'Manager mark-late error: ' +
            (googleErrorMessage ||
              (error instanceof Error ? error.message : String(error ?? 'unknown error'))),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('Manager mark-late logging error:', logError);
    }

    return NextResponse.json(
      { success: false, message: '標記晚到時發生錯誤' },
      { status: 500 }
    );
  }
}
