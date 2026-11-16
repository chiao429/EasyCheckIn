import { getGoogleSheetsClient } from '@/lib/google-sheets';

export type ActivityState = 'draft' | 'open' | 'closed' | 'archived' | 'deleted';
const range = '年度設定!N4:Q';

export const activityStateLabel: Record<ActivityState, string> = {
  draft: '準備中', open: '報到開放', closed: '報到關閉', archived: '已封存', deleted: '已刪除',
};

export async function readActivityStates(registryId: string) {
  const response = await getGoogleSheetsClient().spreadsheets.values.get({ spreadsheetId: registryId, range });
  const states = new Map<string, ActivityState>();
  for (const [eventId, sheetId, state] of response.data.values || []) {
    if (Object.prototype.hasOwnProperty.call(activityStateLabel, state)) states.set(`${eventId}:${sheetId}`, state);
  }
  return states;
}

export async function saveActivityState(registryId: string, eventId: string, sheetId: string, state: ActivityState) {
  await getGoogleSheetsClient().spreadsheets.values.append({
    spreadsheetId: registryId, range, valueInputOption: 'RAW', insertDataOption: 'OVERWRITE',
    requestBody: { values: [[eventId, sheetId, state, new Date().toISOString()]] },
  });
}
