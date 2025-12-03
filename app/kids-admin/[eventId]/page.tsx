'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import { Users, UserCheck, UserX, Search, RefreshCw, Download, Lock } from 'lucide-react';

const KIDS_ADMIN_SESSION_KEY = 'easycheckin_kids_admin_session';
const ADMIN_SESSION_DURATION_MS = 15 * 60 * 1000;

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
}

export default function KidsAdminPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetFromQuery = searchParams.get('sheet');

  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'checked' | 'unchecked' | 'search'>(
    'all'
  );
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, checked: 0, unchecked: 0 });
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);
  const [loadTestCount, setLoadTestCount] = useState(10);
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestStats, setLoadTestStats] = useState({ success: 0, failed: 0, limited: 0 });
  const [loadTestMessage, setLoadTestMessage] = useState<string | null>(null);
  const [randomWriteCount, setRandomWriteCount] = useState(10);
  const [randomWriteRunning, setRandomWriteRunning] = useState(false);
  const [randomWriteStats, setRandomWriteStats] = useState({ success: 0, failed: 0, limited: 0 });
  const [randomWriteMessage, setRandomWriteMessage] = useState<string | null>(null);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);

  const effectiveSheetId = sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      alert('請輸入密碼');
      return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password: password.trim(), eventId }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        const expiresAt = Date.now() + ADMIN_SESSION_DURATION_MS;
        try {
          window.localStorage.setItem(
            KIDS_ADMIN_SESSION_KEY,
            JSON.stringify({ eventId, expiresAt })
          );
        } catch (e) {
          console.error('Failed to persist kids admin session:', e);
        }
        setSessionExpiry(expiresAt);
        setAuthenticated(true);
        fetchAttendees('all');
      } else {
        alert(data.message || '密碼錯誤');
      }
    } catch (error) {
      console.error('Kids admin login error:', error);
      alert('登入時發生錯誤，請稍後再試');
    }
  };

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
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Kids admin: error fetching attendees:', error);
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
      console.error('Kids admin: error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (data: Attendee[]) => {
    const checked = data.filter((a) => a.已到 === 'TRUE').length;
    const total = data.length;
    setStats({
      total,
      checked,
      unchecked: total - checked,
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
          operator: 'KidsAdmin後台',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Kids admin row cancel check-in failed:', data.message);
      }
    } catch (error) {
      console.error('Kids admin row cancel check-in error:', error);
    } finally {
      setRowActionLoading(null);
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
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
          operator: 'KidsAdmin後台',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Kids admin row mark cancelled failed:', data.message);
      }
    } catch (error) {
      console.error('Kids admin row mark cancelled error:', error);
    } finally {
      setRowActionLoading(null);
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
    }
  };

  const handleTabChange = (tab: 'all' | 'checked' | 'unchecked' | 'search') => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab !== 'search') {
      fetchAttendees(tab);
    }
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

  const handleKidsLoadTest = async () => {
    const count = Math.max(1, Math.min(loadTestCount, 30));
    setLoadTestCount(count);
    setLoadTestRunning(true);
    setLoadTestStats({ success: 0, failed: 0, limited: 0 });
    setLoadTestMessage(null);

    let success = 0;
    let failed = 0;
    let limited = 0;
    let lastLimitedMessage: string | null = null;

    try {
      const requests = Array.from({ length: count }).map(async (_, index) => {
        try {
          const response = await fetch('/api/kids/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifier: `KIDS-LOADTEST-${index + 1}`,
              sheetId: effectiveSheetId,
            }),
          });

          const data = await response.json();
          if (response.status === 429) {
            limited += 1;
            if (typeof data?.message === 'string') {
              lastLimitedMessage = data.message;
            }
          } else if (data.success) {
            success += 1;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          console.error('Kids load test request error:', error);
        }
      });

      await Promise.all(requests);
    } finally {
      setLoadTestStats({ success, failed, limited });
      setLoadTestRunning(false);
      if (lastLimitedMessage) {
        setLoadTestMessage(lastLimitedMessage);
      }
    }
  };

  const handleKidsRandomWriteTest = async () => {
    const dataSource = activeTab === 'search' ? searchResults : attendees;
    // 只從「尚未簽到、且不是 CANCELLED」中挑選，並排除序號 1~5（保留給手動測試）
    const available = dataSource.filter((a) => {
      const serial = (a.序號 || '').trim();
      const isProtected = ['1', '2', '3', '4', '5'].includes(serial);
      return a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && !isProtected;
    });
    const total = available.length;
    if (total === 0) {
      setRandomWriteStats({ success: 0, failed: 0, limited: 0 });
      setRandomWriteMessage('目前沒有可供測試的尚未簽到兒童（或只剩序號 1~5）。');
      return;
    }

    const count = Math.max(1, Math.min(randomWriteCount, total));
    setRandomWriteCount(count);
    setRandomWriteRunning(true);
    setRandomWriteStats({ success: 0, failed: 0, limited: 0 });
    setRandomWriteMessage(null);

    let success = 0;
    let failed = 0;
    let limited = 0;
    let lastLimitedMessage: string | null = null;

    try {
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);

      const requests = selected.map(async (attendee) => {
        const identifier = attendee.序號 || attendee.姓名;
        if (!identifier) {
          failed += 1;
          return;
        }
        try {
          const response = await fetch('/api/kids/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifier,
              sheetId: effectiveSheetId,
            }),
          });

          const data = await response.json();
          if (response.status === 429) {
            limited += 1;
            if (typeof data?.message === 'string') {
              lastLimitedMessage = data.message;
            }
          } else if (data.success) {
            success += 1;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          console.error('Kids random write test request error:', error);
        }
      });

      await Promise.all(requests);
    } finally {
      setRandomWriteStats({ success, failed, limited });
      setRandomWriteRunning(false);
      // 更新畫面資料
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
      if (lastLimitedMessage) {
        setRandomWriteMessage(lastLimitedMessage);
      }
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(KIDS_ADMIN_SESSION_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as { eventId: string; expiresAt: number };
      if (parsed.eventId !== eventId) return;
      if (Date.now() > parsed.expiresAt) {
        window.localStorage.removeItem(KIDS_ADMIN_SESSION_KEY);
        return;
      }
      setSessionExpiry(parsed.expiresAt);
      setAuthenticated(true);
    } catch (e) {
      console.error('Failed to restore kids admin session:', e);
    }
  }, [eventId]);

  useEffect(() => {
    if (!authenticated || !sessionExpiry) {
      return;
    }
    const interval = window.setInterval(() => {
      if (Date.now() > sessionExpiry) {
        try {
          window.localStorage.removeItem(KIDS_ADMIN_SESSION_KEY);
        } catch (e) {
          console.error('Failed to clear expired kids admin session:', e);
        }
        setAuthenticated(false);
        setPassword('');
        setSessionExpiry(null);
        alert('兒童管理後台登入已超過 15 分鐘，請重新登入');
      }
    }, 30_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authenticated, sessionExpiry]);

  useEffect(() => {
    if (authenticated) {
      fetchAttendees('all');
    }
  }, [authenticated]);

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl mb-8">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-2">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl">兒童管理後台</CardTitle>
            <CardDescription className="text-base">
              請輸入管理員密碼
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="管理員密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="text-lg h-12"
                autoFocus
              />
              <Button type="submit" className="w-full h-12 text-lg">
                登入
              </Button>
            </form>
          </CardContent>
        </Card>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8 flex flex-col">
      <div className="max-w-7xl mx-auto space-y-6 flex-1">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">兒童活動管理後台</h1>
            <p className="text-slate-600 mt-1">活動 ID: {eventId}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fetchAttendees(activeTab === 'search' ? 'all' : activeTab)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              重新整理
            </Button>
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              匯出 CSV
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="mb-4">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總人數</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">已簽到</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.checked}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? ((stats.checked / stats.total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">未簽到</CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.unchecked}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.total > 0 ? ((stats.unchecked / stats.total) * 100).toFixed(1) : 0}%
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={activeTab === 'all' ? 'default' : 'outline'}
                onClick={() => handleTabChange('all')}
              >
                全部名單
              </Button>
              <Button
                variant={activeTab === 'checked' ? 'default' : 'outline'}
                onClick={() => handleTabChange('checked')}
              >
                已簽到
              </Button>
              <Button
                variant={activeTab === 'unchecked' ? 'default' : 'outline'}
                onClick={() => handleTabChange('unchecked')}
              >
                未簽到
              </Button>
              <Button
                variant={activeTab === 'search' ? 'default' : 'outline'}
                onClick={() => handleTabChange('search')}
              >
                <Search className="w-4 h-4 mr-2" />
                搜尋
              </Button>
            </div>
          </CardHeader>

          <CardContent>
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
                  const dataSource = activeTab === 'search' ? searchResults : attendees;
                  const totalItems = dataSource.length;
                  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
                  const safeCurrentPage = Math.min(currentPage, totalPages);
                  const startIndex = (safeCurrentPage - 1) * pageSize;
                  const pageItems = dataSource.slice(startIndex, startIndex + pageSize);

                  return (
                    <>
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-3 font-semibold">報名序號</th>
                            <th className="text-left p-3 font-semibold">兒童姓名</th>
                            <th className="text-left p-3 font-semibold">到達時間</th>
                            <th className="text-left p-3 font-semibold">狀態</th>
                            <th className="text-left p-3 font-semibold w-40">操作</th>
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
                                    已簽到
                                  </span>
                                ) : attendee.已到 === 'CANCELLED' ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                    <UserX className="w-3 h-3 mr-1" />
                                    不會出席
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                    <UserX className="w-3 h-3 mr-1" />
                                    未簽到
                                  </span>
                                )}
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
                                      取消簽到
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
                                      恢復為未簽到
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
                                const size = Number(e.target.value) || 10;
                                setPageSize(size);
                                setCurrentPage(1);
                              }}
                            >
                              <option value={10}>10 筆</option>
                              <option value={20}>20 筆</option>
                              <option value={50}>50 筆</option>
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

        {/* 壓力測試面板（兒童版） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">壓力測試（兒童簽到 API）</CardTitle>
            <CardDescription>
              連續呼叫兒童簽到 API（使用虛擬序號，不會改動名單），用來測試 Google Sheets 與流量保護機制。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span>測試次數</span>
                <Input
                  type="number"
                  min={1}
                  max={30}
                  value={loadTestCount}
                  onChange={(e) => setLoadTestCount(Number(e.target.value) || 1)}
                  className="w-24 h-9 text-sm"
                />
                <span className="text-xs text-slate-500">（1 ~ 30 次）</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleKidsLoadTest}
                disabled={loadTestRunning}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${loadTestRunning ? 'animate-spin text-emerald-600' : ''}`}
                />
                {loadTestRunning ? '測試進行中...' : '開始壓力測試'}
              </Button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                測試結果：成功 {loadTestStats.success} 次，失敗 {loadTestStats.failed} 次，觸發流量保護
                {loadTestStats.limited} 次。
              </p>
              {loadTestMessage && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 whitespace-pre-line">
                  伺服器回應：{loadTestMessage}
                </p>
              )}
              <p className="text-[11px] text-slate-500">
                提示：此測試會大量呼叫 `/api/kids/checkin`，但因為使用不存在的虛擬序號，因此不會更動
                Google Sheet 的實際兒童名單。
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 實際寫入測試面板（兒童版） */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">實際寫入測試（兒童簽到）</CardTitle>
            <CardDescription>
              從目前兒童名單中，隨機選擇多位「尚未簽到且非不會出席」的孩童，實際呼叫兒童簽到 API
              寫入 Google Sheet。請先備份或確認這份名單是測試用再執行。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <div className="flex items-center gap-2">
                <span>簽到筆數</span>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={randomWriteCount}
                  onChange={(e) => setRandomWriteCount(Number(e.target.value) || 1)}
                  className="w-24 h-9 text-sm"
                />
                <span className="text-xs text-slate-500">（最多不超過目前可簽到人數）</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleKidsRandomWriteTest}
                disabled={randomWriteRunning}
              >
                <RefreshCw
                  className={`w-4 h-4 mr-2 ${randomWriteRunning ? 'animate-spin text-emerald-600' : ''}`}
                />
                {randomWriteRunning ? '執行中...' : '開始實際簽到測試'}
              </Button>
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p>
                測試結果：成功 {randomWriteStats.success} 次，失敗 {randomWriteStats.failed} 次，觸發流量保護
                {randomWriteStats.limited} 次。
              </p>
              {randomWriteMessage && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 whitespace-pre-line">
                  伺服器回應：{randomWriteMessage}
                </p>
              )}
              <p className="text-[11px] text-red-600">
                注意：這個測試會「真的」替名單中的兒童簽到，請只在測試用試算表或可接受修改的名單上執行，避免影響正式活動紀錄。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <SiteFooter />
    </div>
  );
}
