'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function CraftNav({ working = false }: { working?: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="craft-nav" aria-label="主要導覽">
      <Link href="/" className="craft-brand">EasyCheckIn</Link>
      {working ? (
        <div className="craft-actions">
          <Link className={`craft-ghost craft-nav-link ${pathname === '/activities' ? 'is-active' : ''}`} aria-current={pathname === '/activities' ? 'page' : undefined} href="/activities">活動列表</Link>
          <Link className={`craft-ghost craft-nav-link ${pathname === '/years' ? 'is-active' : ''}`} aria-current={pathname === '/years' ? 'page' : undefined} href="/years">年度設定</Link>
        </div>
      ) : <Link className={`craft-ghost craft-nav-link ${pathname === '/activities' ? 'is-active' : ''}`} aria-current={pathname === '/activities' ? 'page' : undefined} href="/activities">工作人員登入</Link>}
    </nav>
  );
}
