export type ActivityLinkData = { eventId: string; sheetId: string; configId?: string; version?: string; eventType?: string };

export function activityLinks(event: ActivityLinkData) {
  const kids = event.version?.includes('兒童');
  const params = new URLSearchParams({ sheet: event.sheetId });
  if (event.configId) params.set('configId', event.configId);
  const suffix = `/${encodeURIComponent(event.eventId)}?${params}`;
  return {
    checkin: (kids ? '/kids-check' : '/checkin') + suffix,
    admin: (kids ? '/kids-admin' : '/admin') + suffix,
    assistance: (kids ? '/kids-manager' : '/manager') + suffix,
    dashboard: (kids ? '/kids-dashboard' : '/dashboard') + suffix,
    qr: `/activities?${new URLSearchParams({ ...(event.configId ? { configId: event.configId } : {}), eventId: event.eventId, tab: 'qr' })}`,
    squad: kids ? '/kids-squad' + suffix : null,
  };
}
