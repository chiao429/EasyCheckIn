'use client';

import { CraftNav } from '@/components/CraftNav';
import Link from 'next/link';
import { eventTypes } from '@/lib/event-types';
import { FormEvent, useEffect, useRef, useState } from 'react';

type Config = { configId: string; year: string; name: string; configSheetId: string; folderUrl: string; status: string; acceptsCheckins: boolean; createdAt: string; validatedAt: string; publishedBindings: string };

type CreatedEvent = {
  eventId: string;
  configId: string;
  name: string;
  year: string;
  activated: boolean;
  activitySheetUrl: string;
  logSheetUrl: string;
};

export default function YearsPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [password, setPassword] = useState('');
  const [configs, setConfigs] = useState<Config[]>([]);
  const [activeConfigId, setActiveConfigId] = useState('');
  const [driveConnected, setDriveConnected] = useState(false);
  const [year, setYear] = useState('2026');
  const [name, setName] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventYear, setEventYear] = useState('');
  const [eventType, setEventType] = useState<string>(eventTypes[0]);
  const [eventVersion, setEventVersion] = useState<'同工' | '兒童'>('同工');
  const [eventNote, setEventNote] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const loadSequence = useRef(0);
  const [createdEvent, setCreatedEvent] = useState<CreatedEvent | null>(null);
  const successDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = successDialog.current;
    if (createdEvent && dialog && !dialog.open) dialog.showModal();
  }, [createdEvent]);

  async function load() {
    const sequence = ++loadSequence.current;
    try {
      const response = await fetch('/api/admin/years');
      if (sequence !== loadSequence.current) return;
      if (response.status === 401) { setAuthenticated(false); setSessionChecked(true); return; }
      const data = await response.json();
      if (sequence !== loadSequence.current) return;
      setAuthenticated(true);
      if (data.success) {
        setConfigs(data.configs); setActiveConfigId(data.activeConfigId); setDriveConnected(Boolean(data.driveConnected));
        setEventYear((current) => current && data.configs.some((config: Config) => config.year === current)
          ? current
          : data.configs.find((config: Config) => config.configId === data.activeConfigId)?.year || data.configs[0]?.year || '');
      }
      else setMessage(data.message || '無法載入年度設定');
    } catch {
      if (sequence === loadSequence.current) setMessage('無法確認登入狀態，請檢查連線後重新整理');
    } finally {
      if (sequence === loadSequence.current) setSessionChecked(true);
    }
  }
  useEffect(() => {
    void load();
    const result = new URLSearchParams(window.location.search).get('drive');
    if (result) setMessage(({ connected: 'Google 帳號已連結，可在有權限的年度資料夾建立試算表。', cancelled: '已取消 Google 授權。', failed: 'Google 帳號連結失敗，請確認 OAuth 設定及登記表寫入權限。', 'state-error': '授權狀態驗證失敗，請重新連結。', 'login-required': '請先登入年度管理後再連結 Google 帳號。' } as Record<string, string>)[result] || 'Google 帳號連結狀態已更新。');
  }, []);

  async function submit(action: string, fields: Record<string, string | boolean> = {}) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/admin/years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...fields }) });
      const data = await response.json();
      if (!response.ok || !data.success) setMessage(data.validation?.errors?.join('；') || data.message || '操作失敗');
      else {
        if (action === 'create-event') {
          setCreatedEvent({
            eventId: data.eventId,
            configId: data.configId,
            name: String(fields.eventName || '').trim(),
            year: data.year,
            activated: data.activated,
            activitySheetUrl: data.activitySheetUrl,
            logSheetUrl: data.logSheetUrl,
          });
          setEventName('');
        } else {
          setMessage(action === 'validate' ? `驗證通過，共 ${data.validation.activityCount} 個活動` : action === 'activate' ? '年度已啟用' : action === 'checkins' ? '簽到設定已更新' : action === 'archive-config' ? '年度設定已封存' : action === 'rename-config' ? '年度名稱已更新' : action === 'delete-config' ? data.message || '年度登記已刪除' : `年度草稿已新增，活動設定表 ID：${data.configSheetId}`);
        }
        await load();
      }
    } catch { setMessage('連線失敗，請稍後重試'); }
    finally { setBusy(false); }
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/admin/years', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', password }) });
    const data = await response.json();
    if (!data.success) { setMessage(data.message || '登入失敗'); return; }
    if (new URLSearchParams(window.location.search).get('next') === 'activities') {
      window.location.assign('/activities');
      return;
    }
    setAuthenticated(true); setPassword(''); await load();
  }

  const activeConfig = configs.find((config) => config.configId === activeConfigId);
  const yearOptions = Array.from(new Set(configs.map((config) => config.year))).filter(Boolean);

  return <main className="craft craft-years">
    <CraftNav working={authenticated} />
    <div className="craft-content">
    <header className="mb-8"><h1 className="mt-2 text-3xl font-bold">年度設定</h1><p className="mt-2 text-slate-600">登記活動設定表，驗證後切換首頁使用的年度。</p></header>
    {!sessionChecked ? <p role="status" className="rounded-xl border bg-white p-6 text-slate-600">正在確認年度管理登入狀態…</p> : !authenticated ? <form onSubmit={login} className="max-w-md rounded-xl border bg-white p-6 shadow-sm"><label className="block text-sm font-medium">年度管理密碼<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-md border px-3 py-2" required /></label><button disabled={busy} className="mt-4 rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">登入</button></form> : <>
      <section className="mb-8 rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">新增年度</h2><p className="mt-1 text-sm text-slate-600">系統會在年度資料夾新增活動設定表，並建立同工及兒童活動欄位。</p><div className="mt-4 flex flex-wrap items-center gap-3"><span className={`text-sm ${driveConnected ? 'text-emerald-700' : 'text-amber-700'}`}>Google Drive：{driveConnected ? '已連結' : '尚未連結'}</span>{!driveConnected && <a href="/api/admin/years/oauth" className="rounded-md border px-3 py-2 text-sm font-medium">連結 Google 帳號</a>}</div><form onSubmit={(event) => { event.preventDefault(); void submit('create', { year, name, folderUrl }); }} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">年度<input value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" required /></label><label className="text-sm">顯示名稱<input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
        <label className="text-sm md:col-span-2">年度 Drive 資料夾連結<input value={folderUrl} onChange={(e) => setFolderUrl(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
        <button disabled={busy || !driveConnected} className="w-fit rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">新增草稿</button></form>{!driveConnected && <p className="mt-3 text-sm text-slate-500">先連結有權限在目標年度資料夾新增檔案的 Google 帳號。</p>}</section>
      <section id="new-activity" className="mb-8 rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-semibold">新增活動</h2><p className="mt-1 text-sm text-slate-600">先選已登記年度，每次建立一個活動、出席名單和操作紀錄。選目前啟用年度時會切換到新版設定；選其他年度則只建立已驗證版本，不影響首頁年度。</p><p className="mt-3 text-sm text-slate-700">目前首頁年度：{activeConfig ? `${activeConfig.year} · ${activeConfig.name}` : '尚無已啟用年度'}</p><form onSubmit={(event) => { event.preventDefault(); void submit('create-event', { year: eventYear, eventName, version: eventVersion, eventType, note: eventNote }); }} className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm">已登記年度<select value={eventYear} onChange={(e) => setEventYear(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" required disabled={!yearOptions.length}><option value="" disabled>請選擇年度</option>{yearOptions.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label className="text-sm">活動名稱<input value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={100} className="mt-1 w-full rounded-md border px-3 py-2" required /></label>
        <label className="text-sm">類型<select value={eventType} onChange={(e) => { const type = e.target.value; setEventType(type); if (type !== '其他') setEventVersion(type === '兒童聖誕午會' ? '兒童' : '同工'); }} className="mt-1 w-full rounded-md border px-3 py-2">{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
        <label className="text-sm">活動版本<select disabled={eventType !== '其他'} value={eventVersion} onChange={(e) => setEventVersion(e.target.value as '同工' | '兒童')} className="mt-1 w-full rounded-md border px-3 py-2"><option value="同工">同工版</option><option value="兒童">兒童版</option></select></label>
        <label className="text-sm md:col-span-2">備註（選填）<input value={eventNote} onChange={(e) => setEventNote(e.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
        <button disabled={busy || !driveConnected || !eventYear} className="w-fit rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">建立一個活動與試算表</button></form>{!driveConnected && <p className="mt-3 text-sm text-amber-700">請先完成 Google Drive 連結。</p>}{!yearOptions.length && <p className="mt-3 text-sm text-amber-700">請先新增年度設定，才能選擇年度建立活動。</p>}</section>
      <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="border-b px-6 py-4"><h2 className="text-xl font-semibold">已登記年度</h2><p className="mt-1 text-sm text-slate-600">啟用前會由伺服器重新驗證活動設定表與名單讀取權限。</p></div><div className="divide-y">{configs.map((config) => <article key={config.configId} className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2"><h3 className="font-semibold">{config.year} · {config.name}</h3>{activeConfigId === config.configId && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">目前啟用</span>}</div><p className="mt-1 text-sm text-slate-600">狀態：{config.status === 'validated' ? '已驗證' : config.status === 'active' ? '啟用中' : config.status === 'archived' ? '已封存' : '草稿'}</p></div><div className="flex flex-wrap gap-2"><button disabled={busy} className="craft-ghost" onClick={() => { const next = window.prompt('年度顯示名稱', config.name); if (next?.trim() && next.trim() !== config.name) void submit('rename-config', { configId: config.configId, name: next.trim() }); }}>修改名稱</button>{config.status !== 'archived' && config.publishedBindings && config.configId !== activeConfigId && <button className="craft-ghost" disabled={busy} onClick={() => { if (window.confirm('封存後會停止此設定的報到，並保留歷史紀錄。確定封存？')) void submit('archive-config', { configId: config.configId }); }}>封存</button>}<button onClick={() => void submit('validate', { configId: config.configId })} disabled={busy || config.status === 'archived'} className="rounded-md border px-3 py-2 text-sm font-medium">驗證</button><button onClick={() => void submit('activate', { configId: config.configId, expectedActiveConfigId: activeConfigId })} disabled={busy || config.status !== 'validated' || activeConfigId === config.configId} className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40">啟用／回切</button><button disabled={busy || config.status === 'archived'} className="rounded-md border px-3 py-2 text-sm" onClick={() => void submit('checkins', { configId: config.configId, enabled: !config.acceptsCheckins })}>{config.acceptsCheckins ? '停止接受簽到' : '接受簽到'}</button><button disabled={busy || activeConfigId === config.configId || Boolean(config.publishedBindings)} title={config.publishedBindings ? '已有已驗證活動對應，為保留 QR Code 不可刪除' : activeConfigId === config.configId ? '目前啟用年度不能刪除' : undefined} className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-40" onClick={() => { if (window.confirm(`確定刪除「${config.year} · ${config.name}」的年度登記？只會移除登記，不會刪除 Drive 資料夾或檔案。`)) void submit('delete-config', { configId: config.configId }); }}>刪除登記</button></div></article>)}{configs.length === 0 && <p className="px-6 py-8 text-sm text-slate-600">尚無年度設定。</p>}</div></section>
    </>}{message && <p role="status" className="mt-4 rounded-md bg-slate-100 px-4 py-3 text-sm">{message}</p>}
    </div>
    <dialog
      ref={successDialog}
      aria-labelledby="activity-created-title"
      onClose={() => setCreatedEvent(null)}
      className="m-auto w-11/12 max-w-md rounded-xl border bg-white p-6 text-slate-900 backdrop:bg-stone-900/35"
    >
      {createdEvent && <>
        <h2 id="activity-created-title" className="text-xl font-semibold">活動建立成功</h2>
        <p className="mt-2 break-words">已在 {createdEvent.year} 年度建立「{createdEvent.name}」。</p>
        <p className="mt-2 text-sm text-slate-600">
          {createdEvent.activated ? '首頁已切換至新版設定。' : '已建立年度設定，啟用後會顯示在首頁。'}
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-blue-700">
          <a className="underline" href={createdEvent.activitySheetUrl} target="_blank" rel="noopener noreferrer">開啟出席名單</a>
          <a className="underline" href={createdEvent.logSheetUrl} target="_blank" rel="noopener noreferrer">開啟操作紀錄</a>
        </div>
        <form method="dialog" className="mt-6 flex justify-end">
          <button className="craft-ghost">關閉</button>
          <Link className="craft-primary" href={`/activities?configId=${encodeURIComponent(createdEvent.configId)}&eventId=${encodeURIComponent(createdEvent.eventId)}`}>前往活動</Link>
        </form>
      </>}
    </dialog>
  </main>;
}
