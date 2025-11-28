import { NextRequest, NextResponse } from 'next/server';
import { getAdminPasswordFromConfigSheet } from '@/lib/google-sheets';

export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json();

    if (typeof password !== 'string' || !password) {
      return NextResponse.json(
        { success: false, message: '密碼格式不正確' },
        { status: 400 }
      );
    }

    const sheetPassword = await getAdminPasswordFromConfigSheet();

    if (!sheetPassword) {
      return NextResponse.json(
        { success: false, message: '尚未在活動設定試算表中設定後台密碼（資訊!A2）' },
        { status: 500 }
      );
    }

    if (password === sheetPassword) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, message: '密碼錯誤' },
      { status: 401 }
    );
  } catch (error) {
    console.error('Admin login API error:', error);
    return NextResponse.json(
      { success: false, message: '登入驗證時發生錯誤' },
      { status: 500 }
    );
  }
}
