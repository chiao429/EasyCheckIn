import { NextRequest, NextResponse } from 'next/server';
import { searchKidsAttendee, logManagerAction } from '@/lib/google-sheets';

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

    const results = await searchKidsAttendee(sheetId, query);

    return NextResponse.json({
      success: true,
      data: results,
      count: results.length,
    });
  } catch (error) {
    console.error('Kids search API error:', error);

    try {
      const searchParams = request.nextUrl.searchParams;
      const eventId = searchParams.get('eventId') || undefined;
      if (eventId) {
        await logManagerAction({
          eventId,
          action: 'system_error',
          identifier: '/api/kids/search',
          result: 'FAILED',
          message:
            'Kids search API error: ' +
            (error instanceof Error ? error.message : String(error ?? 'unknown error')),
          operator: 'System',
        });
      }
    } catch (logError) {
      console.error('System error logging failed (kids search):', logError);
    }

    return NextResponse.json(
      { success: false, message: '搜尋失敗' },
      { status: 500 }
    );
  }
}
