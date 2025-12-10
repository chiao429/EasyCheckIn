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

    // 讀取標題列與所有資料列，包含 U 欄（是否已聯繫）與可能的家長姓名欄位
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:U',
    });

    const rows = response.data.values || [];
    const headerRow = rows[0] || [];
    const dataRows = rows.slice(1);

    // 動態尋找「家長」相關欄位（例如：家長姓名、家長1姓名等）
    const parentColIndex = headerRow.findIndex((h) =>
      (h || '').toString().includes('家長')
    );

    // 若有家長欄位，處理合併儲存格：將家長姓名填充到後續空白列
    if (parentColIndex !== -1) {
      let lastParentName = '';
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const currentParentName = (row[parentColIndex] || '').toString().trim();

        if (currentParentName) {
          lastParentName = currentParentName;
        } else if (lastParentName) {
          row[parentColIndex] = lastParentName;
        }
      }
    }

    let rowIndex = -1;
    let currentContactStatus = '';
    let parentName = '';
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const serial = (row[4] || '').toString(); // E: 報名序號
      const name = (row[5] || '').toString(); // F: 兒童姓名
      if (serial === identifier || name === identifier) {
        rowIndex = i;
        currentContactStatus = (row[20] || '').toString(); // U: 是否已聯繫
        parentName =
          parentColIndex !== -1 ? (row[parentColIndex] || '').toString() : '';
        break;
      }
    }

    if (rowIndex === -1) {
      await logManagerAction({
        eventId,
        action: 'toggle_contact_failed',
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

    // header 佔第 1 列，資料從第 2 列開始，所以要 +2
    const actualRowIndex = rowIndex + 2;
    
    // 切換狀態：如果目前是空的或 FALSE，設為 TRUE（已聯繫）；如果是 TRUE，設為空（未聯繫）
    const newContactStatus = currentContactStatus === 'TRUE' ? '' : 'TRUE';

    // 收集所有需要更新的儲存格
    const updateRanges: { range: string; values: any[][] }[] = [];
    
    // 1. 當前孩子的更新
    updateRanges.push({
      range: `U${actualRowIndex}`,
      values: [[newContactStatus]],
    });

    // 2. 如果有家長姓名，則將同家長的其他孩子也更新為相同狀態（不論是否已報到）
    if (parentName && parentColIndex !== -1) {
      for (let i = 0; i < dataRows.length; i++) {
        if (i === rowIndex) continue; // 跳過當前這筆
        
        const row = dataRows[i];
        const otherParentName = (row[parentColIndex] || '').toString();
        const otherContactStatus = (row[20] || '').toString(); // U 欄
        
        // 如果家長姓名相同
        if (otherParentName === parentName) {
          // 標記為已聯繫時：將尚未聯繫的也標記為已聯繫
          // 取消已聯繫時：將已聯繫的也取消
          if (
            (newContactStatus === 'TRUE' && otherContactStatus !== 'TRUE') ||
            (newContactStatus === '' && otherContactStatus === 'TRUE')
          ) {
            const otherActualRowIndex = i + 2;
            updateRanges.push({
              range: `U${otherActualRowIndex}`,
              values: [[newContactStatus]],
            });
          }
        }
      }
    }

    // 批次更新所有儲存格（一次 API 呼叫）
    if (updateRanges.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updateRanges,
        },
      });
    }

    await logManagerAction({
      eventId,
      action: 'toggle_contact',
      identifier,
      attendeeName,
      result: 'SUCCESS',
      message: newContactStatus === 'TRUE' ? '標記為已聯繫' : '取消已聯繫',
      operator,
    });

    return NextResponse.json({
      success: true,
      message: newContactStatus === 'TRUE' ? '已標記為已聯繫' : '已取消已聯繫',
      newStatus: newContactStatus,
    });
  } catch (error) {
    console.error('Kids manager toggle-contact error:', error);

    try {
      const body = await request.json().catch(() => null as any);
      const identifier = body?.identifier as string | undefined;
      const eventId = body?.eventId as string | undefined;
      const operator = body?.operator as string | undefined;
      const attendeeName = body?.attendeeName as string | undefined;
      const anyError = error as any;
      const googleErrorMessage =
        anyError?.response?.data?.error?.message || anyError?.message || undefined;
      const baseMessage = '切換聯繫狀態時發生錯誤（兒童版）';
      const detailedMessage = googleErrorMessage
        ? `${baseMessage}（Google: ${googleErrorMessage}）`
        : baseMessage;
      if (identifier && eventId) {
        await logManagerAction({
          eventId,
          action: 'toggle_contact_failed',
          identifier,
          attendeeName,
          result: 'FAILED',
          message: detailedMessage,
          operator,
        });

        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/kids/manager/toggle-contact',
          result: 'FAILED',
          message:
            'Kids manager toggle-contact error: ' +
            (googleErrorMessage ||
              (error instanceof Error ? error.message : String(error ?? 'unknown error'))),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('Kids manager toggle-contact logging error:', logError);
    }

    return NextResponse.json(
      { success: false, message: '切換聯繫狀態時發生錯誤' },
      { status: 500 }
    );
  }
}
