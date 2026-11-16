import { NextRequest, NextResponse } from 'next/server';
import { findKidsFamily } from '@/lib/google-sheets';
import { resolveRequestedSheet } from '@/lib/year-registry';

// 兒童版：查詢與此列家長電話相同的兄弟姊妹
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { sheetId?: string; rowIndex?: number; eventId?: string; configId?: string };
    const { rowIndex, eventId, configId } = body;
    const sheetId = await resolveRequestedSheet(eventId || null, body.sheetId || null, configId);
    if (!sheetId || !Number.isInteger(rowIndex) || (rowIndex as number) < 2) {
      return NextResponse.json({ success: false, message: '缺少必要參數' }, { status: 400 });
    }
    const family = await findKidsFamily(sheetId, rowIndex as number);
    if (!family) {
      return NextResponse.json({ success: false, message: '找不到此筆資料，請重新搜尋' });
    }
    return NextResponse.json({ success: true, data: family });
  } catch (error) {
    console.error('Kids family lookup API error:', error);
    return NextResponse.json({ success: false, message: '多人訪問系統中，請稍後10秒再重試' }, { status: 500 });
  }
}
