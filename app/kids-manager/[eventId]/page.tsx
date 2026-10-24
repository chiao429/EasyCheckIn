'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SiteFooter } from '@/components/SiteFooter';
import {
  CheckInResultDialog,
  FamilyPickDialog,
  type CheckInInfo,
  type FamilyCandidate,
} from '@/components/CheckInDialogs';
import { Search, UserCheck, UserX, Ban, MapPin, Eraser, Keyboard, Delete } from 'lucide-react';

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

interface SquadScheduleItem {
  area?: string;
  time: string;
  place: string;
}

type SquadScheduleMap = Record<string, SquadScheduleItem[]>;

export default function KidsManagerPage() {
  const params = useParams();
  const eventId = params.eventId as string;
  const searchParams = useSearchParams();
  const sheetFromQuery = searchParams.get('sheet');

  const [now, setNow] = useState<Date>(() => new Date());

  const [keyword, setKeyword] = useState('');
  const [staffName, setStaffName] = useState('');
  const [results, setResults] = useState<Attendee[]>([]);
  const [selected, setSelected] = useState<Attendee | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // 報到成功的報名資訊視窗、同一家庭一起報到
  const [popup, setPopup] = useState<CheckInInfo[] | null>(null);
  const [family, setFamily] = useState<FamilyCandidate[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const closePopup = useCallback(() => setPopup(null), []);
  // 最近的報到紀錄：最新在前，最多保留 3 筆（存在這台裝置的瀏覽器）
  const HISTORY_LIMIT = 3;
  type CheckInRecord = { 時間: string; 操作人員: string; people: CheckInInfo[]; 不會出席?: string[] };
  const lastKey = `easycheck_kids_last_checkin:${eventId}`;
  const [history, setHistory] = useState<CheckInRecord[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(lastKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // 舊版只存一筆物件，轉成陣列
      setHistory((Array.isArray(parsed) ? parsed : [parsed]).slice(0, HISTORY_LIMIT));
    } catch {
      // 無痕模式等情況讀不到就略過
    }
  }, [lastKey]);
  const rememberCheckIn = (people: CheckInInfo[], absent: string[] = []) => {
    const record: CheckInRecord = {
      時間: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }),
      操作人員: staffName,
      people,
      ...(absent.length ? { 不會出席: absent } : {}),
    };
    setHistory((prev) => {
      const next = [record, ...prev].slice(0, HISTORY_LIMIT);
      try {
        window.localStorage.setItem(lastKey, JSON.stringify(next));
      } catch {
        // 略過
      }
      return next;
    });
  };
  const searchInputRef = useRef<HTMLInputElement>(null);
  // 數字鍵盤（快速輸入序號），展開狀態記在這台裝置
  const KEYPAD_KEY = 'easycheck_kids_manager_keypad';
  const [showKeypad, setShowKeypad] = useState(false);
  useEffect(() => {
    try {
      setShowKeypad(window.localStorage.getItem(KEYPAD_KEY) === '1');
    } catch {
      // 略過
    }
  }, []);
  const toggleKeypad = () => {
    setShowKeypad((v) => {
      try {
        window.localStorage.setItem(KEYPAD_KEY, v ? '0' : '1');
      } catch {
        // 略過
      }
      return !v;
    });
  };

  const [squadSchedule, setSquadSchedule] = useState<SquadScheduleMap | null>(null);
  const [squadLookupLoading, setSquadLookupLoading] = useState(false);
  const [squadLookupError, setSquadLookupError] = useState<string | null>(null);
  const [squadLookupResult, setSquadLookupResult] = useState<SquadScheduleItem[] | null>(null);

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

  const getSquadCodeFromSelected = (attendee: Attendee | null) => {
    if (!attendee || !attendee.詳細欄位 || attendee.詳細欄位.length === 0) return '';
    const first = attendee.詳細欄位[0];
    return (first?.值 || '').toString().trim();
  };

  // 小隊時間表：優先讀活動試算表的「小隊時間表」分頁，沒有分頁時用 public/groupSchedule.json
  // 快取 30 秒，試算表修改後很快就會生效
  const [scheduleLoadedAt, setScheduleLoadedAt] = useState(0);
  const loadSquadScheduleIfNeeded = async () => {
    if (squadSchedule && Date.now() - scheduleLoadedAt < 30_000) return squadSchedule;
    setSquadLookupLoading(true);
    setSquadLookupError(null);
    try {
      const response = await fetch(`/api/kids/schedule?sheetId=${encodeURIComponent(effectiveSheetId)}`);
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.message || `讀取小隊地點資料失敗（HTTP ${response.status}）`);
      }
      let data = result.data as SquadScheduleMap | null;
      if (result.source === 'file') {
        const fileResponse = await fetch('/groupSchedule.json');
        if (!fileResponse.ok) throw new Error(`讀取小隊地點資料失敗（HTTP ${fileResponse.status}）`);
        data = (await fileResponse.json()) as SquadScheduleMap;
      }
      setSquadSchedule(data);
      setScheduleLoadedAt(Date.now());
      return data;
    } catch (error) {
      console.error('Load squad schedule error:', error);
      setSquadLookupError(
        error instanceof Error && error.message ? error.message : '讀取小隊地點資料失敗，請確認「小隊時間表」分頁格式正確'
      );
      return squadSchedule;
    } finally {
      setSquadLookupLoading(false);
    }
  };

  const handleSquadLookup = async (code: string) => {
    setNow(new Date());
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setSquadLookupError('此兒童尚未填寫小隊代碼');
      setSquadLookupResult(null);
      return;
    }

    setSquadLookupError(null);
    setSquadLookupResult(null);

    const scheduleMap = await loadSquadScheduleIfNeeded();
    if (!scheduleMap) return;

    const result = scheduleMap[normalized];
    if (!result || result.length === 0) {
      setSquadLookupError(`查無小隊「${normalized}」的地點資料`);
      return;
    }
    setSquadLookupResult(result);
  };

  const toMinutesOfDay = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  const isNowInTimeRange = (range: string) => {
    const [startRaw, endRaw] = range.split('-').map((s) => s.trim());
    if (!startRaw || !endRaw) return false;
    const startMin = toMinutesOfDay(startRaw);
    const endMin = toMinutesOfDay(endRaw);
    if (startMin === null || endMin === null) return false;

    const nowMin = now.getHours() * 60 + now.getMinutes();
    return nowMin >= startMin && nowMin <= endMin;
  };

  // 清空搜尋，準備下一筆
  const resetSearch = () => {
    setKeyword('');
    setResults([]);
    setSelected(null);
    setShowDetails(false);
    setSquadLookupResult(null);
    setSquadLookupError(null);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  type FamilyApiMember = {
    rowIndex: number;
    序號: string;
    姓名: string;
    已到: string;
    到達時間: string;
    小隊: string;
    詳細欄位: KidsDetailField[];
  };

  const fetchHousehold = async (rowIndex: number): Promise<Attendee[]> => {
    const res = await fetch('/api/kids/family', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId: effectiveSheetId, rowIndex }),
    });
    const data = await res.json();
    if (!data.success || data.data.others.length === 0) return [];
    return ([data.data.main, ...data.data.others] as FamilyApiMember[])
      .map(({ 小隊: _小隊, ...m }) => m)
      .sort((a, b) => (Number(a.序號) || 0) - (Number(b.序號) || 0));
  };

  // 代為報到：同一戶有其他兄弟姊妹時讓工作人員勾選一起報到
  const handleManagerCheckIn = async () => {
    if (!selected || !effectiveSheetId) return;
    if (selected.已到 === 'TRUE') {
      setMessage(`❌ ${selected.姓名} 已於 ${selected.到達時間} 報到，不可重複報到`);
      return;
    }
    if (typeof selected.rowIndex === 'number') {
      setActionLoading(true);
      setMessage(null);
      try {
        const members = await fetchHousehold(selected.rowIndex);
        if (members.length > 1) {
          const list: FamilyCandidate[] = members.map((m) => ({
            rowIndex: m.rowIndex as number,
            序號: m.序號,
            姓名: m.姓名,
            已到: m.已到,
            到達時間: m.到達時間,
            備註: m.詳細欄位?.[0]?.值 ? `小隊 ${m.詳細欄位[0].值}` : undefined,
          }));
          setFamily(list);
          setPicked(new Set(list.filter((m) => m.已到 !== 'TRUE').map((m) => m.rowIndex)));
          setActionLoading(false);
          return;
        }
      } catch (error) {
        // 查不到家人時直接走單人報到
        console.error('Kids family lookup error:', error);
      }
      setActionLoading(false);
    }
    await checkInSelectedOnly();
  };

  const handleFamilyCheckIn = async () => {
    if (!family || !selected) return;
    const targets = family.filter((m) => picked.has(m.rowIndex)).map((m) => ({ rowIndex: m.rowIndex, 姓名: m.姓名 }));
    if (targets.length === 0) return;
    // 同戶未勾選（且尚未報到）的孩子視為缺席，標記為不會出席
    const absentTargets = family
      .filter((m) => !picked.has(m.rowIndex) && m.已到 !== 'TRUE')
      .map((m) => ({ rowIndex: m.rowIndex, 姓名: m.姓名 }));
    setActionLoading(true);
    try {
      const res = await fetch('/api/kids/checkin/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sheetId: effectiveSheetId, targets, absentTargets, eventId, operator: staffName }),
      });
      const data = await res.json();
      const skippedText = (data.skipped || []).map((x: { 姓名: string; reason: string }) => `${x.姓名}：${x.reason}`).join('；');
      setFamily(null);
      if (data.success) {
        const absentNames: string[] = (data.markedAbsent || []).map((a: { 姓名: string }) => a.姓名);
        setMessage(
          `✅ 已由工作人員代為報到 ${data.data.length} 位（兒童）` +
            (absentNames.length ? `；標記不會出席：${absentNames.join('、')}` : '') +
            (skippedText ? `；${skippedText}` : '')
        );
        setPopup(data.data as CheckInInfo[]);
        rememberCheckIn(data.data as CheckInInfo[], absentNames);
        resetSearch();
      } else {
        setMessage(`❌ 報到失敗：${data.message || '未知錯誤'}`);
      }
    } catch (error) {
      console.error('Kids family check-in error:', error);
      setMessage('❌ 代為報到時發生錯誤');
    } finally {
      setActionLoading(false);
    }
  };

  const checkInSelectedOnly = async () => {
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
        const people: CheckInInfo[] = [
          {
            序號: selected.序號,
            姓名: selected.姓名,
            到達時間: data.data?.到達時間 || '',
            詳細欄位: selected.詳細欄位,
          },
        ];
        setPopup(people);
        rememberCheckIn(people);
        resetSearch();
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

  const handleSearch = () => searchFor(keyword);

  const searchFor = async (keyword: string) => {
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
        <span className="inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <UserCheck className="w-3 h-3 mr-1" /> 已報到
        </span>
      );
    }
    if (attendee.已到 === 'CANCELLED') {
      return (
        <span className="inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
          <Ban className="w-3 h-3 mr-1" /> 不會出席
        </span>
      );
    }
    return (
      <span className="inline-flex shrink-0 items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
        <UserX className="w-3 h-3 mr-1" /> 未報到
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4 md:p-8 flex flex-col">
      <div className="w-full max-w-2xl mx-auto space-y-6 flex-1 min-w-0">
        <Card className="shadow-md">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle className="text-xl sm:text-2xl">兒童 Manager（現場工作人員工具）</CardTitle>
            <CardDescription>
              給現場工作人員使用的兒童報到介面，用來協助快速查詢與報到。
              <br />
              <span className="text-amber-600 font-medium">第一次查詢會比較久，請稍等。</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-4 sm:px-6">
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
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-sm font-medium">搜尋序號或兒童姓名</label>
                    <Button type="button" variant="outline" size="sm" onClick={toggleKeypad} aria-expanded={showKeypad}>
                      <Keyboard className="w-4 h-4 mr-1" />
                      {showKeypad ? '收起鍵盤' : '數字鍵盤'}
                    </Button>
                  </div>
                  {showKeypad && (
                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mx-auto" aria-label="數字鍵盤">
                      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                        <Button
                          key={d}
                          type="button"
                          variant="outline"
                          className="h-14 text-2xl font-semibold"
                          onClick={() => setKeyword((k) => k + d)}
                        >
                          {d}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14"
                        aria-label="刪除一個字"
                        onClick={() => setKeyword((k) => k.slice(0, -1))}
                      >
                        <Delete className="w-6 h-6" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-14 text-2xl font-semibold"
                        onClick={() => setKeyword((k) => k + '0')}
                      >
                        0
                      </Button>
                      <Button
                        type="button"
                        className="h-14 text-lg font-semibold"
                        disabled={loading || !keyword.trim()}
                        onClick={handleSearch}
                      >
                        確認
                      </Button>
                    </div>
                  )}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                      ref={searchInputRef}
                      placeholder="請輸入報名序號或姓名"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
                    <Button onClick={handleSearch} disabled={loading}>
                      <Search className="w-4 h-4 mr-1" />
                      {loading ? '搜尋中...' : '搜尋'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        resetSearch();
                        setMessage(null);
                      }}
                      disabled={loading || actionLoading}
                    >
                      <Eraser className="w-4 h-4 mr-1" />
                      清空
                    </Button>
                    </div>
                  </div>
                  <div className="text-xs text-slate-600 space-y-0.5 pl-1">
                    <p>• 序號請輸入完整序號</p>
                    <p>• 姓名支援輸入關鍵字查詢</p>
                  </div>
                </div>

                {staffName.trim() && selected && (
                  <div className="mt-4 p-3 sm:p-4 rounded-md border bg-white space-y-3">
                    <div className="flex items-start justify-between gap-2">
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

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t mt-2 sm:flex sm:flex-wrap">
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

                      <Button
                        variant="outline"
                        size="sm"
                        className="border-slate-300 text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          const fromSelected = getSquadCodeFromSelected(selected);
                          handleSquadLookup(fromSelected);
                        }}
                        disabled={squadLookupLoading}
                      >
                        <MapPin className="w-4 h-4 mr-1" />
                        {squadLookupLoading ? '查詢中...' : '查詢小隊地點'}
                      </Button>
                    </div>

                    {(squadLookupError || squadLookupResult) && (
                      <div className="pt-3 border-t space-y-2">
                        {squadLookupError && (
                          <p className="text-xs text-rose-700 whitespace-pre-line">{squadLookupError}</p>
                        )}

                        {squadLookupResult && (
                          <div className="border rounded-md bg-white">
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead className="bg-slate-50 text-slate-600">
                                  <tr className="text-left">
                                    <th className="px-2 sm:px-3 py-2 font-medium whitespace-nowrap">區域</th>
                                    <th className="px-2 sm:px-3 py-2 font-medium whitespace-nowrap">時間</th>
                                    <th className="px-2 sm:px-3 py-2 font-medium">地點</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y">
                                  {squadLookupResult.map((item, idx) => {
                                    const isNow = isNowInTimeRange(item.time);
                                    return (
                                      <tr
                                        key={`${item.time}-${idx}`}
                                        className={isNow ? 'bg-red-50 text-red-700' : 'text-slate-800'}
                                      >
                                        <td className="px-2 sm:px-3 py-2 align-top whitespace-nowrap">
                                          {item.area || '-'}
                                        </td>
                                        <td className={`px-2 sm:px-3 py-2 align-top whitespace-nowrap ${isNow ? 'font-semibold' : ''}`}>
                                          {item.time}
                                        </td>
                                        <td className={`px-2 sm:px-3 py-2 align-top ${isNow ? 'font-semibold' : 'text-slate-700'}`}>
                                          <span className="break-words">{item.place}</span>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

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

                {history.length > 0 && (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                    <p className="text-xs font-medium text-emerald-800">最近報到紀錄（最多 {HISTORY_LIMIT} 筆）</p>
                    <ol className="mt-1 divide-y divide-emerald-100">
                      {history.map((record, ri) => (
                        <li key={ri} className="py-1.5">
                          <p className="text-xs text-emerald-700">
                            {record.時間}
                            {record.操作人員 ? `・${record.操作人員}` : ''}
                            {record.people.length > 1 ? `・${record.people.length} 位` : ''}
                          </p>
                          <ul className="space-y-0.5">
                            {record.people.map((p) => (
                              <li key={`${p.序號}-${p.姓名}`}>
                                <button
                                  type="button"
                                  className="text-sm text-slate-800 hover:underline"
                                  title="點選重新查詢這位兒童"
                                  onClick={() => {
                                    setKeyword(p.序號 || p.姓名);
                                    void searchFor(p.序號 || p.姓名);
                                  }}
                                >
                                  <span className="font-medium mr-2">{p.序號}</span>
                                  {p.姓名}
                                  {p.詳細欄位?.[0]?.值 && (
                                    <span className="ml-2 text-xs text-slate-500">{p.詳細欄位[0].值}</span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                          {record.不會出席 && record.不會出席.length > 0 && (
                            <p className="text-xs text-amber-700">不會出席：{record.不會出席.join('、')}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
      <SiteFooter />

      {family && (
        <FamilyPickDialog
          members={family}
          picked={picked}
          loading={actionLoading}
          hint="以下是同一個家長電話的兄弟姊妹，請勾選今天有來的孩子。"
          uncheckedNote="未勾選的孩子會標記為「不會出席」"
          onToggle={(rowIndex, checked) => {
            const next = new Set(picked);
            if (checked) next.add(rowIndex);
            else next.delete(rowIndex);
            setPicked(next);
          }}
          onConfirm={handleFamilyCheckIn}
          onCancel={() => setFamily(null)}
        />
      )}

      {popup && <CheckInResultDialog people={popup} onClose={closePopup} />}
    </div>
  );
}
