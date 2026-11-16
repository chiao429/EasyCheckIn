import { NextRequest, NextResponse } from 'next/server';
import { findFamily } from '@/lib/google-sheets';
import { resolveRequestedSheet } from '@/lib/year-registry';

// 自助報到：查詢輸入的人與聯絡電話相同的家人
export async function POST(request: NextRequest) {
  try {
    const { identifier, sheetId: requestedSheetId, eventId, configId } = (await request.json()) as { identifier?: string; sheetId?: string; eventId?: string; configId?: string };
    const sheetId = await resolveRequestedSheet(eventId || null, requestedSheetId || null, configId);
    if (!identifier || !sheetId) {
      return NextResponse.json({ success: false, message: '缺少必要參數' }, { status: 400 });
    }
    const family = await findFamily(sheetId, identifier.trim());
    if (!family) {
      return NextResponse.json({ success: false, message: '找不到此序號或姓名，請確認後再試' });
    }
    return NextResponse.json({ success: true, data: family });
  } catch (error) {
    console.error('Family lookup API error:', error);
    return NextResponse.json({ success: false, message: '多人訪問系統中，請稍後10秒再重試' }, { status: 500 });
  }
}
