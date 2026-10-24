import { NextRequest, NextResponse } from 'next/server';
import { checkInKidsRows, logManagerAction } from '@/lib/google-sheets';

// 兒童版：同一家庭一次報到（最多 10 人），每位各寫一筆日誌
export async function POST(request: NextRequest) {
  try {
    const { sheetId, targets, absentTargets, eventId, operator } = (await request.json()) as {
      sheetId?: string;
      targets?: { rowIndex: number; 姓名: string }[];
      /** 同戶未勾選者，標記為不會出席 */
      absentTargets?: { rowIndex: number; 姓名: string }[];
      eventId?: string;
      operator?: string;
    };
    if (!sheetId || !Array.isArray(targets) || targets.length === 0) {
      return NextResponse.json({ success: false, message: '請至少選擇一位' }, { status: 400 });
    }
    if (targets.length + (absentTargets?.length ?? 0) > 10) {
      return NextResponse.json({ success: false, message: '一次最多 10 位' }, { status: 400 });
    }
    const isValid = (t: { rowIndex: number; 姓名: string }) =>
      Number.isInteger(t.rowIndex) && t.rowIndex >= 2 && typeof t.姓名 === 'string';
    const { checkedIn, markedAbsent, skipped } = await checkInKidsRows(
      sheetId,
      targets.filter(isValid),
      (Array.isArray(absentTargets) ? absentTargets : []).filter(isValid)
    );

    if (eventId) {
      for (const c of checkedIn) {
        try {
          await logManagerAction({
            eventId,
            action: 'manager_checkin',
            identifier: c.序號 || c.姓名,
            attendeeName: c.姓名,
            result: 'SUCCESS',
            message: checkedIn.length > 1 ? `家庭一起報到（${checkedIn.length} 位）` : '',
            operator,
          });
        } catch (logError) {
          console.error('Kids batch check-in logging error:', logError);
        }
      }
      for (const a of markedAbsent) {
        try {
          await logManagerAction({
            eventId,
            action: 'mark_cancelled',
            identifier: a.序號 || a.姓名,
            attendeeName: a.姓名,
            result: 'SUCCESS',
            message: '同戶一起報到時未勾選',
            operator,
          });
        } catch (logError) {
          console.error('Kids batch absent logging error:', logError);
        }
      }
    }

    return NextResponse.json({
      success: checkedIn.length > 0,
      message: checkedIn.length > 0 ? `報到成功 ${checkedIn.length} 位` : skipped[0]?.reason || '沒有可報到的人',
      data: checkedIn,
      markedAbsent,
      skipped,
    });
  } catch (error) {
    console.error('Kids batch check-in API error:', error);
    return NextResponse.json({ success: false, message: '多人訪問系統中，請稍後10秒再重試' }, { status: 500 });
  }
}
