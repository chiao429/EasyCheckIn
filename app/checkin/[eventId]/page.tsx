'use client';

import { useCallback, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import {
  CheckInResultDialog,
  FamilyPickDialog,
  type CheckInInfo as CheckInData,
  type FamilyCandidate as FamilyMember,
} from '@/components/CheckInDialogs';
import { CheckCircle2, XCircle, Loader2, UserCheck } from 'lucide-react';

export default function CheckInPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetFromQuery = searchParams.get('sheet');
  
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    data?: any;
  } | null>(null);
  // 報到成功後彈出的報名資訊視窗（可能是一家人多位）
  const [popup, setPopup] = useState<CheckInData[] | null>(null);
  // 同一聯絡電話的家人，勾選後一起報到
  const [family, setFamily] = useState<FamilyMember[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);
  const sheetId = sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId;

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 0);
  const closePopup = useCallback(() => {
    setPopup(null);
    focusInput();
  }, []);
  const closeFamily = () => {
    setFamily(null);
    focusInput();
  };

  const post = async (url: string, body: unknown) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return response.json();
  };

  // 單人報到（沒有家人時，維持原本流程）
  const checkInSingle = async (name: string) => {
    const data = await post('/api/checkin', { identifier: name, sheetId });
    setResult(data);
    if (data.success) {
      setIdentifier('');
      if (data.data) setPopup([data.data as CheckInData]);
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!identifier.trim()) {
      setResult({
        success: false,
        message: '請輸入報名序號或姓名',
      });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const lookup = await post('/api/checkin/family', { identifier: identifier.trim(), sheetId });
      if (!lookup.success) {
        setResult(lookup);
        return;
      }
      const { main, others } = lookup.data as { main: FamilyMember; others: FamilyMember[] };
      if (others.length === 0) {
        await checkInSingle(identifier.trim());
        return;
      }
      const list = [main, ...others];
      setFamily(list);
      setPicked(new Set(list.filter((m) => m.已到 !== 'TRUE').map((m) => m.rowIndex)));
    } catch (error) {
      setResult({
        success: false,
        message: '網路錯誤，請檢查連線後再試',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFamilyCheckIn = async () => {
    if (!family) return;
    const targets = family.filter((m) => picked.has(m.rowIndex)).map((m) => ({ rowIndex: m.rowIndex, 姓名: m.姓名 }));
    if (targets.length === 0) return;
    setLoading(true);
    try {
      const data = await post('/api/checkin/batch', { sheetId, targets });
      const skippedText = (data.skipped || []).map((x: { 姓名: string; reason: string }) => `${x.姓名}：${x.reason}`).join('；');
      setResult({ success: data.success, message: skippedText ? `${data.message}（${skippedText}）` : data.message });
      setFamily(null);
      if (data.success) {
        setIdentifier('');
        setPopup(data.data as CheckInData[]);
      } else {
        focusInput();
      }
    } catch (error) {
      setResult({ success: false, message: '網路錯誤，請檢查連線後再試' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-xl mb-8">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center mb-2">
            <UserCheck className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl">簽到</CardTitle>
          <CardDescription className="text-base">
            請輸入您的姓名（全名）進行簽到
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleCheckIn} className="space-y-4">
            <div className="space-y-2">
              <Input
                ref={inputRef}
                type="text"
                placeholder="請輸入您的姓名"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading}
                className="text-lg h-12"
                autoFocus
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  簽到中...
                </>
              ) : (
                '確認簽到'
              )}
            </Button>
          </form>

          {result && (
            <div
              className={`mt-6 p-4 rounded-lg flex items-start space-x-3 ${
                result.success
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {result.success ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <p
                  className={`font-semibold ${
                    result.success ? 'text-green-900' : 'text-red-900'
                  }`}
                >
                  {result.message}
                </p>
                {result.success && result.data && !Array.isArray(result.data) && (
                  <div className="mt-2 text-sm text-green-800 space-y-1">
                    <p>序號：{result.data.序號}</p>
                    <p>姓名：{result.data.姓名}</p>
                    <p>時間：{result.data.到達時間}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-6 pt-6 border-t text-center space-y-2">
            <p className="text-sm text-amber-600 font-medium">
              請輸入正確全名，若有問題請洽報到處
            </p>
            <p className="text-sm text-muted-foreground">活動 ID: {eventId}</p>
          </div>
        </CardContent>
      </Card>
      <SiteFooter />

      {family && (
        <FamilyPickDialog
          members={family}
          picked={picked}
          loading={loading}
          onToggle={(rowIndex, checked) => {
            const next = new Set(picked);
            if (checked) next.add(rowIndex);
            else next.delete(rowIndex);
            setPicked(next);
          }}
          onConfirm={handleFamilyCheckIn}
          onCancel={closeFamily}
        />
      )}

      {popup && <CheckInResultDialog people={popup} onClose={closePopup} />}
    </div>
  );
}
