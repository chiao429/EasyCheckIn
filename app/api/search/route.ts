import { NextRequest, NextResponse } from 'next/server';
import { searchAttendee } from '@/lib/google-sheets';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sheetId = searchParams.get('sheetId');
    const query = searchParams.get('query');

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
    return NextResponse.json(
      { success: false, message: '搜尋失敗' },
      { status: 500 }
    );
  }
}
