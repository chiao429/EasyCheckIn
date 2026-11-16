'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';

export function ActivityActions({ eventId, configId, open, draft }: { eventId: string; configId: string; open: boolean; draft: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function change(state: 'open' | 'closed' | 'archived' | 'deleted') {
    if (state === 'archived' && !window.confirm('封存後會停止報到，並保留出席紀錄。確定封存？')) return;
    if (state === 'deleted' && !window.confirm('確定從活動列表移除此草稿？')) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/admin/years', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'activity-state', eventId, configId, state }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || '無法更新活動狀態');
      if (state === 'deleted') router.replace(`/activities?configId=${encodeURIComponent(configId)}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '無法更新活動狀態');
    } finally {
      setBusy(false);
    }
  }

  return <div className="craft-actions mt-4">
    <button className="craft-ghost" disabled={busy} onClick={() => void change(open ? 'closed' : 'open')}>
      {open ? '關閉報到' : '開放報到'}
    </button>
    <button className="craft-ghost" disabled={busy} onClick={() => void change('archived')}>封存活動</button>
    {draft && <button className="craft-ghost" disabled={busy} onClick={() => void change('deleted')}>刪除草稿</button>}
    {message && <p role="alert">{message}</p>}
  </div>;
}

export function PrintActivityCode() {
  return <button className="craft-ghost" onClick={() => window.print()}>列印 QR Code</button>;
}

export function EditActivity({ eventId, configId, name, note }: {
  eventId: string; configId: string; name: string; note: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <details className="craft-panel mt-4" key={JSON.stringify([name, note])}>
    <summary className="cursor-pointer">活動設定</summary>
    <form className="craft-list" onSubmit={async (event) => {
      event.preventDefault();
      const fields = new FormData(event.currentTarget);
      setBusy(true);
      setMessage('');
      try {
        const response = await fetch('/api/admin/years', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit-activity', eventId, configId, name: fields.get('name'), note: fields.get('note') }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || '儲存失敗');
        setMessage('活動設定已儲存');
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '儲存失敗');
      } finally {
        setBusy(false);
      }
    }}>
      <label className="grid gap-2">活動名稱<input name="name" defaultValue={name} required maxLength={100} className="craft-input" /></label>
      <label className="grid gap-2">備註<input name="note" defaultValue={note} maxLength={500} className="craft-input" /></label>
      <button className="craft-primary w-fit" disabled={busy}>{busy ? '儲存中…' : '儲存設定'}</button>
      {message && <p role="status">{message}</p>}
    </form>
  </details>;
}

export function CopyActivityEntry({ href, label, activityName, className = 'craft-ghost', buttonText = '複製連結' }: {
  href: string;
  label: string;
  activityName: string;
  className?: string;
  buttonText?: string;
}) {
  const [status, setStatus] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function notify(message: string) {
    setStatus(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setStatus(''), 2200);
  }

  return <>
    <button type="button" className={className} onClick={async () => {
      try {
        const link = new URL(href, window.location.origin).href;
        await navigator.clipboard.writeText(`${activityName}-${label}\n${link}`);
        notify('連結已複製');
      } catch {
        notify('無法複製連結，請開啟頁面後複製網址');
      }
    }}>{buttonText}</button>
    {status && typeof document !== 'undefined' && createPortal(
      <div className="copy-toast" role="status" aria-live="polite" aria-atomic="true">{status}</div>,
      document.body,
    )}
  </>;
}
