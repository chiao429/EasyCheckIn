'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import { CheckInResultDialog, type CheckInInfo } from '@/components/CheckInDialogs';
import { Ban, Lock, LogOut, MapPin, Phone, RefreshCw, UserCheck, UserX, Users } from 'lucide-react';

interface SquadKid {
  rowIndex: number;
  序號: string;
  姓名: string;
  性別: string;
  年級: string;
  已到: string;
  到達時間: string;
  已聯繫: boolean;
  家長: string;
  電話: string;
  備註: string;
  詳細欄位: { 標題: string; 值: string }[];
}

interface ScheduleItem {
  area: string;
  time: string;
  place: string;
}

type Filter = 'all' | 'pending' | 'arrived' | 'absent';

const REFRESH_MS = 30_000;
const TOKEN_KEY = 'easycheck_kids_squad_token';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
  return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m;
};

export default function KidsSquadPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetId = searchParams.get('sheet') || eventId;
  const settingsKey = `easycheck_kids_squad:${eventId}`;

  const [ready, setReady] = useState(false);
  const [token, setToken] = useState('');
  const [squad, setSquad] = useState('');
  const [leader, setLeader] = useState('');

  // 登入與設定表單
  const [password, setPassword] = useState('');
  const [squadOptions, setSquadOptions] = useState<string[]>([]);
  const [draftSquad, setDraftSquad] = useState('');
  const [draftLeader, setDraftLeader] = useState('');

  const [kids, setKids] = useState<SquadKid[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(false);
  const [busyRow, setBusyRow] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [popup, setPopup] = useState<CheckInInfo[] | null>(null);
  const closePopup = useCallback(() => setPopup(null), []);

  // 讀取這台裝置記住的登入與小隊
  useEffect(() => {
    try {
      setToken(window.localStorage.getItem(TOKEN_KEY) || '');
      const saved = JSON.parse(window.localStorage.getItem(settingsKey) || 'null');
      if (saved?.squad) setSquad(saved.squad);
      if (saved?.leader) setLeader(saved.leader);
      setDraftLeader(saved?.leader || '');
    } catch {
      // 無痕模式等情況讀不到就略過
    }
    setReady(true);
  }, [settingsKey]);

  const logout = (msg?: string) => {
    try {
      window.localStorage.removeItem(TOKEN_KEY);
    } catch {
      // 略過
    }
    setToken('');
    setKids([]);
    setError(msg ?? null);
  };

  const fetchRoster = useCallback(
    async (targetSquad: string) => {
      const response = await fetch(
        `/api/kids/squad/roster?sheetId=${encodeURIComponent(sheetId)}&squad=${encodeURIComponent(targetSquad)}`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' }
      );
      const data = await response.json();
      if (response.status === 401) {
        logout(data.message);
        return null;
      }
      return data;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sheetId, token]
  );

  const load = useCallback(async () => {
    if (!token || !squad) return;
    setLoading(true);
    try {
      const data = await fetchRoster(squad);
      if (!data) return;
      if (!data.success) {
        setError(data.message || '載入失敗');
        return;
      }
      setError(null);
      setKids(data.data.kids || []);
      setSchedule(data.data.schedule || []);
      setNow(new Date());
      setUpdatedAt(new Date().toLocaleTimeString('zh-TW', { hour12: false }));
    } catch {
      setError('網路錯誤，請檢查連線後再試');
    } finally {
      setLoading(false);
    }
  }, [fetchRoster, token, squad]);

  useEffect(() => {
    void load();
    if (!token || !squad) return;
    const t = setInterval(() => void load(), REFRESH_MS);
    return () => clearInterval(t);
  }, [load, token, squad]);

  // 登入後、尚未選小隊：載入小隊清單
  useEffect(() => {
    if (!token || squad) return;
    fetchRoster('')
      .then((data) => data?.success && setSquadOptions(data.data.squads || []))
      .catch(() => setError('網路錯誤，請檢查連線後再試'));
  }, [token, squad, fetchRoster]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch('/api/kids/squad/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!data.success) {
        setError(data.message || '登入失敗');
        return;
      }
      window.localStorage.setItem(TOKEN_KEY, data.token);
      setToken(data.token);
      setPassword('');
    } catch {
      setError('網路錯誤，請檢查連線後再試');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftSquad || !draftLeader.trim()) return;
    const next = { squad: draftSquad, leader: draftLeader.trim() };
    try {
      window.localStorage.setItem(settingsKey, JSON.stringify(next));
    } catch {
      // 略過
    }
    setSquad(next.squad);
    setLeader(next.leader);
    setFilter('all');
  };

  const changeSquad = () => {
    setDraftSquad(squad);
    setSquad('');
    setKids([]);
    setMessage(null);
  };

  const operator = `小隊長 ${leader}`;

  const post = async (url: string, body: Record<string, unknown>) => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId, eventId, operator, ...body }),
    });
    return response.json();
  };

  const runAction = async (kid: SquadKid, action: 'checkin' | 'cancel' | 'absent' | 'restore' | 'contact') => {
    setBusyRow(kid.rowIndex);
    setMessage(null);
    const identifier = kid.序號 || kid.姓名;
    try {
      if (action === 'checkin') {
        const data = await post('/api/kids/checkin', { identifier, attendeeName: kid.姓名, rowIndex: kid.rowIndex });
        if (!data.success) {
          setMessage(`❌ ${kid.姓名}：${data.message || '報到失敗'}`);
        } else {
          setMessage(`✅ ${kid.姓名} 報到成功`);
          setPopup([{ 序號: kid.序號, 姓名: kid.姓名, 到達時間: data.data?.到達時間 || '', 詳細欄位: kid.詳細欄位 }]);
        }
      } else if (action === 'cancel' || action === 'restore') {
        if (action === 'cancel' && !window.confirm(`確定取消 ${kid.姓名} 的報到？`)) return;
        const data = await post('/api/kids/manager/cancel-checkin', { identifier, attendeeName: kid.姓名 });
        setMessage(data.success ? `✅ ${kid.姓名} 已恢復為未報到` : `❌ ${data.message || '操作失敗'}`);
      } else if (action === 'absent') {
        if (!window.confirm(`確定將 ${kid.姓名} 標記為不會出席？`)) return;
        const data = await post('/api/kids/manager/mark-cancelled', { identifier, attendeeName: kid.姓名 });
        setMessage(data.success ? `✅ ${kid.姓名} 已標記為不會出席` : `❌ ${data.message || '操作失敗'}`);
      } else {
        const data = await post('/api/kids/manager/toggle-contact', { identifier, attendeeName: kid.姓名 });
        setMessage(data.success ? `✅ 已更新 ${kid.姓名} 的聯繫狀態` : `❌ ${data.message || '操作失敗'}`);
      }
      await load();
    } catch {
      setMessage('❌ 網路錯誤，請稍後再試');
    } finally {
      setBusyRow(null);
    }
  };

  const counts = useMemo(() => {
    const arrived = kids.filter((k) => k.已到 === 'TRUE').length;
    const absent = kids.filter((k) => k.已到 === 'CANCELLED').length;
    const pendingList = kids.filter((k) => k.已到 !== 'TRUE' && k.已到 !== 'CANCELLED');
    return {
      total: kids.length,
      arrived,
      absent,
      pending: pendingList.length,
      toContact: pendingList.filter((k) => !k.已聯繫).length,
    };
  }, [kids]);

  const visible = useMemo(() => {
    const rank = (k: SquadKid) => (k.已到 === 'TRUE' ? 1 : k.已到 === 'CANCELLED' ? 2 : 0);
    return kids
      .filter((k) =>
        filter === 'arrived'
          ? k.已到 === 'TRUE'
          : filter === 'absent'
            ? k.已到 === 'CANCELLED'
            : filter === 'pending'
              ? k.已到 !== 'TRUE' && k.已到 !== 'CANCELLED'
              : true
      )
      .sort((a, b) => rank(a) - rank(b) || (Number(a.序號) || 0) - (Number(b.序號) || 0));
  }, [kids, filter]);

  const { currentSlot, nextSlot } = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const withMin = schedule
      .map((s) => {
        const [a, b] = s.time.split('-');
        return { ...s, start: toMinutes(a || ''), end: toMinutes(b || '') };
      })
      .filter((s) => s.start !== null && s.end !== null);
    return {
      currentSlot: withMin.find((s) => (s.start as number) <= nowMin && nowMin <= (s.end as number)),
      nextSlot: withMin.find((s) => (s.start as number) > nowMin),
    };
  }, [schedule, now]);

  const statusBadge = (k: SquadKid) => {
    const base = 'inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium';
    if (k.已到 === 'TRUE')
      return (
        <span className={`${base} bg-green-100 text-green-800`}>
          <UserCheck className="mr-1 h-3 w-3" /> 已報到
        </span>
      );
    if (k.已到 === 'CANCELLED')
      return (
        <span className={`${base} bg-amber-100 text-amber-800`}>
          <Ban className="mr-1 h-3 w-3" /> 不會出席
        </span>
      );
    return (
      <span className={`${base} bg-slate-100 text-slate-800`}>
        <UserX className="mr-1 h-3 w-3" /> 未報到
      </span>
    );
  };

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4 md:p-8">
      <div className="mx-auto w-full min-w-0 max-w-2xl flex-1 space-y-4">{children}</div>
      <SiteFooter />
      {popup && <CheckInResultDialog people={popup} onClose={closePopup} />}
    </div>
  );

  if (!ready) return shell(null);

  // 步驟 1：輸入小隊長密碼
  if (!token) {
    return shell(
      <Card className="shadow-md">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Lock className="h-5 w-5" /> 小隊長頁
          </CardTitle>
          <CardDescription>請輸入小隊長密碼。登入後這台裝置會記住 3 天。</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={handleLogin} className="space-y-3">
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="小隊長密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={loading || !password}>
              {loading ? '確認中…' : '進入'}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // 步驟 2：選擇自己的小隊
  if (!squad) {
    return shell(
      <Card className="shadow-md">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Users className="h-5 w-5" /> 選擇你的小隊
          </CardTitle>
          <CardDescription>設定會記在這台裝置，之後打開就直接看到你的小隊。</CardDescription>
        </CardHeader>
        <CardContent className="px-4 sm:px-6">
          <form onSubmit={saveSettings} className="space-y-3">
            <label className="block space-y-1">
              <span className="text-sm font-medium">小隊</span>
              <select
                className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
                value={draftSquad}
                onChange={(e) => setDraftSquad(e.target.value)}
              >
                <option value="">{squadOptions.length ? '請選擇' : '載入中…'}</option>
                {squadOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium">你的名字（記錄在操作日誌）</span>
              <Input value={draftLeader} onChange={(e) => setDraftLeader(e.target.value)} placeholder="例如：王小明" />
            </label>
            {error && <p className="text-sm text-rose-700">{error}</p>}
            <Button type="submit" className="h-11 w-full" disabled={!draftSquad || !draftLeader.trim()}>
              開始
            </Button>
            <button type="button" className="w-full text-center text-sm text-slate-500 underline" onClick={() => logout()}>
              登出
            </button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // 步驟 3：小隊狀況與操作
  const filters: { key: Filter; label: string; n: number }[] = [
    { key: 'all', label: '全部', n: counts.total },
    { key: 'pending', label: '未報到', n: counts.pending },
    { key: 'arrived', label: '已報到', n: counts.arrived },
    { key: 'absent', label: '不會出席', n: counts.absent },
  ];

  return shell(
    <>
      <Card className="shadow-md">
        <CardHeader className="px-4 pb-3 sm:px-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <CardTitle className="text-2xl sm:text-3xl">
                小隊 <span className="text-red-600">{squad}</span>
              </CardTitle>
              <CardDescription>小隊長：{leader}</CardDescription>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <Button variant="outline" size="sm" onClick={changeSquad}>
                切換小隊
              </Button>
              <button type="button" className="inline-flex items-center text-xs text-slate-500" onClick={() => logout()}>
                <LogOut className="mr-1 h-3 w-3" /> 登出
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 px-4 sm:px-6">
          {(currentSlot || nextSlot) && (
            <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-sm">
              <p className="flex items-center gap-1 font-medium text-sky-900">
                <MapPin className="h-4 w-4" /> 目前位置
              </p>
              {currentSlot ? (
                <p className="mt-1 text-base font-semibold text-red-700">
                  {currentSlot.time}　{currentSlot.place}
                  {currentSlot.area && <span className="ml-1 text-xs font-normal text-slate-600">（{currentSlot.area}）</span>}
                </p>
              ) : (
                <p className="mt-1 text-slate-600">目前沒有進行中的時段</p>
              )}
              {nextSlot && (
                <p className="mt-1 text-slate-700">
                  下一站：{nextSlot.time}　{nextSlot.place}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="rounded-md bg-slate-100 p-2">
              <div className="text-xs text-slate-600">總人數</div>
              <div className="text-2xl font-bold tabular-nums">{counts.total}</div>
            </div>
            <div className="rounded-md bg-green-100 p-2">
              <div className="text-xs text-green-800">已報到</div>
              <div className="text-2xl font-bold tabular-nums text-green-800">{counts.arrived}</div>
            </div>
            <div className="rounded-md bg-rose-100 p-2">
              <div className="text-xs text-rose-800">未報到</div>
              <div className="text-2xl font-bold tabular-nums text-rose-800">{counts.pending}</div>
            </div>
            <div className="rounded-md bg-amber-100 p-2">
              <div className="text-xs text-amber-800">不會出席</div>
              <div className="text-2xl font-bold tabular-nums text-amber-800">{counts.absent}</div>
            </div>
          </div>
          {counts.pending > 0 && (
            <p className="text-xs text-slate-600">
              未報到中：待聯繫 {counts.toContact} 位、已聯繫 {counts.pending - counts.toContact} 位
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {filters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => setFilter(f.key)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    filter === f.key ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {f.label} {f.n}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} aria-label="重新整理">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {message && <p className="text-sm text-slate-700">{message}</p>}
          {error && <p className="text-sm text-rose-700">{error}</p>}
        </CardContent>
      </Card>

      <div className="space-y-2">
        {visible.map((k) => {
          const busy = busyRow === k.rowIndex;
          const arrived = k.已到 === 'TRUE';
          const absent = k.已到 === 'CANCELLED';
          return (
            <div key={k.rowIndex} className="rounded-lg border bg-white p-3 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">
                    <span className="mr-2 text-sm font-normal text-slate-500">#{k.序號}</span>
                    {k.姓名}
                    {(k.性別 || k.年級) && (
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        {[k.性別, k.年級].filter(Boolean).join('・')}
                      </span>
                    )}
                  </p>
                  {arrived && <p className="text-xs text-slate-500">報到時間：{k.到達時間}</p>}
                </div>
                {statusBadge(k)}
              </div>

              <div className="mt-1 space-y-0.5 text-sm text-slate-700">
                {(k.家長 || k.電話) && (
                  <p className="flex flex-wrap items-center gap-x-2">
                    <span>家長：{k.家長 || '—'}</span>
                    {k.電話 && (
                      <a href={`tel:${k.電話}`} className="inline-flex items-center text-blue-700 underline">
                        <Phone className="mr-1 h-3 w-3" />
                        {k.電話}
                      </a>
                    )}
                    {!arrived && !absent && (
                      <span className={`text-xs ${k.已聯繫 ? 'text-green-700' : 'text-rose-700'}`}>
                        {k.已聯繫 ? '✓ 已聯繫' : '待聯繫'}
                      </span>
                    )}
                  </p>
                )}
                {k.備註 && <p className="text-xs text-amber-800">備註：{k.備註}</p>}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 border-t pt-2 sm:flex sm:flex-wrap">
                {arrived ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => runAction(k, 'cancel')}>
                    取消報到
                  </Button>
                ) : absent ? (
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => runAction(k, 'restore')}>
                    恢復為未報到
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      disabled={busy}
                      onClick={() => runAction(k, 'checkin')}
                    >
                      {busy ? '處理中…' : '報到'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-amber-300 text-amber-700 hover:bg-amber-50"
                      disabled={busy}
                      onClick={() => runAction(k, 'absent')}
                    >
                      不會出席
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="col-span-2 sm:col-span-1"
                      disabled={busy}
                      onClick={() => runAction(k, 'contact')}
                    >
                      {k.已聯繫 ? '改為待聯繫' : '標記已聯繫'}
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
        {visible.length === 0 && !loading && <p className="py-6 text-center text-sm text-slate-500">沒有符合的隊員</p>}
      </div>
      <p className="text-center text-xs text-slate-400">每 30 秒自動更新・{updatedAt}</p>
    </>
  );
}
