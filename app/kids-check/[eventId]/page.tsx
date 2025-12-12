'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import { Users, UserCheck, UserX, Search, RefreshCw, Download } from 'lucide-react';

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
  需要聯繫?: string; // U 欄：已聯繫狀態，TRUE = 已聯繫
  詳細欄位?: Array<{ 標題: string; 值: string }>; // 詳細欄位，包含家長行動電話等
}

export default function KidsCheckPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const sheetFromQuery = searchParams.get('sheet');

  const [activeTab, setActiveTab] = useState<
    'all' | 'checked' | 'unchecked' | 'cancelled' | 'search'
  >('all');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    expected: 0,
    checked: 0,
    unchecked: 0,
    cancelled: 0,
    contacted: 0,
    uncontacted: 0,
  });
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);
  const [activitySheetUrl, setActivitySheetUrl] = useState<string | null>(null);
  const [logSheetUrl, setLogSheetUrl] = useState<string | null>(null);
  const [tableFilter, setTableFilter] = useState('');

  const effectiveSheetId = sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId;

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/admin/event-sheets?eventId=${encodeURIComponent(eventId)}`);
        const data = await res.json();
        if (data.success && data.data) {
          setActivitySheetUrl(data.data.activitySheetUrl || data.data.activitySheetLink || null);
          setLogSheetUrl(data.data.logSheetUrl || data.data.logSheetLink || null);
        }
      } catch (e) {
        console.error('Kids check: failed to load event sheets', e);
      }
    })();
  }, [eventId]);

  // 從 URL 恢復分頁、頁碼和頁面大小
  useEffect(() => {
    const tab = searchParams.get('tab');
    const page = searchParams.get('page');
    const size = searchParams.get('pageSize');

    if (tab === 'all' || tab === 'checked' || tab === 'unchecked' || tab === 'search') {
      setActiveTab(tab);
    }

    if (page) {
      const parsedPage = parseInt(page, 10);
      if (!Number.isNaN(parsedPage) && parsedPage > 0) {
        setCurrentPage(parsedPage);
      }
    }

    if (size) {
      const parsedSize = parseInt(size, 10);
      if (!Number.isNaN(parsedSize) && parsedSize >= 0) {
        setPageSize(parsedSize);
      }
    }
  }, [searchParams]);

  // 更新 URL 查詢參數
  const updateURLParams = (
    tab: 'all' | 'checked' | 'unchecked' | 'cancelled' | 'search',
    page: number,
    size: number
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    params.set('page', page.toString());
    params.set('pageSize', size.toString());
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // 當分頁、頁碼或頁面大小改變時，更新 URL
  useEffect(() => {
    updateURLParams(activeTab, currentPage, pageSize);
  }, [activeTab, currentPage, pageSize]);

  const fetchAttendees = async (filter: 'all' | 'checked' | 'unchecked') => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/kids/attendees?sheetId=${encodeURIComponent(
          effectiveSheetId
        )}&filter=${filter}&eventId=${encodeURIComponent(eventId)}`
      );
      const data = await response.json();

      if (data.success) {
        setAttendees(data.data);
        updateStats(data.data);
      }
    } catch (error) {
      console.error('Kids check: error fetching attendees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/kids/search?sheetId=${encodeURIComponent(
          effectiveSheetId
        )}&query=${encodeURIComponent(searchQuery)}&eventId=${encodeURIComponent(eventId)}`
      );
      const data = await response.json();

      if (data.success) {
        setSearchResults(data.data || []);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Kids check: error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (data: Attendee[]) => {
    const checked = data.filter((a) => a.已到 === 'TRUE').length;
    const total = data.length;
    const cancelled = data.filter((a) => a.已到 === 'CANCELLED').length;
    const contacted = data.filter(
      (a) => a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && a.需要聯繫 === 'TRUE'
    ).length;
    const uncontacted = data.filter(
      (a) => a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && a.需要聯繫 !== 'TRUE'
    ).length;
    const expected = checked + (total - checked - cancelled);
    setStats({
      total,
      expected,
      checked,
      unchecked: total - checked - cancelled,
      cancelled,
      contacted,
      uncontacted,
    });
  };

  const handleRowCancelCheckIn = async (attendee: Attendee) => {
    const identifier = attendee.序號 || attendee.姓名;
    if (!identifier) return;
    setRowActionLoading(identifier + '-cancel');
    try {
      const response = await fetch('/api/kids/manager/cancel-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier,
          eventId,
          attendeeName: attendee.姓名,
          operator: 'KidsCheck工作人員',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Kids check row cancel check-in failed:', data.message);
      }
    } catch (error) {
      console.error('Kids check row cancel check-in error:', error);
    } finally {
      setRowActionLoading(null);
      fetchAttendees('all');
    }
  };

  const handleRowMarkCancelled = async (attendee: Attendee) => {
    const identifier = attendee.序號 || attendee.姓名;
    if (!identifier) return;
    setRowActionLoading(identifier + '-cancelled');
    try {
      const response = await fetch('/api/kids/manager/mark-cancelled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier,
          eventId,
          attendeeName: attendee.姓名,
          operator: 'KidsCheck工作人員',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Kids check row mark cancelled failed:', data.message);
      }
    } catch (error) {
      console.error('Kids check row mark cancelled error:', error);
    } finally {
      setRowActionLoading(null);
      fetchAttendees('all');
    }
  };

  const handleToggleContact = async (attendee: Attendee) => {
    const identifier = attendee.序號 || attendee.姓名;
    if (!identifier) return;

    const key = identifier;
    const getParentKey = (a: Attendee) => {
      const detail = a.詳細欄位 || [];
      const phoneField = detail.find((f) => f.標題.includes('行動電話') || f.標題.includes('電話'));
      const phone = (phoneField?.值 || '').toString().trim();
      if (phone) return `phone:${phone}`;
      const parentField = detail.find((f) => f.標題.includes('家長'));
      const parent = (parentField?.值 || '').toString().trim();
      if (parent) return `parent:${parent}`;
      return '';
    };
    const targetStatus = attendee.需要聯繫 === 'TRUE' ? '' : 'TRUE';
    const parentKey = getParentKey(attendee);
    const isAffected = (a: Attendee) => {
      if (parentKey) return getParentKey(a) === parentKey;
      return (a.序號 || a.姓名) === key;
    };

    const prevStatusMap = new Map<string, string>();
    for (const a of attendees) {
      if (isAffected(a)) {
        prevStatusMap.set((a.序號 || a.姓名) as string, (a.需要聯繫 || '').toString());
      }
    }
    for (const a of searchResults) {
      if (isAffected(a)) {
        prevStatusMap.set((a.序號 || a.姓名) as string, (a.需要聯繫 || '').toString());
      }
    }

    const applyLocalContactStatus = (newStatus: string) => {
      setAttendees((prev) =>
        prev.map((a) => (isAffected(a) ? { ...a, 需要聯繫: newStatus } : a))
      );

      setSearchResults((prev) =>
        prev.map((a) => (isAffected(a) ? { ...a, 需要聯繫: newStatus } : a))
      );
    };

    const restoreLocalContactStatus = () => {
      setAttendees((prev) =>
        prev.map((a) => {
          const k = (a.序號 || a.姓名) as string;
          if (!prevStatusMap.has(k)) return a;
          return { ...a, 需要聯繫: prevStatusMap.get(k) || '' };
        })
      );

      setSearchResults((prev) =>
        prev.map((a) => {
          const k = (a.序號 || a.姓名) as string;
          if (!prevStatusMap.has(k)) return a;
          return { ...a, 需要聯繫: prevStatusMap.get(k) || '' };
        })
      );
    };

    // 樂觀更新：先在前端切換狀態
    applyLocalContactStatus(targetStatus);
    setRowActionLoading(identifier + '-contact');

    try {
      const response = await fetch('/api/kids/manager/toggle-contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: effectiveSheetId,
          identifier,
          eventId,
          attendeeName: attendee.姓名,
          operator: 'KidsCheck工作人員',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Kids check toggle contact failed:', data.message);
        // 若後端失敗，回滾本地狀態
        restoreLocalContactStatus();
      }
    } catch (error) {
      console.error('Kids check toggle contact error:', error);
      // 發生錯誤也回滾
      restoreLocalContactStatus();
    } finally {
      setRowActionLoading(null);
    }
  };

  const handleTabChange = (
    tab: 'all' | 'checked' | 'unchecked' | 'cancelled' | 'search'
  ) => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab === 'search') return;
    // 為了確保上方統計 panel 正確，這裡固定抓取完整名單，列表再用前端篩選
    fetchAttendees('all');
  };

  const exportToCSV = () => {
    const header = ['報名序號', '兒童姓名', '到達時間', '已到'];
    const dataSource = activeTab === 'search' ? searchResults : attendees;
    const rows = dataSource.map((a) => [a.序號, a.姓名, a.到達時間, a.已到]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${(cell || '').toString().replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kids_attendees_${eventId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (activeTab === 'search') return;
    fetchAttendees('all');
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex flex-col">
      <div className="max-w-7xl mx-auto space-y-6 flex-1">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">現場工作主責人員</h1>
            <p className="text-sm text-slate-600 mt-1">活動 ID: {eventId}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            {activitySheetUrl && (
              <a href={activitySheetUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="whitespace-nowrap">
                  活動試算表
                </Button>
              </a>
            )}
            {logSheetUrl ? (
              <a href={logSheetUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="whitespace-nowrap">
                  日誌試算表
                </Button>
              </a>
            ) : (
              <Button variant="outline" disabled className="whitespace-nowrap opacity-70">
                日誌試算表未設定
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                const backendFilter: 'all' | 'checked' | 'unchecked' =
                  activeTab === 'checked'
                    ? 'checked'
                    : activeTab === 'unchecked'
                    ? 'unchecked'
                    : 'all';
                fetchAttendees(backendFilter);
              }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card
            className={`mb-4 cursor-pointer transition-shadow hover:shadow-md ${
              activeTab === 'all' ? 'ring-2 ring-slate-400' : ''
            }`}
            onClick={() => handleTabChange('all')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總人數</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">
                應到人數（已報到＋未報到，不含不會出席）：
                <span className="font-semibold ml-1">{stats.expected}</span>
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              activeTab === 'checked' ? 'ring-2 ring-emerald-400' : ''
            }`}
            onClick={() => handleTabChange('checked')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已報到</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.checked}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? ((stats.checked / stats.total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              activeTab === 'unchecked' ? 'ring-2 ring-red-400' : ''
            }`}
            onClick={() => handleTabChange('unchecked')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">未報到</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.unchecked}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? ((stats.unchecked / stats.total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              activeTab === 'cancelled' ? 'ring-2 ring-amber-400' : ''
            }`}
            onClick={() => handleTabChange('cancelled')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">不會出席</CardTitle>
              <UserX className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.cancelled}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? ((stats.cancelled / stats.total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="space-y-1 pb-2">
              <CardTitle className="text-sm font-medium">聯繫狀態（未報到）</CardTitle>
              <CardDescription className="text-xs">只統計尚未報到、未標記不會出席的名單</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-600">已聯繫</span>
                  <span className="text-lg font-semibold text-emerald-600">
                    {stats.contacted}
                  </span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-slate-600">待聯繫</span>
                  <span className="text-lg font-semibold text-amber-600">
                    {stats.uncontacted}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div />
            </div>
          </CardHeader>

          <CardContent>
            <div className="mb-4">
              <label className="text-sm font-medium">搜尋姓名或序號</label>
              <div className="mt-2 flex gap-2">
                <Input
                  placeholder="例如：王小明 或 001"
                  value={tableFilter}
                  onChange={(e) => {
                    setTableFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    setTableFilter('');
                    setCurrentPage(1);
                  }}
                  disabled={!tableFilter.trim()}
                  className="whitespace-nowrap"
                >
                  清除
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                會在目前列表中即時過濾（依分頁/狀態而定）。
              </p>
            </div>

            {activeTab === 'search' && (
              <div className="mb-6 flex gap-2">
                <Input
                  placeholder="搜尋報名序號或兒童姓名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <Button onClick={handleSearch} disabled={loading}>
                  <Search className="w-4 h-4 mr-2" />
                  搜尋
                </Button>
              </div>
            )}

            {loading ? (
              <div className="text-center py-12">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto text-slate-400" />
                <p className="mt-2 text-slate-600">載入中...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                {(() => {
                  let dataSource: Attendee[] = [];
                  if (activeTab === 'search') {
                    dataSource = searchResults;
                  } else if (activeTab === 'cancelled') {
                    // 只顯示標記為不會出席的紀錄
                    dataSource = attendees.filter((a) => a.已到 === 'CANCELLED');
                  } else if (activeTab === 'unchecked') {
                    // 未報到：排除已報到與不會出席，只保留真正尚未報到者
                    dataSource = attendees.filter(
                      (a) => a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED'
                    );
                  } else {
                    dataSource = attendees;
                  }

                  const filterText = tableFilter.trim();
                  if (filterText) {
                    const normalized = filterText.toLowerCase();
                    dataSource = dataSource.filter((a) => {
                      const id = (a.序號 || '').toString().toLowerCase();
                      const name = (a.姓名 || '').toString().toLowerCase();
                      return id.includes(normalized) || name.includes(normalized);
                    });
                  }

                  const totalItems = dataSource.length;
                  const effectivePageSize = pageSize === 0 ? totalItems : pageSize;
                  const totalPages = Math.max(1, Math.ceil(totalItems / Math.max(effectivePageSize, 1)));
                  const safeCurrentPage = Math.min(currentPage, totalPages);
                  const startIndex = (safeCurrentPage - 1) * effectivePageSize;
                  const pageItems = dataSource.slice(startIndex, startIndex + effectivePageSize);

                  return (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-semibold">報名序號</th>
                            <th className="text-left p-3 font-semibold">兒童姓名</th>
                            <th className="text-left p-3 font-semibold">到達時間</th>
                            <th className="text-left p-3 font-semibold">狀態</th>
                            <th className="text-left p-3 font-semibold">聯繫狀態</th>
                            <th className="text-left p-3 font-semibold">家長行動電話</th>
                            <th className="text-left p-3 font-semibold">家長姓名</th>
                            <th className="text-left p-3 font-semibold w-48">操作</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((attendee, index) => (
                            <tr key={index} className="border-b hover:bg-slate-50">
                              <td className="p-3">{attendee.序號}</td>
                              <td className="p-3">{attendee.姓名}</td>
                              <td className="p-3">{attendee.到達時間 || '-'}</td>
                              <td className="p-3">
                                {attendee.已到 === 'TRUE' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    <UserCheck className="w-3 h-3 mr-1" />
                                    已報到
                                  </span>
                                ) : attendee.已到 === 'CANCELLED' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    <UserX className="w-3 h-3 mr-1" />
                                    不會出席
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <UserX className="w-3 h-3 mr-1" />
                                    未報到
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {attendee.已到 === 'TRUE' ? (
                                  <span className="text-xs text-slate-400">已報到</span>
                                ) : attendee.已到 === 'CANCELLED' ? (
                                  <span className="text-xs text-slate-400">-</span>
                                ) : attendee.需要聯繫 === 'TRUE' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                    ✓ 已聯繫
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                                    待聯繫
                                  </span>
                                )}
                              </td>
                              <td className="p-3">
                                {(() => {
                                  const phoneField = attendee.詳細欄位?.find(
                                    (f) => f.標題.includes('行動電話') || f.標題.includes('電話')
                                  );
                                  return phoneField?.值 ? (
                                    <span className="text-sm">{phoneField.值}</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">-</span>
                                  );
                                })()}
                              </td>
                              <td className="p-3">
                                {(() => {
                                  const parentField = attendee.詳細欄位?.find((f) =>
                                    f.標題.includes('家長')
                                  );
                                  return parentField?.值 ? (
                                    <span className="text-sm">{parentField.值}</span>
                                  ) : (
                                    <span className="text-xs text-slate-400">-</span>
                                  );
                                })()}
                              </td>
                              <td className="p-3">
                                <div className="flex flex-wrap gap-2 text-xs">
                                  {attendee.已到 === 'TRUE' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                                      onClick={() => handleRowCancelCheckIn(attendee)}
                                      disabled={
                                        rowActionLoading === (attendee.序號 || attendee.姓名) + '-cancel'
                                      }
                                    >
                                      取消報到
                                    </Button>
                                  )}
                                  {attendee.已到 === 'CANCELLED' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs border-slate-300 text-slate-700 hover:bg-slate-100"
                                      onClick={() => handleRowCancelCheckIn(attendee)}
                                      disabled={
                                        rowActionLoading === (attendee.序號 || attendee.姓名) + '-cancel'
                                      }
                                    >
                                      恢復為未報到
                                    </Button>
                                  )}
                                  {attendee.已到 !== 'TRUE' && attendee.已到 !== 'CANCELLED' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs border-amber-300 text-amber-700 hover:bg-amber-50"
                                      onClick={() => handleRowMarkCancelled(attendee)}
                                      disabled={
                                        rowActionLoading ===
                                        (attendee.序號 || attendee.姓名) + '-cancelled'
                                      }
                                    >
                                      標記為不會出席
                                    </Button>
                                  )}
                                  {attendee.已到 !== 'TRUE' && attendee.已到 !== 'CANCELLED' && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className={`h-7 px-2 text-xs ${
                                        attendee.需要聯繫 === 'TRUE'
                                          ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                          : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                      }`}
                                      onClick={() => handleToggleContact(attendee)}
                                      disabled={
                                        rowActionLoading === (attendee.序號 || attendee.姓名) + '-contact'
                                      }
                                    >
                                      {attendee.需要聯繫 === 'TRUE' ? '取消已聯繫' : '標記已聯繫'}
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {totalItems === 0 && (
                        <div className="text-center py-12 text-slate-500">
                          {activeTab === 'search' ? '沒有搜尋結果' : '目前沒有資料'}
                        </div>
                      )}

                      {totalItems > 0 && (
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mt-4 text-xs text-slate-600">
                          <div className="flex items-center gap-2">
                            <span>每頁顯示</span>
                            <select
                              className="border rounded px-2 py-1 text-xs bg-white"
                              value={pageSize}
                              onChange={(e) => {
                                const parsed = Number(e.target.value);
                                const size = Number.isNaN(parsed) ? 10 : parsed;
                                setPageSize(size);
                                setCurrentPage(1);
                              }}
                            >
                              <option value={10}>10 筆</option>
                              <option value={20}>20 筆</option>
                              <option value={50}>50 筆</option>
                              <option value={0}>全部</option>
                            </select>
                          </div>

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={safeCurrentPage === 1}
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                              上一頁
                            </Button>
                            <span>
                              第 {safeCurrentPage} / {totalPages} 頁（共 {totalItems} 筆）
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={safeCurrentPage === totalPages}
                              onClick={() =>
                                setCurrentPage((p) => Math.min(totalPages, p + 1))
                              }
                            >
                              下一頁
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
