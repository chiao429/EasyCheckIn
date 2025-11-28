import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/google-sheets';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sheetId, identifier } = body;

    if (!sheetId || !identifier) {
      return NextResponse.json(
        { success: false, message: '缺少 sheetId 或 identifier' },
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

    return NextResponse.json({
      success: true,
      message: '已取消簽到，狀態恢復為未簽到',
    });
  } catch (error) {
    console.error('Manager cancel-checkin error:', error);
    return NextResponse.json(
      { success: false, message: '取消簽到時發生錯誤' },
      { status: 500 }
    );
  }
}
