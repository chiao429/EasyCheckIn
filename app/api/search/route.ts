import { NextRequest, NextResponse } from 'next/server';
import { searchAttendee, logManagerAction } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sheetId = searchParams.get('sheetId');
    const query = searchParams.get('query');
    const eventId = searchParams.get('eventId') || undefined;

    if (!sheetId || !query) {
      return NextResponse.json(
        { success: false, message: '缺少必要參數' },
        { status: 400 }
      );
    }

    const results = await searchAttendee(sheetId, query);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Search API error:', error);

    // 若有 eventId，寫入系統錯誤 log
    try {
      const searchParams = request.nextUrl.searchParams;
      const eventId = searchParams.get('eventId') || undefined;
      if (eventId) {
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/search',
          result: 'FAILED',
          message:
            'Search API error: ' +
            (error instanceof Error ? error.message : String(error ?? 'unknown error')),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('System error logging failed (search):', logError);
    }
    return NextResponse.json(
      { success: false, message: '搜尋失敗' },
      { status: 500 }
    );
  }
}
