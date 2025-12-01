'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  RefreshCw,
  Download,
  Lock
} from 'lucide-react';

const ADMIN_SESSION_KEY = 'easycheckin_admin_session';
const ADMIN_SESSION_DURATION_MS = 15 * 60 * 1000;

interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
}

export default function AdminPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetFromQuery = searchParams.get('sheet');
  
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'checked' | 'unchecked' | 'search'>('all');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Attendee[]>([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, checked: 0, unchecked: 0 });
  const [testIdentifier, setTestIdentifier] = useState('');
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [loadTestCount, setLoadTestCount] = useState(10);
  const [loadTestRunning, setLoadTestRunning] = useState(false);
  const [loadTestStats, setLoadTestStats] = useState({ success: 0, failed: 0, limited: 0 });
  const [loadTestMessage, setLoadTestMessage] = useState<string | null>(null);
  const [showTools, setShowTools] = useState(false);
  const [rowActionLoading, setRowActionLoading] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [randomWriteCount, setRandomWriteCount] = useState(10);
  const [randomWriteRunning, setRandomWriteRunning] = useState(false);
  const [randomWriteStats, setRandomWriteStats] = useState({ success: 0, failed: 0, limited: 0 });
  const [randomWriteMessage, setRandomWriteMessage] = useState<string | null>(null);
  const [concurrentCount, setConcurrentCount] = useState(10);
  const [concurrentRunning, setConcurrentRunning] = useState(false);
  const [concurrentStats, setConcurrentStats] = useState({ success: 0, failed: 0, limited: 0 });
  const [concurrentMessage, setConcurrentMessage] = useState<string | null>(null);
  const [sessionExpiry, setSessionExpiry] = useState<number | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      alert('請輸入密碼');
      return;
    }

    let lastLimitedMessage: string | null = null;
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
            ADMIN_SESSION_KEY,
            JSON.stringify({ eventId, expiresAt })
          );
        } catch (e) {
          console.error('Failed to persist admin session:', e);
        }
        setSessionExpiry(expiresAt);
        setAuthenticated(true);
        fetchAttendees('all');
      } else {
        alert(data.message || '密碼錯誤');
      }
    } catch (error) {
      console.error('Admin login error:', error);
      alert('登入時發生錯誤，請稍後再試');
    }
  };

  const handleRowCancelCheckIn = async (attendee: Attendee) => {
    const identifier = attendee.序號 || attendee.姓名;
    if (!identifier) return;
    setRowActionLoading(identifier + '-cancel');
    try {
      const response = await fetch('/api/manager/cancel-checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
          identifier,
          eventId,
          attendeeName: attendee.姓名,
          operator: 'Admin後台',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Row cancel check-in failed:', data.message);
      }
    } catch (error) {
      console.error('Row cancel check-in error:', error);
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
      const response = await fetch('/api/manager/mark-cancelled', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
          identifier,
          eventId,
          attendeeName: attendee.姓名,
          operator: 'Admin後台',
        }),
      });
      const data = await response.json();
      if (!data.success) {
        console.error('Row mark cancelled failed:', data.message);
      }
    } catch (error) {
      console.error('Row mark cancelled error:', error);
    } finally {
      setRowActionLoading(null);
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
    }
  };

  const fetchAttendees = async (filter: 'all' | 'checked' | 'unchecked') => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/attendees?sheetId=${sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId}&filter=${filter}&eventId=${encodeURIComponent(eventId)}`
      );
      const data = await response.json();
      
      if (data.success) {
        setAttendees(data.data);
        updateStats(data.data);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error fetching attendees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `/api/search?sheetId=${sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId}&query=${encodeURIComponent(
          searchQuery
        )}&eventId=${encodeURIComponent(eventId)}`
      );
      const data = await response.json();
      
      if (data.success) {
        setSearchResults(data.data);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStats = (data: Attendee[]) => {
    const checked = data.filter((a) => a.已到 === 'TRUE').length;
    setStats({
      total: data.length,
      checked,
      unchecked: data.length - checked,
    });
  };

  const handleTabChange = (tab: 'all' | 'checked' | 'unchecked' | 'search') => {
    setActiveTab(tab);
    setCurrentPage(1);
    if (tab !== 'search') {
      fetchAttendees(tab);
    }
  };

  const handleTestCheckIn = async () => {
    if (!testIdentifier.trim()) {
      setTestResult('請先輸入要測試的序號或姓名');
      return;
    }

    setTestLoading(true);
    setTestResult(null);

    try {
      const response = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: testIdentifier.trim(),
          sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTestResult(`✅ 測試簽到成功：${data.data?.序號 || ''} ${data.data?.姓名 || ''}（${data.data?.到達時間 || ''}）`);
        fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
      } else {
        setTestResult(`❌ 測試簽到失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      setTestResult('❌ 測試簽到發生錯誤，請稍後再試');
      console.error('Test check-in error:', error);
    } finally {
      setTestLoading(false);
    }
  };

  const handleHealthCheck = async () => {
    setHealthLoading(true);
    setHealthStatus(null);

    try {
      const response = await fetch(
        `/api/attendees?sheetId=${sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId}&filter=all&eventId=${encodeURIComponent(
          eventId
        )}`
      );
      const data = await response.json();

      if (data.success) {
        setHealthStatus('✅ Google Sheets 連線正常');
      } else {
        setHealthStatus(`❌ 連線異常：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      setHealthStatus('❌ 連線發生錯誤，請檢查設定或稍後再試');
      console.error('Health check error:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const handleLoadTest = async () => {
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
          const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifier: `LOADTEST-${index + 1}`,
              sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
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
            console.log('Load test failed identifier', `LOADTEST-${index + 1}`, 'response:', data);
          }
        } catch (error) {
          failed += 1;
          console.error('Load test request error for identifier', `LOADTEST-${index + 1}`, error);
        }
      });

      await Promise.all(requests);
    } finally {
      setLoadTestStats({ success, failed, limited });
      setLoadTestRunning(false);
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
      if (lastLimitedMessage) {
        setLoadTestMessage(lastLimitedMessage);
      }
      try {
        await fetch('/api/admin/log-loadtest-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId,
            type: 'loadtest',
            success,
            failed,
            limited,
          }),
        });
      } catch (e) {
        console.error('Failed to log loadtest summary:', e);
      }
    }
  };

  const handleRandomWriteTest = async () => {
    const dataSource = activeTab === 'search' ? searchResults : attendees;
    // 只從「尚未簽到、且不是 CANCELLED」的名單中挑選
    const available = dataSource.filter(
      (a) => {
        const serial = (a.序號 || '').trim();
        // 排除 1~5 號，保留給手動測試
        const isProtected = ['1', '2', '3', '4', '5'].includes(serial);
        return a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && !isProtected;
      }
    );
    const total = available.length;
    if (total === 0) {
      setRandomWriteStats({ success: 0, failed: 0, limited: 0 });
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
      // 隨機挑選 count 個不重複的參加者（僅限尚未簽到且非 CANCELLED）
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);

      const requests = selected.map(async (attendee) => {
        const identifier = attendee.序號 || attendee.姓名;
        if (!identifier) {
          failed += 1;
          console.log('Random write test failed: empty identifier for attendee', attendee);
          return;
        }
        try {
          const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifier,
              sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
            }),
          });

          const data = await response.json();
          if (response.status === 429) {
            limited += 1;
          } else if (data.success) {
            success += 1;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          console.error('Random write test request error:', error);
        }
      });

      await Promise.all(requests);
    } finally {
      setRandomWriteStats({ success, failed, limited });
      setRandomWriteRunning(false);
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
      if (lastLimitedMessage) {
        setRandomWriteMessage(lastLimitedMessage);
      }
      try {
        await fetch('/api/admin/log-loadtest-summary', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            eventId,
            type: 'random_write',
            success,
            failed,
            limited,
          }),
        });
      } catch (e) {
        console.error('Failed to log random write summary:', e);
      }
    }
  };

  const handleConcurrentTest = async () => {
    const dataSource = activeTab === 'search' ? searchResults : attendees;
    // 只從「尚未簽到、且不是 CANCELLED」的名單中挑選
    const available = dataSource.filter(
      (a) => {
        const serial = (a.序號 || '').trim();
        // 排除 1~5 號，保留給手動測試
        const isProtected = ['1', '2', '3', '4', '5'].includes(serial);
        return a.已到 !== 'TRUE' && a.已到 !== 'CANCELLED' && !isProtected;
      }
    );
    const total = available.length;
    if (total === 0) {
      setConcurrentStats({ success: 0, failed: 0, limited: 0 });
      return;
    }

    const count = Math.max(1, Math.min(concurrentCount, total));
    setConcurrentCount(count);
    setConcurrentRunning(true);
    setConcurrentStats({ success: 0, failed: 0, limited: 0 });
    setConcurrentMessage(null);

    let success = 0;
    let failed = 0;
    let limited = 0;
    let lastLimitedMessage: string | null = null;

    try {
      // 隨機挑選 count 個不重複的參加者，並同時發送簽到請求
      const shuffled = [...available].sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);

      const requests = selected.map(async (attendee) => {
        const identifier = attendee.序號 || attendee.姓名;
        if (!identifier) {
          failed += 1;
          return;
        }
        try {
          const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              identifier,
              sheetId: sheetFromQuery || process.env.GOOGLE_SHEET_ID || eventId,
            }),
          });

          const data = await response.json();
          if (response.status === 429) {
            limited += 1;
          } else if (data.success) {
            success += 1;
          } else {
            failed += 1;
          }
        } catch (error) {
          failed += 1;
          console.error('Concurrent test request error:', error);
        }
      });

      await Promise.all(requests);
    } finally {
      setConcurrentStats({ success, failed, limited });
      setConcurrentRunning(false);
      fetchAttendees(activeTab === 'search' ? 'all' : activeTab);
      if (lastLimitedMessage) {
        setConcurrentMessage(lastLimitedMessage);
      }
    }
  };

  const exportToCSV = () => {
    const data = activeTab === 'search' ? searchResults : attendees;
    const csv = [
      ['序號', '姓名', '到達時間', '狀態'],
      ...data.map((a) => {
        const status = a.已到 === 'TRUE' ? '已簽到' : a.已到 === 'CANCELLED' ? '取消' : '未簽到';
        return [a.序號, a.姓名, a.到達時間, status];
      }),
    ]
      .map((row) => row.join(','))
      .join('\n');
    
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendees_${eventId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ADMIN_SESSION_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { eventId?: string; expiresAt?: number };
      if (!parsed || !parsed.eventId || typeof parsed.expiresAt !== 'number') {
        window.localStorage.removeItem(ADMIN_SESSION_KEY);
        return;
      }
      if (parsed.eventId !== eventId) {
        return;
      }
      if (Date.now() > parsed.expiresAt) {
        window.localStorage.removeItem(ADMIN_SESSION_KEY);
        return;
      }
      setSessionExpiry(parsed.expiresAt);
      setAuthenticated(true);
    } catch (e) {
      console.error('Failed to restore admin session:', e);
    }
  }, [eventId]);

  useEffect(() => {
    if (!authenticated || !sessionExpiry) {
      return;
    }
    const interval = window.setInterval(() => {
      if (Date.now() > sessionExpiry) {
        try {
          window.localStorage.removeItem(ADMIN_SESSION_KEY);
        } catch (e) {
          console.error('Failed to clear expired admin session:', e);
        }
        setAuthenticated(false);
        setPassword('');
        setSessionExpiry(null);
        alert('後台登入已超過 15 分鐘，請重新登入');
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
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-2">
              <Lock className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-3xl">管理後台</CardTitle>
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">活動管理後台</h1>
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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
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

        {/* Tabs */}
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
                  placeholder="搜尋序號或姓名..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
                      <th className="text-left p-3 font-semibold">序號</th>
                      <th className="text-left p-3 font-semibold">姓名</th>
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
                              不會來
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
                                disabled={rowActionLoading === (attendee.序號 || attendee.姓名) + '-cancel'}
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
                                disabled={rowActionLoading === (attendee.序號 || attendee.姓名) + '-cancel'}
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
                                disabled={rowActionLoading === (attendee.序號 || attendee.姓名) + '-cancelled'}
                              >
                                標記為不會來
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
                              <option value={30}>30 筆</option>
                            </select>
                            <span>
                              ，共 {totalItems} 筆
                            </span>
                          </div>

                          <div className="flex items-center gap-2 justify-end">
                            <button
                              type="button"
                              className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={safeCurrentPage <= 1}
                            >
                              上一頁
                            </button>
                            <span>
                              第 {safeCurrentPage} / {totalPages} 頁
                            </span>
                            <button
                              type="button"
                              className="px-2 py-1 border rounded disabled:opacity-50 bg-white"
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={safeCurrentPage >= totalPages}
                            >
                              下一頁
                            </button>
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
      
      {/* Test Tools Toggle + Panel (bottom) */}
      <div className="max-w-7xl mx-auto mt-6 space-y-4">
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTools((v) => !v)}
          >
            {showTools ? '隱藏後台測試工具' : '顯示後台測試工具'}
          </Button>
        </div>

        {showTools && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">後台測試工具（僅工作人員使用）</CardTitle>
              <CardDescription>
                用來快速測試簽到流程與 Google Sheets 連線狀況，或小量壓測併發保護機制。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <p className="text-sm font-medium">單筆簽到測試</p>
                <div className="flex flex-col md:flex-row gap-2">
                  <Input
                    placeholder="輸入要測試的序號或姓名...（會真的簽到）"
                    value={testIdentifier}
                    onChange={(e) => setTestIdentifier(e.target.value)}
                    className="md:max-w-xs"
                  />
                  <Button onClick={handleTestCheckIn} disabled={testLoading}>
                    {testLoading ? '測試中...' : '測試簽到'}
                  </Button>
                </div>
                {testResult && (
                  <p className="text-xs text-slate-700 mt-1 whitespace-pre-line">{testResult}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Google Sheets 連線檢查</p>
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <Button variant="outline" onClick={handleHealthCheck} disabled={healthLoading}>
                    {healthLoading ? '檢查中...' : '檢查連線'}
                  </Button>
                  {healthStatus && (
                    <span className="text-xs text-slate-700">{healthStatus}</span>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">簡單小壓測（驗證併發保護）</p>
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">請求次數（1-30）：</span>
                    <Input
                      type="number"
                      className="w-24 h-8 text-sm"
                      value={loadTestCount}
                      onChange={(e) => setLoadTestCount(Number(e.target.value) || 0)}
                      min={1}
                      max={30}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleLoadTest}
                    disabled={loadTestRunning || loadTestCount <= 0}
                  >
                    {loadTestRunning ? '壓測中...' : '開始小壓測'}
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  壓測會使用識別碼 LOADTEST-1 ~ LOADTEST-N 進行實際簽到，建議在測試專用的 Sheet 上使用。
                </p>
                {(loadTestStats.success + loadTestStats.failed + loadTestStats.limited) > 0 && (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p>成功：{loadTestStats.success}</p>
                    <p>失敗：{loadTestStats.failed}</p>
                    <p>被速率限制擋住（429）：{loadTestStats.limited}</p>
                  </div>
                )}
                {loadTestMessage && (
                  <p className="text-xs text-amber-700 mt-1">{loadTestMessage}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">隨機取 N 人實際寫入簽到壓測</p>
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">隨機人數（1 ~ 目前載入人數）：</span>
                    <Input
                      type="number"
                      className="w-24 h-8 text-sm"
                      value={randomWriteCount}
                      onChange={(e) => setRandomWriteCount(Number(e.target.value) || 0)}
                      min={1}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleRandomWriteTest}
                    disabled={randomWriteRunning || (activeTab === 'search' ? searchResults.length === 0 : attendees.length === 0) || randomWriteCount <= 0}
                  >
                    {randomWriteRunning ? '測試中...' : '開始隨機寫入壓測'}
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  會從目前畫面對應的名單來源（搜尋結果或列表）中，隨機選 N 人實際執行簽到，請務必在測試用 Sheet 上操作。
                </p>
                {(randomWriteStats.success + randomWriteStats.failed + randomWriteStats.limited) > 0 && (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p>成功：{randomWriteStats.success}</p>
                    <p>失敗：{randomWriteStats.failed}</p>
                    <p>被速率限制擋住（429）：{randomWriteStats.limited}</p>
                  </div>
                )}
                {randomWriteMessage && (
                  <p className="text-xs text-amber-700 mt-1">{randomWriteMessage}</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">同秒多個不同人併發簽到壓測</p>
                <div className="flex flex-col md:flex-row gap-2 items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">併發人數（1 ~ 未簽到且非 CANCELLED 人數）：</span>
                    <Input
                      type="number"
                      className="w-24 h-8 text-sm"
                      value={concurrentCount}
                      onChange={(e) => setConcurrentCount(Number(e.target.value) || 0)}
                      min={1}
                    />
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleConcurrentTest}
                    disabled={
                      concurrentRunning ||
                      (activeTab === 'search' ? searchResults.length === 0 : attendees.length === 0) ||
                      concurrentCount <= 0
                    }
                  >
                    {concurrentRunning ? '壓測中...' : '開始同秒併發測試'}
                  </Button>
                </div>
                <p className="text-xs text-slate-600">
                  會從目前畫面對應的名單來源（搜尋結果或列表）中，隨機選 N 位「尚未簽到且非 CANCELLED」的參加者，
                  並同時送出簽到請求，用來觀察同一瞬間多列寫入的表現。
                </p>
                {(concurrentStats.success + concurrentStats.failed + concurrentStats.limited) > 0 && (
                  <div className="text-xs text-slate-700 space-y-1">
                    <p>成功：{concurrentStats.success}</p>
                    <p>失敗：{concurrentStats.failed}</p>
                    <p>被速率限制擋住（429）：{concurrentStats.limited}</p>
                  </div>
                )}
                {concurrentMessage && (
                  <p className="text-xs text-amber-700 mt-1">{concurrentMessage}</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
