'use client';

import { useEffect } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface CheckInInfo {
  序號: string;
  姓名: string;
  到達時間: string;
  詳細欄位?: { 標題: string; 值: string }[];
}

export interface FamilyCandidate {
  rowIndex: number;
  序號: string;
  姓名: string;
  已到: string;
  到達時間: string;
  /** 補充說明，例如所屬小隊 */
  備註?: string;
}

/** 報到成功後顯示報名資訊（可多位） */
export function CheckInResultDialog({ people, onClose }: { people: CheckInInfo[]; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Enter') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (people.length === 0) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkin-result-title"
    >
      <div
        className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <CheckCircle2 className="h-14 w-14 text-green-600" />
          <p id="checkin-result-title" className="mt-2 text-lg font-semibold text-green-700">
            報到成功{people.length > 1 ? `（${people.length} 位）` : ''}
          </p>
          {people.length === 1 && <p className="mt-1 text-3xl font-bold text-gray-900">{people[0].姓名}</p>}
        </div>

        {people.map((p) => (
          <dl key={`${p.序號}-${p.姓名}`} className="mt-4 space-y-2 rounded-lg bg-gray-50 p-4 text-sm">
            {people.length > 1 && <p className="text-xl font-bold text-gray-900">{p.姓名}</p>}
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">序號</dt>
              <dd className="font-medium text-gray-900">{p.序號 || '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-gray-500">報到時間</dt>
              <dd className="font-medium text-gray-900">{p.到達時間}</dd>
            </div>
            {p.詳細欄位
              ?.filter((f) => f.標題.trim() !== '' && f.值.trim() !== '')
              .map((f) => (
                <div key={f.標題} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-gray-500">{f.標題}</dt>
                  <dd className="text-right font-medium text-gray-900">{f.值}</dd>
                </div>
              ))}
          </dl>
        ))}

        <Button className="mt-5 h-12 w-full text-lg" onClick={onClose} autoFocus>
          確定
        </Button>
      </div>
    </div>
  );
}

/** 同一聯絡電話的家人：勾選後一起報到 */
export function FamilyPickDialog({
  members,
  picked,
  onToggle,
  onConfirm,
  onCancel,
  loading,
  hint = '以下是同一個聯絡電話的家人，請勾選今天有來的人。',
  uncheckedNote,
}: {
  members: FamilyCandidate[];
  picked: Set<number>;
  onToggle: (rowIndex: number, checked: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  hint?: string;
  /** 說明未勾選者會怎麼處理，例如標記為不會出席 */
  uncheckedNote?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="family-pick-title"
    >
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <p id="family-pick-title" className="text-xl font-bold text-gray-900">
          要一起報到嗎？
        </p>
        <p className="mt-1 text-sm text-gray-600">{hint}</p>
        <ul className="mt-4 space-y-2">
          {members.map((m) => {
            const done = m.已到 === 'TRUE';
            return (
              <li key={m.rowIndex}>
                <label
                  className={`flex items-center gap-3 rounded-lg border p-3 ${
                    done ? 'border-gray-200 bg-gray-50 text-gray-400' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    disabled={done}
                    checked={picked.has(m.rowIndex)}
                    onChange={(e) => onToggle(m.rowIndex, e.target.checked)}
                  />
                  <span className="flex-1">
                    <span className="block text-lg font-medium">{m.姓名}</span>
                    {m.備註 && <span className="block text-xs text-gray-500">{m.備註}</span>}
                  </span>
                  <span className="text-sm">{done ? '已報到' : m.序號 ? `#${m.序號}` : ''}</span>
                </label>
              </li>
            );
          })}
        </ul>
        {uncheckedNote && (() => {
          const unchecked = members.filter((m) => m.已到 !== 'TRUE' && !picked.has(m.rowIndex));
          return unchecked.length > 0 ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {uncheckedNote}：{unchecked.map((m) => m.姓名).join('、')}
            </p>
          ) : null;
        })()}
        <Button className="mt-5 h-12 w-full text-lg" disabled={loading || picked.size === 0} onClick={onConfirm}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              報到中...
            </>
          ) : (
            `確認報到（${picked.size} 位）`
          )}
        </Button>
        <Button variant="ghost" className="mt-2 w-full" disabled={loading} onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}
