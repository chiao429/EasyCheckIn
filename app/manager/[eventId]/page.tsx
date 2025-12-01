'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, UserCheck, UserX, Ban } from 'lucide-react';

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
}

export default function ManagerPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetFromQuery = searchParams.get('sheet');

  const [keyword, setKeyword] = useState('');
  const [staffName, setStaffName] = useState('');
  const [results, setResults] = useState<Attendee[]>([]);
  const [selected, setSelected] = useState<Attendee | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const effectiveSheetId = sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('easycheck_manager_staff_name');
    if (saved) {
      setStaffName(saved);
    }
  }, []);

  const handleStaffNameChange = (value: string) => {
    setStaffName(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('easycheck_manager_staff_name', value);
    }
  };

  const handleManagerCheckIn = async () => {
    if (!selected || !effectiveSheetId) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier: selected.序號 || selected.姓名,
          source: 'manager',
          eventId,
          attendeeName: selected.姓名,
          operator: staffName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ 已由工作人員代為簽到');
        await refreshSelected(selected.序號 || selected.姓名);
      } else {
        setMessage(`❌ 簽到失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Manager check-in error:', error);
      setMessage('❌ 代為簽到時發生錯誤');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setMessage('請先輸入序號或姓名再搜尋');
      return;
    }
    if (!effectiveSheetId) {
      setMessage('缺少 sheetId，請確認網址有帶 ?sheet= 參數');
      return;
    }

    setLoading(true);
    setMessage(null);
    setSelected(null);

    try {
      const response = await fetch(
        `/api/search?sheetId=${encodeURIComponent(effectiveSheetId)}&query=${encodeURIComponent(
          keyword.trim()
        )}`
      );
      const data = await response.json();

      if (data.success) {
        setResults(data.data || []);
        if (data.data && data.data.length === 1) {
          setSelected(data.data[0]);
        }
        if (!data.data || data.data.length === 0) {
          setMessage('找不到符合的資料，請確認序號或姓名');
        }
      } else {
        setMessage(data.message || '搜尋失敗');
      }
    } catch (error) {
      console.error('Manager search error:', error);
      setMessage('搜尋過程發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const refreshSelected = async (identifier: string) => {
    if (!effectiveSheetId) return;
    try {
      const response = await fetch(
        `/api/search?sheetId=${encodeURIComponent(effectiveSheetId)}&query=${encodeURIComponent(
          identifier
        )}`
      );
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        setSelected(data.data[0]);
      }
    } catch (error) {
      console.error('Manager refresh selected error:', error);
    }
  };

  const handleCancelCheckIn = async () => {
    if (!selected || !effectiveSheetId) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/manager/cancel-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier: selected.序號 || selected.姓名,
          eventId,
          attendeeName: selected.姓名,
          operator: staffName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ 已取消簽到，可請對方重新簽到');
        await refreshSelected(selected.序號 || selected.姓名);
      } else {
        setMessage(`❌ 取消簽到失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Manager cancel check-in error:', error);
      setMessage('❌ 取消簽到時發生錯誤');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkCancelled = async () => {
    if (!selected || !effectiveSheetId) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/manager/mark-cancelled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier: selected.序號 || selected.姓名,
          eventId,
          attendeeName: selected.姓名,
          operator: staffName,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ 已標記為不會來');
        await refreshSelected(selected.序號 || selected.姓名);
      } else {
        setMessage(`❌ 標記失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Manager mark cancelled error:', error);
      setMessage('❌ 標記不會來時發生錯誤');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusLabel = (attendee: Attendee | null) => {
    if (!attendee) return null;
    if (attendee.已到 === 'TRUE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UserCheck className="w-3 h-3 mr-1" /> 已簽到
        </span>
      );
    }
    if (attendee.已到 === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Ban className="w-3 h-3 mr-1" /> 不會來
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
        <UserX className="w-3 h-3 mr-1" /> 未簽到
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">Manager（現場工作人員工具）</CardTitle>
            <CardDescription>
              給現場工作人員使用的簡易控管介面，用來協助查詢與調整簽到狀態。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">工作人員名稱（僅儲存在本機瀏覽器）</label>
              <Input
                placeholder="例如：前台 A、小明..."
                value={staffName}
                onChange={(e) => handleStaffNameChange(e.target.value)}
                className="max-w-xs"
              />
            </div>
            {!staffName.trim() && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                請先輸入工作人員名稱，之後即可使用下方的搜尋與調整功能。名稱會保存在這台裝置的瀏覽器中，下次開啟會自動帶入。
              </p>
            )}

            {staffName.trim() && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">搜尋序號或姓名</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="輸入序號或姓名，如：001 或 王小明"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={loading}>
                      <Search className="w-4 h-4 mr-1" />
                      {loading ? '搜尋中...' : '搜尋'}
                    </Button>
                  </div>
                </div>

            {staffName.trim() && selected && (
              <div className="mt-4 p-4 rounded-md border bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      序號：{selected.序號}｜姓名：{selected.姓名}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      簽到時間：{selected.到達時間 || '尚未簽到'}
                    </p>
                  </div>
                  {getStatusLabel(selected)}
                </div>

                <div className="flex flex-wrap gap-2 pt-2 border-t mt-2">
                  {selected.已到 !== 'TRUE' && selected.已到 !== 'CANCELLED' && (
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={handleManagerCheckIn}
                      disabled={actionLoading}
                    >
                      代為簽到
                    </Button>
                  )}

                  {selected.已到 === 'TRUE' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 text-slate-700 hover:bg-slate-100"
                      onClick={handleCancelCheckIn}
                      disabled={actionLoading}
                    >
                      取消簽到（允許重簽）
                    </Button>
                  )}

                  {selected.已到 !== 'TRUE' && selected.已到 !== 'CANCELLED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={handleMarkCancelled}
                      disabled={actionLoading}
                    >
                      標記為不會來
                    </Button>
                  )}

                  {selected.已到 === 'CANCELLED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-300 text-slate-700 hover:bg-slate-100"
                      onClick={handleCancelCheckIn}
                      disabled={actionLoading}
                    >
                      恢復為未簽到
                    </Button>
                  )}
                </div>
              </div>
            )}

            {staffName.trim() && results.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-slate-600">找到多筆結果，請選擇其中一筆：</p>
                <div className="border rounded-md divide-y bg-white">
                  {results.map((attendee, index) => (
                    <button
                      key={`${attendee.序號}-${index}`}
                      type="button"
                      className={`w-full text左 px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
                        selected &&
                        selected.序號 === attendee.序號 &&
                        selected.姓名 === attendee.姓名
                          ? 'bg-slate-100'
                          : ''
                      }`}
                      onClick={() => setSelected(attendee)}
                    >
                      <span>
                        <span className="font-medium mr-2">{attendee.序號}</span>
                        <span>{attendee.姓名}</span>
                      </span>
                      {getStatusLabel(attendee)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {message && staffName.trim() && (
              <p className="text-xs text-slate-700 whitespace-pre-line mt-2">{message}</p>
            )}
            </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
