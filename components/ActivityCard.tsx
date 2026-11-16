import type { ReactNode } from 'react';
import Link from 'next/link';
import { CopyActivityEntry } from '@/components/ActivityActions';
import { activityLinks, type ActivityLinkData } from '@/lib/activity-links';

type ActivityCardData = ActivityLinkData & { name: string };

export function ActivityCard({ event, status, onlyActivity = false, actions }: { event: ActivityCardData; status?: string; onlyActivity?: boolean; actions?: ReactNode }) {
  const links = activityLinks(event);
  const isKids = event.version?.includes('兒童') || false;
  const type = isKids ? '兒童版' : '同工版';
  const onlyActivityParams = new URLSearchParams();
  if (event.configId) onlyActivityParams.set('configId', event.configId);
  const onlyActivityQueryString = onlyActivityParams.toString();
  const onlyActivityQuery = onlyActivityQueryString ? `?${onlyActivityQueryString}` : '';
  const onlyActivityHref = `/activities/share/${encodeURIComponent(event.eventId)}${onlyActivityQuery}`;

  return (
    <article className="craft-panel craft-event">
      <div className="craft-row">
        <div>
          <p className={`craft-tag ${isKids ? 'craft-tag-kids' : ''}`}>{type}</p>
          <h2>{event.name}</h2>
          {status && <p className="craft-muted">{status}</p>}
        </div>
        {onlyActivity
          ? <Link className="craft-primary" href={links.checkin}>開始報到</Link>
          : <CopyActivityEntry href={onlyActivityHref} label="單一活動頁" activityName={event.name} className="craft-primary" buttonText="只顯示這個活動" />}
      </div>
      <details className="craft-event-details">
        <summary>活動功能</summary>
        <div className="craft-function-list">
          {[
            { label: '管理後台', href: links.admin, description: '名單與活動管理' },
            { label: '協助報到', href: links.assistance, description: '現場工作人員協助報到' },
            { label: '即時現況', href: links.dashboard, description: '查看目前報到狀況' },
            ...(links.squad ? [{ label: '小隊長管理頁面', href: links.squad, description: '小隊長查看與管理小隊報到' }] : []),
            { label: '報到 QR Code', href: links.qr, copyHref: links.checkin, description: '開啟 QR Code 產製頁，複製參加者報到連結' },
          ].map(({ label, href, description, copyHref }) => (
            <div className="craft-function" key={label}>
              <div><h3>{label}</h3><p className="craft-muted">{description}</p></div>
              <div className="craft-actions">
                <Link className="craft-ghost" href={href}>直接進入</Link>
                <CopyActivityEntry href={copyHref || href} label={label} activityName={event.name} />
              </div>
            </div>
          ))}
        </div>
        {actions}
      </details>
    </article>
  );
}
