'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const pendingLink = useRef<HTMLAnchorElement | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    setPending(false);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingLink.current?.classList.remove('is-pending');
    pendingLink.current = null;

    const container = containerRef.current;
    if (!container) return;
    container.classList.remove('route-entering');
    void container.offsetHeight;
    container.classList.add('route-entering');
    const timer = setTimeout(() => container.classList.remove('route-entering'), 360);

    const heading = container.querySelector<HTMLElement>('main h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
      const focusTimer = setTimeout(() => heading.removeAttribute('tabindex'), 500);
      return () => { clearTimeout(timer); clearTimeout(focusTimer); };
    }
    return () => clearTimeout(timer);
  }, [pathname]);

  function handleNavigation(event: React.MouseEvent<HTMLDivElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
    if (!target || target.target === '_blank' || target.hasAttribute('download')) return;
    const url = new URL(target.href, window.location.href);
    if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;

    pendingLink.current?.classList.remove('is-pending');
    pendingLink.current = target;
    target.classList.add('is-pending');
    setPending(true);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => {
      setPending(false);
      pendingLink.current?.classList.remove('is-pending');
      pendingLink.current = null;
    }, 8000);
  }

  return (
    <div ref={containerRef} className="route-transition" onClickCapture={handleNavigation} aria-busy={pending}>
      {pending && <><div className="route-progress" aria-hidden="true" /><span className="sr-only" role="status">正在切換頁面</span></>}
      {children}
    </div>
  );
}
