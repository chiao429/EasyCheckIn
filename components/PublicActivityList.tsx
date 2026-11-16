'use client';

import { useEffect, useState } from 'react';
import { CraftNav } from '@/components/CraftNav';
import { ActivityCard } from '@/components/ActivityCard';
import type { ActivityLinkData } from '@/lib/activity-links';

type PublicActivity = ActivityLinkData & { name: string; checkinOpen?: boolean };

export function PublicActivityList({ onlyEventId, configId, standalone = false }: { onlyEventId?: string; configId?: string; standalone?: boolean }) {
  const [events, setEvents] = useState<PublicActivity[]>([]);
  const [status, setStatus] = useState('正在載入活動…');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let settled = false;
    const skeletonTimer = window.setTimeout(() => {
      if (!settled) setShowSkeleton(true);
    }, 180);
    async function load() {
      try {
        const params = new URLSearchParams();
        if (onlyEventId) params.set('onlyEventId', onlyEventId);
        if (configId) params.set('configId', configId);
        const query = params.toString();
        const response = await fetch(`/api/events/list${query ? `?${query}` : ''}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error();
        setEvents(data.data.filter((event: PublicActivity) => event.sheetId && (standalone || event.checkinOpen !== false)));
        setStatus('目前沒有開放報到的活動。');
      } catch {
        if (!controller.signal.aborted) setStatus('暫時無法載入活動，請重新整理。');
      } finally {
        settled = true;
        window.clearTimeout(skeletonTimer);
        if (!controller.signal.aborted) { setShowSkeleton(false); setLoaded(true); }
      }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(skeletonTimer); };
  }, [onlyEventId, configId, standalone]);

  const visibleEvents = onlyEventId ? events.filter((event) => event.eventId === onlyEventId) : events;

  return (
    <main className="craft">
      {!standalone && <CraftNav />}
      <section className="craft-content">
        <header className="craft-hero">
          <h1>活動報到</h1>
          {!loaded && !showSkeleton && <p role="status">{status}</p>}
          {loaded && !visibleEvents.length && <p role="status">{onlyEventId ? '此活動目前未開放報到或連結無效。' : status}</p>}
        </header>
        {!loaded && showSkeleton && <div className="skeleton-card-grid" role="status" aria-label="正在載入活動">
          <div className="skeleton-card" /><div className="skeleton-card" /><div className="skeleton-card" />
        </div>}
        {visibleEvents.length > 0 && (
          <div className="craft-list">
            {visibleEvents.map((event) => <ActivityCard event={event} status={standalone ? (event.checkinOpen === false ? '報到已關閉' : '報到開放') : undefined} onlyActivity={standalone || Boolean(onlyEventId)} key={`${event.configId || 'legacy'}:${event.eventId}`} />)}
          </div>
        )}
      </section>
    </main>
  );
}
