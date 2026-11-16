'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

type Props = { eventId: string; configId?: string; version: '同工' | '兒童' };

export function AttendeeImport({ eventId, configId, version }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  function downloadTemplate() {
    void fetch(`/api/admin/import-attendees?template=${encodeURIComponent(version)}&eventId=${encodeURIComponent(eventId)}&configId=${encodeURIComponent(configId || '')}`)
      .then(async (response) => {
        if (!response.ok) throw new Error('範本下載失敗');
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url;
        link.download = `${version}版名單匯入範本.xlsx`;
        link.click();
        URL.revokeObjectURL(url);
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : '範本下載失敗'));
  }

  async function importFile(file?: File) {
    if (!file) return;
    if (!window.confirm('匯入會完整取代此活動名單的現有資料，包含簽到狀態與紀錄。確定繼續嗎？')) {
      if (input.current) input.current.value = '';
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const form = new FormData();
      form.set('file', file);
      form.set('eventId', eventId);
      form.set('version', version);
      if (configId) form.set('configId', configId);
      const response = await fetch('/api/admin/import-attendees', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || '匯入失敗');
      setMessage(`成功匯入 ${result.importedCount} 筆，重新整理頁面以載入名單。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '匯入失敗');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={downloadTemplate}>下載{version}版範本</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? '匯入中…' : '匯入名單 XLSX'}
      </Button>
      <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(event) => void importFile(event.target.files?.[0])} />
      {message && <span role="status" className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}
