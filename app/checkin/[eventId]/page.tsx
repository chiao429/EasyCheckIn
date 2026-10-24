'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import { CheckCircle2, XCircle, Loader2, UserCheck } from 'lucide-react';

interface CheckInData {
  序號: string;
  姓名: string;
  到達時間: string;
  已到?: string;
  詳細欄位?: { 標題: string; 值: string }[];
}

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
  // 報到成功後彈出的報名資訊視窗
  const [popup, setPopup] = useState<CheckInData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const closePopup = () => {
    setPopup(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    if (!popup) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') closePopup();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [popup]);

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
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: identifier.trim(),
          sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
        }),
      });

      const data = await response.json();
      setResult(data);
      
      if (data.success) {
        setIdentifier('');
        if (data.data) setPopup(data.data as CheckInData);
      }
    } catch (error) {
      setResult({
        success: false,
        message: '網路錯誤，請檢查連線後再試',
      });
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
                {result.success && result.data && (
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

      {popup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closePopup}
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkin-popup-title"
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
              <p id="checkin-popup-title" className="mt-2 text-lg font-semibold text-green-700">
                簽到成功
              </p>
              <p className="mt-1 text-3xl font-bold text-gray-900">{popup.姓名}</p>
            </div>

            <dl className="mt-5 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">序號</dt>
                <dd className="font-medium text-gray-900">{popup.序號 || '—'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">報到時間</dt>
                <dd className="font-medium text-gray-900">{popup.到達時間}</dd>
              </div>
              {popup.詳細欄位
                ?.filter((f) => f.值.trim() !== '')
                .map((f) => (
                  <div key={f.標題} className="flex justify-between gap-4">
                    <dt className="shrink-0 text-gray-500">{f.標題}</dt>
                    <dd className="text-right font-medium text-gray-900">{f.值}</dd>
                  </div>
                ))}
            </dl>

            <Button className="mt-5 h-12 w-full text-lg" onClick={closePopup} autoFocus>
              確定
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
