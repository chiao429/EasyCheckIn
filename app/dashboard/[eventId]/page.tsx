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

  const recentCheckins = attendees
    .filter((a) => a.已到 === 'TRUE')
    .sort((a, b) => (a.到達時間 < b.到達時間 ? 1 : -1))
    .slice(0, 8);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">出席狀況儀表板</h1>
            <p className="text-sm text-slate-600 mt-1">
              適合投影或主持人使用的即時出席概況畫面
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="border-slate-300 text-slate-700 hover:bg-slate-100"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>
            <p className="text-[11px] text-slate-500">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="cursor-default">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">總人數</CardTitle>
              <Users className="h-4 w-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">{total}</div>
            </CardContent>
          </Card>

          <Card
            className={`border-emerald-200 bg-emerald-50/60 cursor-pointer transition-shadow hover:shadow-md ${
              listMode === 'checked' ? 'ring-2 ring-emerald-300' : ''
            }`}
            onClick={() => setListMode('checked')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-emerald-700">已簽到</CardTitle>
              <UserCheck className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-700">{checked}</div>
              <p className="text-xs text-emerald-700/80 mt-1">
                有效人數（不含不會來）中的出席率：{rate.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card
            className={`border-amber-200 bg-amber-50/60 cursor-pointer transition-shadow hover:shadow-md ${
              listMode === 'cancelled' ? 'ring-2 ring-amber-300' : ''
            }`}
            onClick={() => setListMode('cancelled')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-amber-700">不會來</CardTitle>
              <Ban className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-700">{cancelled}</div>
              <p className="text-xs text-amber-700/80 mt-1">
                已由工作人員標記為不會出席的人數
              </p>
            </CardContent>
          </Card>

          <Card
            className={`border-red-200 bg-red-50/60 cursor-pointer transition-shadow hover:shadow-md ${
              listMode === 'unchecked' ? 'ring-2 ring-red-300' : ''
            }`}
            onClick={() => setListMode('unchecked')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-red-700">尚未簽到</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-700">{unchecked}</div>
              <p className="text-xs text-red-700/80 mt-1">
                仍在等待簽到的人數（包含可能不會來、尚未標記者）
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 出席率視覺化 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-800">
              出席率概況
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>0%</span>
              <span>{rate.toFixed(1)}%</span>
              <span>100%</span>
            </div>
            <div className="w-full h-4 rounded-full bg-slate-200 overflow-hidden">
              <div
                className="h-4 bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all"
                style={{ width: `${Math.min(100, rate)}%` }}
              />
            </div>
            <p className="text-xs text-slate-600">
              以「有效人數 = 總人數 - 不會來」計算，目前出席率為{' '}
              <span className="text-emerald-700 font-medium">{rate.toFixed(1)}%</span>。
            </p>
          </CardContent>
        </Card>

        {/* 出席明細 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-800">出席明細</CardTitle>
            <p className="text-xs text-slate-500">
              目前顯示：
              {listMode === 'checked' && '已簽到全名單'}
              {listMode === 'cancelled' && '不會來全名單'}
              {listMode === 'unchecked' && '尚未簽到全名單'}
            </p>
          </CardHeader>
          <CardContent>
            {detailList.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                目前尚無符合條件的紀錄
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
                {detailList.map((a, idx) => (
                  <div
                    key={`${a.序號}-${a.姓名}-${idx}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        <span className="mr-2 text-slate-500">{a.序號}</span>
                        {a.姓名}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {a.到達時間 || '-'}
                      </p>
                    </div>
                    {a.已到 === 'TRUE' && (
                      <span className="text-[11px] text-emerald-700">已簽到</span>
                    )}
                    {a.已到 === 'CANCELLED' && (
                      <span className="text-[11px] text-amber-700">不會來</span>
                    )}
                    {a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && (
                      <span className="text-[11px] text-slate-500">未簽到</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 最近簽到名單 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-slate-800">
              最近簽到名單
            </CardTitle>
            <p className="text-xs text-slate-500">顯示最近 8 筆簽到紀錄</p>
          </CardHeader>
          <CardContent>
            {recentCheckins.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-4">
                目前尚無簽到紀錄
              </p>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
                {recentCheckins.map((a, idx) => (
                  <div
                    key={`${a.序號}-${a.姓名}-${idx}`}
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        <span className="mr-2 text-slate-500">{a.序號}</span>
                        {a.姓名}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {a.到達時間}
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-700">已簽到</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
