'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import { Search, UserCheck, UserX, Ban } from 'lucide-react';

interface KidsDetailField {
  標題: string;
  值: string;
}

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
  詳細欄位?: KidsDetailField[];
  rowIndex?: number;
}

export default function KidsManagerPage() {
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
  const [showDetails, setShowDetails] = useState(false);

  const effectiveSheetId = sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem('easycheck_kids_manager_staff_name');
    if (saved) {
      setStaffName(saved);
    }
  }, []);

  const handleStaffNameChange = (value: string) => {
    setStaffName(value);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('easycheck_kids_manager_staff_name', value);
    }
  };

  const getSquadLabel = (attendee: Attendee | null) => {
    if (!attendee || !attendee.詳細欄位 || attendee.詳細欄位.length === 0) return null;
    const first = attendee.詳細欄位[0];
    if (!first || (!first.標題 && !first.值)) return null;
    return (
      <p className="text-sm text-slate-800 mt-2 font-semibold">
        {first.標題 || '所屬小隊'}：
        <span className="ml-1 text-red-600 text-base font-bold">
          {first.值 || '未填寫'}
        </span>
      </p>
    );
  };

  const handleManagerCheckIn = async () => {
    if (!selected || !effectiveSheetId) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/kids/checkin', {
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
          rowIndex: selected.rowIndex,
        }),
      });
      const data = await response.json();
      if (data.success) {
        setMessage('✅ 已由工作人員代為報到（兒童）');
        await refreshSelected(selected.序號 || selected.姓名);
      } else {
        setMessage(`❌ 報到失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Kids manager check-in error:', error);
      setMessage('❌ 代為報到時發生錯誤');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelCheckIn = async () => {
    if (!selected || !effectiveSheetId) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/kids/manager/cancel-checkin', {
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
        setMessage('✅ 已取消報到，狀態恢復為未報到（兒童）');
        await refreshSelected(selected.序號 || selected.姓名);
      } else {
        setMessage('❌ 取消報到失敗：操作人數過多，請稍等10秒後再重試');
      }
    } catch (error) {
      console.error('Kids manager cancel check-in error:', error);
      setMessage('❌ 取消報到時發生錯誤');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkCancelled = async () => {
    if (!selected || !effectiveSheetId) return;
    setActionLoading(true);
    setMessage(null);

    try {
      const response = await fetch('/api/kids/manager/mark-cancelled', {
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
        setMessage('✅ 已標記為不會出席（兒童）');
        await refreshSelected(selected.序號 || selected.姓名);
      } else {
        setMessage(`❌ 標記失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Kids manager mark cancelled error:', error);
      setMessage('❌ 標記不會出席時發生錯誤');
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
        `/api/kids/search?sheetId=${encodeURIComponent(effectiveSheetId)}&query=${encodeURIComponent(
          keyword.trim()
        )}&eventId=${encodeURIComponent(eventId)}`
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
      console.error('Kids manager search error:', error);
      setMessage('搜尋過程發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  const refreshSelected = async (identifier: string) => {
    if (!effectiveSheetId) return;
    try {
      const response = await fetch(
        `/api/kids/search?sheetId=${encodeURIComponent(effectiveSheetId)}&query=${encodeURIComponent(
          identifier
        )}&eventId=${encodeURIComponent(eventId)}`
      );
      const data = await response.json();
      if (data.success && data.data && data.data.length > 0) {
        setSelected(data.data[0]);
        setShowDetails(false);
      }
    } catch (error) {
      console.error('Kids manager refresh selected error:', error);
    }
  };

  const getStatusLabel = (attendee: Attendee | null) => {
    if (!attendee) return null;
    if (attendee.已到 === 'TRUE') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UserCheck className="w-3 h-3 mr-1" /> 已報到
        </span>
      );
    }
    if (attendee.已到 === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Ban className="w-3 h-3 mr-1" /> 不會出席
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
        <UserX className="w-3 h-3 mr-1" /> 未報到
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex flex-col">
      <div className="max-w-2xl mx-auto space-y-6 flex-1">
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle className="text-2xl">兒童 Manager（現場工作人員工具）</CardTitle>
            <CardDescription>
              給現場工作人員使用的兒童報到介面，用來協助快速查詢與報到。
              <br />
              <span className="text-amber-600 font-medium">第一次查詢會比較久，請稍等。</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">工作人員名稱</label>
              <Input
                placeholder="例如：兒童組 A、小華..."
                value={staffName}
                onChange={(e) => handleStaffNameChange(e.target.value)}
                className="max-w-xs"
              />
            </div>
            {!staffName.trim() && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                請先輸入工作人員名稱，之後即可使用下方的搜尋與代為報到功能。名稱會保存在這台裝置的瀏覽器中，下次開啟會自動帶入。
              </p>
            )}

            {staffName.trim() && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">搜尋序號或兒童姓名</label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="請輸入報名序號或姓名"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button onClick={handleSearch} disabled={loading}>
                      <Search className="w-4 h-4 mr-1" />
                      {loading ? '搜尋中...' : '搜尋'}
                    </Button>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5 pl-1">
                    <p>• 序號請輸入完整序號</p>
                    <p>• 姓名支援輸入關鍵字查詢</p>
                  </div>
                </div>

                {staffName.trim() && selected && (
                  <div className="mt-4 p-4 rounded-md border bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          序號：{selected.序號}｜兒童姓名：{selected.姓名}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          報到時間：{selected.到達時間 || '尚未報到'}
                        </p>
                        {getSquadLabel(selected)}
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
                          報到（兒童）
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
                          取消報到（允許重報）
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
                          標記為不會出席
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
                          恢復為未報到
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-300 text-slate-700 hover:bg-slate-100"
                        onClick={() => setShowDetails((prev) => !prev)}
                      >
                        {showDetails ? '隱藏詳細資訊' : '顯示詳細資訊'}
                      </Button>
                    </div>

                    {showDetails && selected.詳細欄位 && selected.詳細欄位.length > 0 && (
                      <div className="mt-3 pt-3 border-t text-xs text-slate-700 space-y-1">
                        {selected.詳細欄位.map((field, idx) => {
                          const hasValue = field.值 && field.值.trim().length > 0;
                          const hasTitle = field.標題 && field.標題.trim().length > 0;
                          if (!hasTitle && !hasValue) return null;
                          return (
                            <p key={idx} className="flex justify-between gap-2">
                              <span className="font-medium text-slate-600">
                                {field.標題 || `欄位 ${idx + 1}`}：
                              </span>
                              <span className="text-slate-800 break-all">{field.值 || '-'}</span>
                            </p>
                          );
                        })}
                      </div>
                    )}
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
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 flex items-center justify-between ${
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
      <SiteFooter />
    </div>
  );
}
