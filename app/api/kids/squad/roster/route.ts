import { NextRequest, NextResponse } from 'next/server';
import { getKidsBySquad, getKidsSchedule } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

// 小隊長頁：只回傳指定小隊的名單與時間表
export async function GET(request: NextRequest) {
  try {
    const sheetId = request.nextUrl.searchParams.get('sheetId');
    const squad = (request.nextUrl.searchParams.get('squad') || '').trim().toUpperCase();
    if (!sheetId) {
      return NextResponse.json({ success: false, message: '缺少 sheetId 參數' }, { status: 400 });
    }

    const { squadTitle, bySquad } = await getKidsBySquad(sheetId);
    const squads = Array.from(bySquad.keys()).sort((a, b) => a.localeCompare(b, 'zh-Hant', { numeric: true }));
    if (!squad) {
      return NextResponse.json({ success: true, data: { squads } });
    }
    if (!bySquad.has(squad)) {
      return NextResponse.json({ success: false, message: `找不到小隊「${squad}」`, data: { squads } }, { status: 404 });
    }

    let schedule: unknown[] = [];
    try {
      schedule = (await getKidsSchedule(sheetId))?.[squad] ?? [];
    } catch (error) {
      console.error('Squad schedule error:', error);
    }

    return NextResponse.json({
      success: true,
      data: { squads, squad, squadTitle, kids: bySquad.get(squad), schedule },
    });
  } catch (error) {
    console.error('Squad roster API error:', error);
    return NextResponse.json({ success: false, message: '多人訪問系統中，請稍後10秒再重試' }, { status: 500 });
  }
}
