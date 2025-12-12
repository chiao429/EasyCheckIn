'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { SiteFooter } from '@/components/SiteFooter';
import { Users, UserCheck, UserX, Ban, RefreshCw, ArrowUp } from 'lucide-react';

interface DetailField {
  標題: string;
  值: string;
}

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
  聯絡組?: string;
  詳細欄位?: DetailField[];
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
  // 初始值固定為 'checked'，避免伺服器與瀏覽器第一次 render 不一致
  const [listMode, setListMode] = useState<'all' | 'checked' | 'cancelled' | 'unchecked'>(
    'checked'
  );
  // 初始值固定為 true，實際狀態會在掛載後透過 useEffect 從 localStorage 還原
  const [showDetails, setShowDetails] = useState(true);
  // 控制是否已完成 client 端還原，避免先看到預設 UI 再跳到還原狀態
  const [hydrated, setHydrated] = useState(false);
  // 名單區塊模糊查詢關鍵字（依姓名）
  const [searchQuery, setSearchQuery] = useState('');
  // 組別篩選
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  // 每頁顯示筆數
  const [pageSize, setPageSize] = useState<number>(5);
  const [currentPage, setCurrentPage] = useState(1);
  const [hideLateInUnchecked, setHideLateInUnchecked] = useState(false);
  // 控制「回到頂部」按鈕的顯示
  const [showScrollTop, setShowScrollTop] = useState(false);
  // 追蹤展開詳細資料的項目（使用序號+姓名作為唯一識別）
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);

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

  // 掛載後從 localStorage 還原 listMode 與 showDetails
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      // 還原 listMode
      const listKey = `dashboard_list_mode_${eventId}`;
      const storedMode = window.localStorage.getItem(listKey) as
        | 'all'
        | 'checked'
        | 'cancelled'
        | 'unchecked'
        | null;
      if (storedMode === 'all' || storedMode === 'checked' || storedMode === 'cancelled' || storedMode === 'unchecked') {
        setListMode(storedMode);
      }

      // 還原 showDetails
      const detailsKey = `dashboard_show_details_${eventId}`;
      const storedDetails = window.localStorage.getItem(detailsKey);
      if (storedDetails === 'true') {
        setShowDetails(true);
      } else if (storedDetails === 'false') {
        setShowDetails(false);
      }

      // 還原 pageSize
      const pageSizeKey = `dashboard_page_size_${eventId}`;
      const storedPageSize = window.localStorage.getItem(pageSizeKey);
      if (storedPageSize !== null) {
        const parsed = Number(storedPageSize);
        if (!Number.isNaN(parsed)) {
          setPageSize(parsed);
        }
      }
    } catch {
      // 讀取失敗時保持預設值
    }

    // 標記已完成還原，可以安全顯示 UI
    setHydrated(true);
  }, [eventId]);

  // 根據網址中的 sheetId 重新載入資料
  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSheetId]);

  // 監聽滾動事件，控制「回到頂部」按鈕的顯示
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 將名單區塊展開 / 收合狀態存到瀏覽器
  useEffect(() => {
    if (!hydrated) return; // 還沒還原前不要覆蓋 localStorage
    try {
      if (typeof window !== 'undefined') {
        const storageKey = `dashboard_show_details_${eventId}`;
        window.localStorage.setItem(storageKey, showDetails ? 'true' : 'false');
      }
    } catch (e) {
      // 忽略 localStorage 寫入失敗
    }
  }, [showDetails, eventId, hydrated]);

  // 將目前選擇的名單模式 (listMode) 存到瀏覽器，讓下次載入時沿用
  useEffect(() => {
    if (!hydrated) return; // 還沒還原前不要覆蓋 localStorage
    try {
      if (typeof window !== 'undefined') {
        const storageKey = `dashboard_list_mode_${eventId}`;
        window.localStorage.setItem(storageKey, listMode);
      }
    } catch (e) {
      // 忽略 localStorage 寫入失敗
    }
  }, [listMode, eventId, hydrated]);

  // 將每頁顯示筆數 (pageSize) 存到瀏覽器，讓下次載入時沿用
  useEffect(() => {
    if (!hydrated) return; // 還沒還原前不要覆蓋 localStorage
    try {
      if (typeof window !== 'undefined') {
        const storageKey = `dashboard_page_size_${eventId}`;
        window.localStorage.setItem(storageKey, String(pageSize));
      }
    } catch (e) {
      // 忽略 localStorage 寫入失敗
    }
  }, [pageSize, eventId, hydrated]);

  const total = attendees.length;
  const checked = attendees.filter((a) => a.已到 === 'TRUE').length;
  const cancelled = attendees.filter((a) => a.已到 === 'CANCELLED').length;
  const lateCount = attendees.filter((a) => a.已到 === '晚到').length;
  const unchecked = total - checked - cancelled;
  const effectiveTotalForRate = total - cancelled;
  const rate = effectiveTotalForRate > 0 ? (checked / effectiveTotalForRate) * 100 : 0;

  // 計算聯絡組比例（包含已出席和未出席）
  const contactGroupStatsChecked = attendees
    .filter((a) => a.已到 === 'TRUE') // 已簽到的人
    .reduce((acc, attendee) => {
      const group = (attendee.聯絡組 && attendee.聯絡組.trim()) || '未分組';
      if (!acc[group]) {
        acc[group] = 0;
      }
      acc[group]++;
      return acc;
    }, {} as Record<string, number>);

  const contactGroupStatsLate = attendees
    .filter((a) => a.已到 === '晚到')
    .reduce((acc, attendee) => {
      const group = (attendee.聯絡組 && attendee.聯絡組.trim()) || '未分組';
      if (!acc[group]) {
        acc[group] = 0;
      }
      acc[group]++;
      return acc;
    }, {} as Record<string, number>);

  const contactGroupStatsUnchecked = attendees
    .filter((a) => a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && a.已到 !== '晚到') // 未簽到的人（排除不會來）
    .reduce((acc, attendee) => {
      const group = (attendee.聯絡組 && attendee.聯絡組.trim()) || '未分組';
      if (!acc[group]) {
        acc[group] = 0;
      }
      acc[group]++;
      return acc;
    }, {} as Record<string, number>);

  // 除錯：檢查前幾筆資料的聯絡組欄位
  if (attendees.length > 0) {
    console.log('前3筆參加者資料:', attendees.slice(0, 3).map(a => ({
      姓名: a.姓名,
      聯絡組: a.聯絡組,
      聯絡組長度: a.聯絡組?.length
    })));
  }

  // 合併所有聯絡組（已簽到 + 未簽到）
  const allGroups = new Set([
    ...Object.keys(contactGroupStatsChecked),
    ...Object.keys(contactGroupStatsLate),
    ...Object.keys(contactGroupStatsUnchecked),
  ]);

  const contactGroupArray = Array.from(allGroups)
    .map((group) => {
      const checkedCount = contactGroupStatsChecked[group] || 0;
      const lateCount = contactGroupStatsLate[group] || 0;
      const uncheckedCount = contactGroupStatsUnchecked[group] || 0;
      const totalCount = checkedCount + lateCount + uncheckedCount;
      const percentage = totalCount > 0 ? (checkedCount / totalCount) * 100 : 0;
      return {
        group,
        checkedCount,
        lateCount,
        uncheckedCount,
        totalCount,
        percentage,
      };
    })
    .sort((a, b) => b.checkedCount - a.checkedCount);

  const checkedList = attendees.filter((a) => a.已到 === 'TRUE');
  const cancelledList = attendees.filter((a) => a.已到 === 'CANCELLED');
  const uncheckedList = attendees.filter((a) => a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED');

  const getDetailList = () => {
    switch (listMode) {
      case 'all':
        return attendees;
      case 'checked':
        return checkedList;
      case 'cancelled':
        return cancelledList;
      case 'unchecked':
      default:
        return uncheckedList;
    }
  };

  const rawDetailList = getDetailList();

  // 獲取所有可用的聯絡組列表（用於下拉選單）
  const availableGroups = Array.from(
    new Set(
      rawDetailList
        .map((a) => (a.聯絡組 && a.聯絡組.trim()) || '未分組')
        .filter(Boolean)
    )
  ).sort();

  // 依搜尋關鍵字和組別過濾名單
  let detailList = rawDetailList;

  // 尚未簽到名單：可選擇不顯示晚到
  if (listMode === 'unchecked' && hideLateInUnchecked) {
    detailList = detailList.filter((a) => a.已到 !== '晚到');
  }
  
  // 先依姓名搜尋過濾
  if (searchQuery.trim().length > 0) {
    detailList = detailList.filter((a) =>
      a.姓名.toLowerCase().includes(searchQuery.trim().toLowerCase())
    );
  }
  
  // 再依組別過濾
  if (selectedGroup !== 'all') {
    detailList = detailList.filter((a) => {
      const group = (a.聯絡組 && a.聯絡組.trim()) || '未分組';
      return group === selectedGroup;
    });
  }

  // 計算分頁（pageSize 為 0 表示全部顯示）
  const effectivePageSize = pageSize === 0 ? detailList.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(detailList.length / effectivePageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * effectivePageSize;
  const pagedList = detailList.slice(startIndex, startIndex + effectivePageSize);

  const handleChangeListMode = (mode: 'all' | 'checked' | 'cancelled' | 'unchecked') => {
    setListMode(mode);
    setCurrentPage(1);
  };

  const handleMarkLate = async (attendee: Attendee) => {
    const identifier = attendee.序號 || attendee.姓名;
    if (!identifier || !effectiveSheetId) return;

    const key = identifier;
    const prevStatus = attendee.已到;
    const action = prevStatus === '晚到' ? 'unset' : 'set';
    setRowActionLoading(key + '-late-' + action);
    const optimisticStatus = prevStatus === '晚到' ? '' : '晚到';
    setAttendees((prev) =>
      prev.map((a) => {
        const aIdentifier = a.序號 || a.姓名;
        if (aIdentifier === identifier) {
          return { ...a, 已到: optimisticStatus };
        }
        return a;
      })
    );
    try {
      const response = await fetch('/api/manager/mark-late', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier,
          eventId,
          attendeeName: attendee.姓名,
          operator: 'Dashboard',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || '標記晚到失敗');
      }
      if (typeof data.newStatus === 'string') {
        setAttendees((prev) =>
          prev.map((a) => {
            const aIdentifier = a.序號 || a.姓名;
            if (aIdentifier === identifier) {
              return { ...a, 已到: data.newStatus };
            }
            return a;
          })
        );
      }
      setLastUpdated(
        new Date().toLocaleTimeString('zh-TW', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } catch (error) {
      console.error('Dashboard mark-late error:', error);
      setAttendees((prev) =>
        prev.map((a) => {
          const aIdentifier = a.序號 || a.姓名;
          if (aIdentifier === identifier) {
            return { ...a, 已到: prevStatus };
          }
          return a;
        })
      );
      setError(error instanceof Error ? error.message : '標記晚到時發生錯誤');
    } finally {
      setRowActionLoading(null);
    }
  };

  // 在還沒完成 client 還原之前，不渲染內容，避免看到預設狀態閃一下
  if (!hydrated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-4 md:p-8 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-6 flex-1">
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
          <Card
            className={`bg-slate-700 border-slate-600 transition-all cursor-pointer hover:shadow-md ${
              showDetails && listMode === 'all'
                ? 'ring-4 ring-slate-200 ring-offset-2 ring-offset-slate-900 shadow-xl scale-[1.05] -translate-y-1'
                : 'shadow-sm'
            }`}
            onClick={() => {
              if (!showDetails) return;
              handleChangeListMode('all');
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex flex-col gap-1">
                <div className="text-xs text-slate-400">總人數：{total}</div>
                <CardTitle className="text-base md:text-lg font-medium text-white">應出席人數</CardTitle>
              </div>
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
              handleChangeListMode('checked');
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
              handleChangeListMode('unchecked');
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
              <p className="text-xs text-red-200 mt-1">
                未簽到 {Math.max(unchecked - lateCount, 0)} 人 / 晚到 {lateCount} 人
              </p>
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
              handleChangeListMode('cancelled');
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
            className={`cursor-default transition-shadow hover:shadow-md bg-slate-900/80 border border-slate-700
              ${listMode === 'checked' && 'border-emerald-700 bg-emerald-950/60'}
              ${listMode === 'unchecked' && 'border-red-700 bg-red-950/60'}
              ${listMode === 'cancelled' && 'border-amber-700 bg-amber-950/60'}`}
          >
            <CardHeader>
              <CardTitle
                className={`text-base md:text-lg font-semibold 
                  ${listMode === 'all' && 'text-slate-100'}
                  ${listMode === 'checked' && 'text-emerald-200'}
                  ${listMode === 'unchecked' && 'text-red-200'}
                  ${listMode === 'cancelled' && 'text-amber-200'}`}
              >
                {listMode === 'all' && '全部名單'}
                {listMode === 'checked' && '已簽到名單'}
                {listMode === 'unchecked' && '尚未簽到名單'}
                {listMode === 'cancelled' && '不會出席名單'}
              </CardTitle>
              <div className="mt-2 flex flex-col gap-3">
                <div className="flex flex-col md:flex-row w-full items-stretch md:items-center gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="輸入姓名關鍵字進行搜尋"
                    className="flex-1 md:w-72 rounded-md border border-slate-600 bg-slate-900 px-3 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedGroup('all');
                      setCurrentPage(1);
                    }}
                    disabled={searchQuery.trim().length === 0 && selectedGroup === 'all'}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors whitespace-nowrap
                      ${searchQuery.trim().length === 0 && selectedGroup === 'all'
                        ? 'border-slate-700 text-slate-500 bg-slate-800 cursor-not-allowed'
                        : 'border-slate-500 text-slate-100 bg-slate-800 hover:bg-slate-700'}`}
                  >
                    清除篩選
                  </button>
                </div>

                {listMode === 'unchecked' && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-200">
                    <input
                      type="checkbox"
                      checked={hideLateInUnchecked}
                      onChange={(e) => {
                        setHideLateInUnchecked(e.target.checked);
                        setCurrentPage(1);
                      }}
                      className="w-3 h-3 text-emerald-500 bg-slate-900 border-slate-600 focus:ring-emerald-500 focus:ring-2"
                    />
                    不顯示晚到
                  </label>
                )}
                
                {/* 聯絡組別 Radio Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-400 mr-1">聯絡組別：</span>
                  <label className="inline-flex items-center cursor-pointer">
                    <input
                      type="radio"
                      name="contactGroup"
                      value="all"
                      checked={selectedGroup === 'all'}
                      onChange={(e) => {
                        setSelectedGroup(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-3 h-3 text-emerald-500 bg-slate-900 border-slate-600 focus:ring-emerald-500 focus:ring-2"
                    />
                    <span className="ml-1.5 text-xs text-slate-200">全部</span>
                  </label>
                  {availableGroups.map((group) => (
                    <label key={group} className="inline-flex items-center cursor-pointer">
                      <input
                        type="radio"
                        name="contactGroup"
                        value={group}
                        checked={selectedGroup === group}
                        onChange={(e) => {
                          setSelectedGroup(e.target.value);
                          setCurrentPage(1);
                        }}
                        className="w-3 h-3 text-emerald-500 bg-slate-900 border-slate-600 focus:ring-emerald-500 focus:ring-2"
                      />
                      <span className="ml-1.5 text-xs text-slate-200">{group}</span>
                    </label>
                  ))}
                </div>
              <p
                className={`text-xs 
                  ${listMode === 'all' && 'text-slate-100'}
                  ${listMode === 'checked' && 'text-emerald-300'}
                  ${listMode === 'unchecked' && 'text-red-300'}
                  ${listMode === 'cancelled' && 'text-amber-300'}`}
              >
                {listMode === 'all' && '顯示所有應出席的參加者（包含已簽到、未簽到與不會出席標記）'}
                {listMode === 'checked' && '顯示所有目前已經完成簽到的參加者'}
                {listMode === 'unchecked' && '顯示所有目前尚未完成簽到的參加者'}
                {listMode === 'cancelled' && '顯示所有已標記為不會出席的參加者'}
              </p>
              </div>
            </CardHeader>
          <CardContent>
            {detailList.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                目前尚無符合條件的紀錄
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  {pagedList.map((a, idx) => {
                    const itemKey = `${a.序號}-${a.姓名}`;
                    const isExpanded = expandedItem === itemKey;
                    
                    return (
                      <div
                        key={`${itemKey}-${idx}`}
                        className="bg-slate-800 rounded-md border border-slate-700 overflow-hidden"
                      >
                        <div
                          className="flex items-center justify-between py-2 px-3 text-sm cursor-pointer hover:bg-slate-750 transition-colors"
                          onClick={() => setExpandedItem(isExpanded ? null : itemKey)}
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
                          <div className="flex items-center gap-2">
                            {listMode === 'checked' && (
                              <span className="text-[11px] text-emerald-300">已簽到</span>
                            )}
                            {listMode === 'unchecked' && (
                              <span className="text-[11px] font-semibold">
                                {a.已到 === '晚到' ? (
                                  <span className="text-sky-300">晚到</span>
                                ) : (
                                  <span className="text-slate-400">未簽到</span>
                                )}
                              </span>
                            )}
                            {listMode === 'cancelled' && (
                              <span className="text-[11px] text-amber-300">不會出席</span>
                            )}
                            {listMode === 'all' && (
                              <span className="text-[11px] font-semibold">
                                {a.已到 === 'TRUE' && (
                                  <span className="text-emerald-300">已簽到</span>
                                )}
                                {a.已到 === '晚到' && (
                                  <span className="text-sky-300">晚到</span>
                                )}
                                {a.已到 === 'CANCELLED' && (
                                  <span className="text-amber-300">不會出席</span>
                                )}
                                {a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && a.已到 !== '晚到' && (
                                  <span className="text-slate-300">未簽到</span>
                                )}
                              </span>
                            )}

                            {a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && (
                              <Button
                                variant="outline"
                                size="sm"
                                className={`h-6 px-2 text-[10px] border-slate-500 text-slate-200 bg-slate-800/70 hover:bg-slate-700/80 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                                  rowActionLoading?.startsWith((a.序號 || a.姓名) + '-late-')
                                    ? 'opacity-60 animate-pulse'
                                    : ''
                                }`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkLate(a);
                                }}
                                disabled={rowActionLoading?.startsWith((a.序號 || a.姓名) + '-late-')}
                              >
                                {a.已到 === '晚到' ? '取消晚到' : '標記晚到'}
                              </Button>
                            )}

                            <span className="text-slate-400 text-xs">
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          </div>
                        </div>
                        
                        {/* 展開的詳細資料 */}
                        {isExpanded && a.詳細欄位 && a.詳細欄位.length > 0 && (
                          <div className="px-3 py-2 border-t border-slate-700 bg-slate-850">
                            <div className="space-y-1 text-xs">
                              {a.詳細欄位.map((field, fieldIdx) => {
                                const hasValue = field.值 && field.值.trim().length > 0;
                                const hasTitle = field.標題 && field.標題.trim().length > 0;
                                if (!hasTitle && !hasValue) return null;

                                return (
                                  <div key={fieldIdx} className="flex justify-between gap-2">
                                    <span className="text-slate-400">
                                      {field.標題 || `欄位 ${fieldIdx + 1}`}：
                                    </span>
                                    <span className="text-slate-200 break-all">
                                      {field.值 || '-'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-3 text-[11px] text-slate-300">
                  <div className="flex items-center gap-2">
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={0}>全部</option>
                    </select>
                    <span>
                      第 {safePage} / {totalPages} 頁（每頁 {pageSize === 0 ? '全部' : pageSize} 筆，共 {detailList.length} 筆）
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="h-6 px-2 border-slate-600 text-slate-200 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      上一頁
                    </Button>
                    <div className="flex items-center gap-1 max-w-[200px] overflow-x-auto">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) =>
                          page >= Math.max(1, safePage - 2) && page <= Math.min(totalPages, safePage + 2)
                        )
                        .map((page) => (
                          <button
                            key={page}
                            type="button"
                            onClick={() => setCurrentPage(page)}
                            className={`min-w-[28px] h-6 rounded-full border text-[11px] px-2 transition-colors
                              ${
                                page === safePage
                                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                                  : 'border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800'
                              }`}
                          >
                            {page}
                          </button>
                        ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={safePage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="h-6 px-2 border-slate-600 text-slate-200 bg-slate-900 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      下一頁
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        )}

        {/* 出席 / 尚未簽到 / 不會出席 概況（三個圓餅圖） */}
        <Card className="bg-slate-900/60 border border-slate-700 shadow-2xl mb-4">
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
                  <span>
                    尚未簽到人數：{Math.max(unchecked - lateCount, 0)}（晚到 {lateCount}）
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-300" />
                  <span>不會出席人數：{cancelled}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 聯絡組比例區塊 */}
        <Card className="bg-slate-900/60 border border-slate-700 shadow-2xl mb-4">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white tracking-wide flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              聯絡組比例分布
            </CardTitle>
            <p className="text-xs text-slate-400">顯示各聯絡組的已出席與未出席人數分布</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {contactGroupArray.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">目前無聯絡組資料</p>
            ) : (
              <div className="space-y-3">
                {contactGroupArray.map((item, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-200 font-medium">{item.group}</span>
                      <div className="text-slate-300 text-xs">
                        <span className="text-emerald-300 font-semibold">{item.checkedCount}</span> 已到 / 
                        <span className="text-sky-300 font-semibold ml-1">{item.lateCount}</span> 晚到 /
                        <span className="text-red-300 font-semibold ml-1">{item.uncheckedCount}</span> 未到
                        <span className="text-slate-400 ml-2">({item.percentage.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-3 border-t border-slate-700">
              <p className="text-xs text-slate-300">
                共有 <span className="font-semibold text-blue-300">{contactGroupArray.length}</span> 個聯絡組，
                總計 <span className="font-semibold text-emerald-300">{checked}</span> 人已簽到、
                <span className="font-semibold text-sky-300">{lateCount}</span> 人晚到、
                <span className="font-semibold text-red-300">{Math.max(unchecked - lateCount, 0)}</span> 人未簽到
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />

      {/* 回到頂部浮動按鈕 */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 z-50 p-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg transition-all duration-300 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          aria-label="回到頂部"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
