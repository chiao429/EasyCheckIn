import { NextRequest, NextResponse } from 'next/server';
import { getKidsSchedule } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

// 兒童版小隊時間表：優先讀活動試算表的「小隊時間表」分頁，沒有分頁時回傳 source=file
export async function GET(request: NextRequest) {
  const sheetId = request.nextUrl.searchParams.get('sheetId');
  if (!sheetId) {
    return NextResponse.json({ success: false, message: '缺少 sheetId 參數' }, { status: 400 });
  }
  try {
    const data = await getKidsSchedule(sheetId);
    return NextResponse.json(data ? { success: true, source: 'sheet', data } : { success: true, source: 'file', data: null });
  } catch (error) {
    console.error('Kids schedule API error:', error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '讀取小隊時間表失敗' },
      { status: 500 }
    );
  }
}
