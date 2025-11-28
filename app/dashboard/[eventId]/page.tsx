'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, UserCheck, UserX, Ban, RefreshCw } from 'lucide-react';

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
}

export default function DashboardPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetFromQuery = searchParams.get('sheet');

  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listMode, setListMode] = useState<'checked' | 'cancelled' | 'unchecked'>(
    'checked'
  );
  const [showDetails, setShowDetails] = useState(false);

  const effectiveSheetId = sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId;

  const fetchData = async () => {
    if (!effectiveSheetId) {
      setError('缺少 sheetId，請確認網址有帶 ?sheet= 參數');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/attendees?sheetId=${encodeURIComponent(effectiveSheetId)}&filter=all`
      );
      const data = await response.json();

      if (data.success) {
        setAttendees(data.data || []);
        setLastUpdated(new Date().toLocaleTimeString('zh-TW', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }));
      } else {
        setError(data.message || '載入資料失敗');
      }
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError('載入資料時發生錯誤，請稍後再試');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSheetId]);

  const total = attendees.length;
  const checked = attendees.filter((a) => a.已到 === 'TRUE').length;
  const cancelled = attendees.filter((a) => a.已到 === 'CANCELLED').length;
  const unchecked = total - checked - cancelled;
  const effectiveTotalForRate = total - cancelled;
  const rate = effectiveTotalForRate > 0 ? (checked / effectiveTotalForRate) * 100 : 0;

  const checkedList = attendees.filter((a) => a.已到 === 'TRUE');
  const cancelledList = attendees.filter((a) => a.已到 === 'CANCELLED');
  const uncheckedList = attendees.filter((a) => a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED');

  const getDetailList = () => {
    switch (listMode) {
      case 'checked':
        return checkedList;
      case 'cancelled':
        return cancelledList;
      case 'unchecked':
      default:
        return uncheckedList;
    }
  };

  const detailList = getDetailList();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-100">出席狀況儀表板</h1>
            <p className="text-sm text-slate-300 mt-1">即時出席概況畫面</p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={fetchData}
                disabled={loading}
                className="border-slate-600 text-slate-200 bg-slate-800 hover:bg-slate-700"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                重新整理
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails((prev) => !prev)}
                className={`border-slate-600 text-xs font-medium rounded-full px-3 py-1.5 transition-all
                  ${showDetails
                    ? 'bg-emerald-500 text-slate-900 hover:bg-emerald-400 shadow-md'
                    : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
              >
                <span className="mr-2">名單區塊</span>
                <span
                  className={`inline-flex items-center w-10 h-5 rounded-full px-0.5 text-[10px] font-semibold transition-all
                    ${showDetails ? 'bg-emerald-900 text-emerald-300 justify-end' : 'bg-slate-500 text-slate-100 justify-start'}`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow" />
                </span>
              </Button>
            </div>
            <p className="text-[11px] text-slate-400">
              最後更新時間：{lastUpdated || '尚未載入'}
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-default bg-slate-700 border-slate-600">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base md:text-lg font-medium text-white">應出席人數</CardTitle>
              <Users className="h-4 w-4 text-slate-300" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl md:text-6xl font-extrabold text-slate-100 text-right leading-tight">
                {effectiveTotalForRate}
              </div>
              <p className="text-xs text-slate-300 mt-1">應出席的人數（不含不會來）</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-emerald-600 cursor-pointer transition-all hover:shadow-md ${
              showDetails && listMode === 'checked'
                ? 'ring-4 ring-emerald-300 ring-offset-2 ring-offset-slate-900 shadow-xl scale-[1.05] -translate-y-1'
                : 'shadow-sm'
            }`}
            onClick={() => {
              if (!showDetails) return;
              setListMode('checked');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base md:text-lg font-medium text-white">實到人數</CardTitle>
              <UserCheck className="h-4 w-4 text-emerald-200" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl md:text-6xl font-extrabold text-emerald-100 text-right leading-tight">
                {checked}
              </div>
              <p className="text-xs text-emerald-200 mt-1">目前實到（已簽到）的人數</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-red-600 cursor-pointer transition-all hover:shadow-md ${
              showDetails && listMode === 'unchecked'
                ? 'ring-4 ring-red-300 ring-offset-2 ring-offset-slate-900 shadow-xl scale-[1.05] -translate-y-1'
                : 'shadow-sm'
            }`}
            onClick={() => {
              if (!showDetails) return;
              setListMode('unchecked');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base md:text-lg font-medium text-white">尚未簽到人數</CardTitle>
              <UserX className="h-4 w-4 text-red-200" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl md:text-6xl font-extrabold text-red-100 text-right leading-tight">
                {unchecked}
              </div>
              <p className="text-xs text-red-200 mt-1">未簽到的人數</p>
            </CardContent>
          </Card>

          <Card
            className={`bg-amber-600 cursor-pointer transition-all hover:shadow-md ${
              showDetails && listMode === 'cancelled'
                ? 'ring-4 ring-amber-300 ring-offset-2 ring-offset-slate-900 shadow-xl scale-[1.05] -translate-y-1'
                : 'shadow-sm'
            }`}
            onClick={() => {
              if (!showDetails) return;
              setListMode('cancelled');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base md:text-lg font-medium text-white">不會出席人數</CardTitle>
              <Ban className="h-4 w-4 text-amber-200" />
            </CardHeader>
            <CardContent>
              <div className="text-5xl md:text-6xl font-extrabold text-amber-100 text-right leading-tight">
                {cancelled}
              </div>
              <p className="text-xs text-amber-200 mt-1">不會出席的人數</p>
            </CardContent>
          </Card>
        </div>

        {/* 名單區塊：依上方 panel 切換顯示 */}
        {showDetails && (
          <Card
            className={`cursor-default transition-shadow hover:shadow-md 
              ${listMode === 'checked' && 'border-emerald-700 bg-emerald-950/60'}
              ${listMode === 'unchecked' && 'border-red-700 bg-red-950/60'}
              ${listMode === 'cancelled' && 'border-amber-700 bg-amber-950/60'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-base md:text-lg font-semibold 
                  ${listMode === 'checked' && 'text-emerald-200'}
                  ${listMode === 'unchecked' && 'text-red-200'}
                  ${listMode === 'cancelled' && 'text-amber-200'}`}
              >
                {listMode === 'checked' && '已簽到名單'}
                {listMode === 'unchecked' && '尚未簽到名單'}
                {listMode === 'cancelled' && '不會出席名單'}
              </CardTitle>
              <p
                className={`text-xs 
                  ${listMode === 'checked' && 'text-emerald-300'}
                  ${listMode === 'unchecked' && 'text-red-300'}
                  ${listMode === 'cancelled' && 'text-amber-300'}`}
              >
                {listMode === 'checked' && '顯示所有目前已經完成簽到的參加者'}
                {listMode === 'unchecked' && '顯示所有目前尚未完成簽到的參加者'}
                {listMode === 'cancelled' && '顯示所有已標記為不會出席的參加者'}
              </p>
            </CardHeader>
          <CardContent>
            {detailList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                目前尚無符合條件的紀錄
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto space-y-2">
                {detailList.map((a, idx) => (
                  <div
                    key={`${a.序號}-${a.姓名}-${idx}`}
                    className="flex items-center justify-between py-2 px-3 text-sm bg-slate-800 rounded-md border border-slate-700"
                  >
                    <div>
                      <p className="font-medium text-slate-100">
                        <span className="mr-2 text-slate-400">{a.序號}</span>
                        {a.姓名}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {a.到達時間 || '-'}
                      </p>
                    </div>
                    {listMode === 'checked' && (
                      <span className="text-[11px] text-emerald-300">已簽到</span>
                    )}
                    {listMode === 'unchecked' && (
                      <span className="text-[11px] text-slate-400">未簽到</span>
                    )}
                    {listMode === 'cancelled' && (
                      <span className="text-[11px] text-amber-300">不會出席</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* 出席 / 尚未簽到 / 不會出席 概況（三個圓餅圖） */}
        <Card className="bg-slate-900/60 border border-slate-700 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              出席與未出席概況
            </CardTitle>
            <p className="text-xs text-slate-400">用圓餅圖快速掌握目前出席、尚未簽到與不會出席的比例</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 出席率 */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-full max-w-[190px] rounded-2xl bg-slate-800/60 border border-slate-700 p-4 shadow-inner">
                  <div className="relative w-full aspect-square">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        backgroundImage:
                          rate > 0
                            ? `conic-gradient(#22c55e 0deg ${Math.min(
                                100,
                                rate
                              )}%, #e5e7eb ${Math.min(100, rate)}% 100%)`
                            : 'conic-gradient(#e5e7eb 0deg 100%)',
                      }}
                    />
                    <div className="absolute inset-5 rounded-full bg-slate-900 flex flex-col items-center justify-center border border-slate-700">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">出席率</span>
                      <span className="text-xl font-semibold text-white">
                        {rate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300 text-center">目前已簽到</p>
                </div>
              </div>

              {/* 尚未簽到率 */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-full max-w-[190px] rounded-2xl bg-slate-800/60 border border-slate-700 p-4 shadow-inner">
                  <div className="relative w-full aspect-square">
                    {(() => {
                      const safeTotal = effectiveTotalForRate > 0 ? effectiveTotalForRate : 1;
                      const uncheckedRate = Math.max(
                        0,
                        Math.min(100, (unchecked / safeTotal) * 100)
                      );
                      const hasData = uncheckedRate > 0;
                      return (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundImage: hasData
                              ? `conic-gradient(#ef4444 0deg ${uncheckedRate}%, #e5e7eb ${uncheckedRate}% 100%)`
                              : 'conic-gradient(#e5e7eb 0deg 100%)',
                          }}
                        />
                      );
                    })()}
                    <div className="absolute inset-5 rounded-full bg-slate-900 flex flex-col items-center justify-center border border-slate-700">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">尚未簽到率</span>
                      <span className="text-xl font-semibold text-white">
                        {effectiveTotalForRate > 0
                          ? ((unchecked / effectiveTotalForRate) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300 text-center">仍需到場</p>
                </div>
              </div>

              {/* 不會出席率 */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-full max-w-[190px] rounded-2xl bg-slate-800/60 border border-slate-700 p-4 shadow-inner">
                  <div className="relative w-full aspect-square">
                    {(() => {
                      const safeTotal = effectiveTotalForRate > 0 ? effectiveTotalForRate : 1;
                      const cancelledRate = Math.max(
                        0,
                        Math.min(100, (cancelled / safeTotal) * 100)
                      );
                      const hasData = cancelledRate > 0;
                      return (
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            backgroundImage: hasData
                              ? `conic-gradient(#f97316 0deg ${cancelledRate}%, #e5e7eb ${cancelledRate}% 100%)`
                              : 'conic-gradient(#e5e7eb 0deg 100%)',
                          }}
                        />
                      );
                    })()}
                    <div className="absolute inset-5 rounded-full bg-slate-900 flex flex-col items-center justify-center border border-slate-700">
                      <span className="text-[11px] uppercase tracking-wide text-slate-400">不會出席率</span>
                      <span className="text-xl font-semibold text-white">
                        {effectiveTotalForRate > 0
                          ? ((cancelled / effectiveTotalForRate) * 100).toFixed(1)
                          : '0.0'}
                        %
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-300 text-center">已回報不會來</p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-200">
              <p className="leading-relaxed">
                目前出席率為{' '}
                <span className="text-emerald-300 font-semibold">{rate.toFixed(1)}%</span>，
                尚未簽到約{' '}
                <span className="text-slate-200 font-semibold">
                  {effectiveTotalForRate > 0
                    ? ((unchecked / effectiveTotalForRate) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
                ，不會出席約{' '}
                <span className="text-amber-300 font-semibold">
                  {effectiveTotalForRate > 0
                    ? ((cancelled / effectiveTotalForRate) * 100).toFixed(1)
                    : '0.0'}
                  %
                </span>
                。
              </p>
              <div className="flex flex-wrap items-center gap-4 text-[13px]">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-400" />
                  <span>已簽到（實到人數）：{checked}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-slate-400" />
                  <span>尚未簽到人數：{unchecked}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-300" />
                  <span>不會出席人數：{cancelled}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
