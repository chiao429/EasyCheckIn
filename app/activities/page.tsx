import { ActivityActions, CopyActivityEntry, EditActivity, PrintActivityCode } from '@/components/ActivityActions';
import { activityStateLabel, readActivityStates } from '@/lib/activity-state';
import Link from 'next/link';
import QRCode from 'qrcode';
import { headers } from 'next/headers';
import { CraftNav } from '@/components/CraftNav';
import { activityLinks } from '@/lib/activity-links';
import { extractSheetIdFromUrl, getGoogleSheetsClient } from '@/lib/google-sheets';
import { activityBindings, hasYearAdminSession, readYearConfigs, registryConfigured } from '@/lib/year-registry';
import { PublicActivityList } from '@/components/PublicActivityList';
import { ActivityCard } from '@/components/ActivityCard';

export const dynamic = 'force-dynamic';

export default async function ActivitiesPage({ searchParams }: {
  searchParams: { configId?: string; eventId?: string; onlyEventId?: string; tab?: string };
}) {
  const isAdmin = await hasYearAdminSession();
  if (!isAdmin && searchParams.tab !== 'qr') return <PublicActivityList onlyEventId={searchParams.onlyEventId} />;
  if (!isAdmin && !registryConfigured()) return <PublicActivityList />;

  try {
    const { configs, activeConfigId, registryId } = await readYearConfigs();
    const available = configs.filter((config) => ['active', 'validated', 'archived'].includes(config.status));
    const config = available.find((item) => item.configId === (isAdmin ? searchParams.configId || activeConfigId : activeConfigId));
    const rows = config ? (await getGoogleSheetsClient().spreadsheets.values.get({
      spreadsheetId: config.configSheetId, range: '工作表1!A2:G',
    })).data.values || [] : [];
    if (config && config.publishedBindings !== activityBindings(rows)) throw new Error('活動對應已變更');
    const states = await readActivityStates(registryId);
    const events = rows.filter((row) => row[2] && row[1]).map((row) => ({
      eventId: String(row[2]), name: String(row[0]), version: String(row[5] || ''),
      note: String(row[3] || ''), eventType: String(row[6] || ''), sheetId: extractSheetIdFromUrl(row[1]), configId: config?.configId,
    }));
    const stateOf = (event: (typeof events)[number]) => {
      const state = states.get(`${event.eventId}:${event.sheetId}`) || 'open';
      return state === 'open' && !config?.acceptsCheckins ? 'closed' : state;
    };
    const visibleEvents = events.filter((event) => stateOf(event) !== 'deleted' && (isAdmin || stateOf(event) === 'open') && (!searchParams.onlyEventId || event.eventId === searchParams.onlyEventId));
    const selected = visibleEvents.find((event) => event.eventId === searchParams.eventId);
    const links = selected ? activityLinks(selected) : null;
    const qrSelected = searchParams.tab === 'qr';
    let qr: string | undefined;
    if (links && qrSelected) {
      const host = headers().get('host');
      const local = host?.startsWith('localhost:') || host?.startsWith('127.0.0.1:');
      const base = process.env.NEXT_PUBLIC_BASE_URL || `${local ? 'http' : 'https'}://${host}`;
      qr = await QRCode.toDataURL(new URL(links.checkin, base).href, { width: 320, margin: 4 });
    }

    const listUrl = config ? `/activities?configId=${encodeURIComponent(config.configId)}` : '/activities';
    return <main className="craft">
      <CraftNav working />
      <section className="craft-content">
        {selected && links ? <>
          <Link className="craft-ghost mb-5" href={listUrl}>返回活動列表</Link>
          <p className="craft-muted">{config?.year} · {selected.eventType || (selected.version?.includes('兒童') ? '兒童版' : '同工版')}</p>
          <h1>{selected.name}</h1>
          <p className="craft-muted mt-2">{activityStateLabel[stateOf(selected)]}</p>
          <div className="craft-panel mt-6">
            <h2>活動入口</h2>
            <div className="craft-actions mt-4">
              <Link className="craft-primary" href={links.admin}>名單與出席</Link>
              <Link className="craft-ghost" href={links.checkin}>{links.squad ? '家長自行報到' : '自行簽到'}</Link>
              <Link className="craft-ghost" href={links.assistance}>協助報到</Link>
              {links.squad && <Link className="craft-ghost" href={links.squad}>我的小隊</Link>}
              <Link className="craft-ghost" href={links.dashboard}>即時現況</Link>
              <Link className="craft-ghost" href={`${listUrl}&eventId=${encodeURIComponent(selected.eventId)}&tab=qr`}>報到 QR Code</Link>
            </div>
          </div>
          {isAdmin && config && config.status !== 'archived' && stateOf(selected) !== 'archived' && <ActivityActions eventId={selected.eventId} configId={config.configId} open={stateOf(selected) === 'open'} draft={stateOf(selected) === 'draft'} />}
          {isAdmin && config && <EditActivity eventId={selected.eventId} configId={config.configId} name={selected.name} note={selected.note} />}
          {qr && <div className="craft-panel mt-4">
            <h2>參加者報到 QR Code</h2>
            <img className="craft-qr" src={qr} width="320" height="320" alt="參加者報到 QR Code" />
            <div className="craft-actions"><a className="craft-primary" href={qr} download="check-in-qr.png">下載 QR Code</a><PrintActivityCode /></div>
            <div className="craft-list">
              {[
                { label: '協助報到', href: links.assistance },
                { label: '即時現況', href: links.dashboard },
                ...(links.squad ? [{ label: '我的小隊', href: links.squad }] : []),
              ].map(({ label, href }) => (
                <div className="craft-row" key={label}>
                  <Link href={href} className="underline">{label}</Link>
                  <CopyActivityEntry href={href} label={label} activityName={selected.name} />
                </div>
              ))}
            </div>
          </div>}
        </> : isAdmin ? <>
          <header className="craft-row">
            <h1>活動列表</h1>
            <div className="craft-actions">
              {searchParams.onlyEventId && <Link className="craft-ghost" href={listUrl}>顯示所有活動</Link>}
              <Link className="craft-primary" href="/years#new-activity">新增活動</Link>
            </div>
          </header>
          <form className="craft-actions mt-5">
            <label htmlFor="activity-year">年度設定</label>
            <select name="configId" id="activity-year" defaultValue={config?.configId || ''}>
              <option value="" disabled>選擇年度設定</option>
              {available.map((item) => <option key={item.configId} value={item.configId}>{item.year} · {item.name}{item.configId === activeConfigId ? '（首頁使用中）' : ''}</option>)}
            </select>
            <button className="craft-ghost">查看活動</button>
          </form>
          <div className="craft-list">
            {visibleEvents.map((event) => <ActivityCard key={event.eventId} event={event} status={activityStateLabel[stateOf(event)]} onlyActivity={Boolean(searchParams.onlyEventId)} />)}
            {!visibleEvents.length && <p className="craft-muted">{config ? '此年度設定尚無活動。' : '請選擇已驗證的年度設定。'}</p>}
          </div>
        </> : <PublicActivityList />}
      </section>
      {qr && selected && <section className="craft-print-only"><h1>{selected.name}</h1><img src={qr} width="320" height="320" alt="參加者報到 QR Code" /></section>}
    </main>;
  } catch {
    return <main className="craft"><CraftNav working /><section className="craft-content"><p role="alert">無法載入活動，請重新整理或檢查年度設定。</p></section></main>;
  }
}
