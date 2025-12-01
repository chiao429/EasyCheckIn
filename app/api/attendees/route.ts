import { NextRequest, NextResponse } from 'next/server';
import { getAllAttendees, logManagerAction } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sheetId = searchParams.get('sheetId');
    const filter = searchParams.get('filter'); // 'all', 'checked', 'unchecked'
    const eventId = searchParams.get('eventId') || undefined;

    if (!sheetId) {
      return NextResponse.json(
        { success: false, message: '缺少 sheetId 參數' },
        { status: 400 }
      );
    }

    let attendees = await getAllAttendees(sheetId);

    // 根據篩選條件過濾
    if (filter === 'checked') {
      attendees = attendees.filter((a) => a.已到 === 'TRUE');
    } else if (filter === 'unchecked') {
      attendees = attendees.filter((a) => a.已到 !== 'TRUE');
    }

    return NextResponse.json({
      success: true,
      data: attendees,
      total: attendees.length,
    });
  } catch (error) {
    console.error('Attendees API error:', error);

    // 若有 eventId，寫入系統錯誤 log
    try {
      const searchParams = request.nextUrl.searchParams;
      const eventId = searchParams.get('eventId') || undefined;
      if (eventId) {
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/attendees',
          result: 'FAILED',
          message:
            'Attendees API error: ' +
            (error instanceof Error ? error.message : String(error ?? 'unknown error')),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('System error logging failed (attendees):', logError);
    }
    return NextResponse.json(
      { success: false, message: '無法取得參加者資料' },
      { status: 500 }
    );
  }
}
