'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function CraftNav({ working = false }: { working?: boolean }) {
  const pathname = usePathname();
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try {
      const response = await fetch('/api/admin/years', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      if (!response.ok) throw new Error('登出失敗');
      window.location.assign('/activities');
    } catch {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="craft-nav" aria-label="主要導覽">
      <Link href="/" className="craft-brand">EasyCheckIn</Link>
      {working ? (
        <div className="craft-actions">
          <Link className={`craft-ghost craft-nav-link ${pathname === '/activities' ? 'is-active' : ''}`} aria-current={pathname === '/activities' ? 'page' : undefined} href="/activities">活動列表</Link>
          <Link className={`craft-ghost craft-nav-link ${pathname === '/years' ? 'is-active' : ''}`} aria-current={pathname === '/years' ? 'page' : undefined} href="/years">年度設定</Link>
          <button type="button" className="craft-ghost craft-nav-link" onClick={logout} disabled={loggingOut}>{loggingOut ? '正在登出…' : '登出'}</button>
        </div>
      ) : <Link className="craft-ghost craft-nav-link" href="/years?next=activities">工作人員登入</Link>}
    </nav>
  );
}
