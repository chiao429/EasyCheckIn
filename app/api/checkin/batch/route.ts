import { NextRequest, NextResponse } from 'next/server';
import { checkInRows } from '@/lib/google-sheets';

// 自助報到：同一家人一次報到（最多 10 人）
export async function POST(request: NextRequest) {
  try {
    const { sheetId, targets } = (await request.json()) as {
      sheetId?: string;
      targets?: { rowIndex: number; 姓名: string }[];
    };
    if (!sheetId || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ success: false, message: '請至少選擇一位' }, { status: 400 });
    }
    if (targets.length > 10) {
      return NextResponse.json({ success: false, message: '一次最多 10 位' }, { status: 400 });
    }
    const valid = targets.filter((t) => Number.isInteger(t.rowIndex) && t.rowIndex >= 2 && typeof t.姓名 === 'string');
    const { checkedIn, skipped } = await checkInRows(sheetId, valid);
    return NextResponse.json({
      success: checkedIn.length > 0,
      message: checkedIn.length > 0 ? `簽到成功 ${checkedIn.length} 位` : skipped[0]?.reason || '沒有可簽到的人',
      data: checkedIn,
      skipped,
    });
  } catch (error) {
    console.error('Batch check-in API error:', error);
    return NextResponse.json({ success: false, message: '多人訪問系統中，請稍後10秒再重試' }, { status: 500 });
  }
}
