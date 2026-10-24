import { NextRequest, NextResponse } from 'next/server';
import { getSquadPassword } from '@/lib/google-sheets';
import { issueSquadToken, passwordMatches } from '@/lib/squad-auth';

// 小隊長頁登入：比對活動設定表 資訊!B2
export async function POST(request: NextRequest) {
  try {
    const { password } = (await request.json()) as { password?: string };
    const actual = await getSquadPassword();
    if (!actual) {
      return NextResponse.json(
        { success: false, message: '尚未設定小隊長密碼（活動設定表「資訊」分頁 B2）' },
        { status: 500 }
      );
    }
    if (typeof password !== 'string' || !passwordMatches(password.trim(), actual)) {
      return NextResponse.json({ success: false, message: '密碼錯誤' }, { status: 401 });
    }
    return NextResponse.json({ success: true, token: issueSquadToken(actual) });
  } catch (error) {
    console.error('Squad login API error:', error);
    return NextResponse.json({ success: false, message: '登入時發生錯誤，請稍後再試' }, { status: 500 });
  }
}
