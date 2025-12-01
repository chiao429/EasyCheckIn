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
      // 紀錄管理員操作：取消簽到失敗（找不到資料）
      await logManagerAction({
        eventId,
        action: 'cancel_checkin_failed',
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
        values: [['', '']],
      },
    });

    // 紀錄管理員操作：取消簽到
    await logManagerAction({
      eventId,
      action: 'cancel_checkin',
      identifier,
      attendeeName,
      result: 'SUCCESS',
      message: '',
      operator,
    });

    return NextResponse.json({
      success: true,
      message: '已取消簽到，狀態恢復為未簽到',
    });
  } catch (error) {
    console.error('Manager cancel-checkin error:', error);

    // 嘗試寫入失敗 log（若 eventId 或 identifier 缺失就略過）
    try {
      const body = await request.json().catch(() => null);
      const identifier = body?.identifier as string | undefined;
      const eventId = body?.eventId as string | undefined;
      const operator = body?.operator as string | undefined;
      const attendeeName = body?.attendeeName as string | undefined;
      const anyError = error as any;
      const googleErrorMessage =
        anyError?.response?.data?.error?.message || anyError?.message || undefined;
      const baseMessage = '取消簽到時發生錯誤';
      const detailedMessage = googleErrorMessage
        ? `${baseMessage}（Google: ${googleErrorMessage}）`
        : baseMessage;
      if (identifier && eventId) {
        await logManagerAction({
          eventId,
          action: 'cancel_checkin_failed',
          identifier,
          attendeeName,
          result: 'FAILED',
          message: detailedMessage,
          operator,
        });

        // 額外寫入一筆系統錯誤紀錄
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/manager/cancel-checkin',
          result: 'FAILED',
          message:
            'Manager cancel-checkin error: ' +
            (googleErrorMessage ||
              (error instanceof Error ? error.message : String(error ?? 'unknown error'))),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('Manager cancel-checkin logging error:', logError);
    }

    return NextResponse.json(
      { success: false, message: '取消簽到時發生錯誤' },
      { status: 500 }
    );
  }
}
