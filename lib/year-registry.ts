import { readActivityStates } from '@/lib/activity-state';
import { allStaffHeaders, christmasHeaders } from '@/lib/event-types';
import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';
import { getGoogleSheetsClient, getGoogleDriveMetadataClient, extractSheetIdFromUrl } from '@/lib/google-sheets';
import { getUserDriveClients } from '@/lib/year-drive-oauth';

export const YEAR_ADMIN_COOKIE = 'easycheckin_year_admin';
const REGISTRY_TAB = '年度設定';
const ACTIVE_CELL = `${REGISTRY_TAB}!B2`;
const ROWS_RANGE = `${REGISTRY_TAB}!A4:J`;

export type YearConfig = {
  configId: string;
  year: string;
  name: string;
  configSheetId: string;
  folderUrl: string;
  status: string;
  acceptsCheckins: boolean;
  createdAt: string;
  validatedAt: string;
  rowNumber: number;
  publishedBindings: string;
};

export function registryConfigured() {
  return Boolean(process.env.GOOGLE_YEAR_ROOT_FOLDER_ID || process.env.GOOGLE_YEAR_REGISTRY_SHEET_ID);
}

export function driveFolderId(input: string) {
  return input.match(/^(?:https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/)?([\w-]+)(?:[/?#].*)?$/)?.[1] || '';
}

export async function findFolderSpreadsheet(folderId: string, title: string) {
  if (!/^[\w-]+$/.test(folderId)) throw new Error('Drive 資料夾 ID 無效');
  const drive = getGoogleDriveMetadataClient();
  const { data } = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.spreadsheet' and name = '${title}'`,
    fields: 'nextPageToken,files(id)',
    pageSize: 2,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const files = data.files || [];
  if (data.nextPageToken || files.length > 1) throw new Error(`資料夾內有多份「${title}」，請保留唯一一份`);
  if (!files[0]?.id) throw new Error(`資料夾內找不到「${title}」，請確認檔案名稱及服務帳號權限`);
  return files[0].id;
}

export async function createEventSheets(folderId: string, eventName: string, version: '同工' | '兒童', eventType = '') {
  const { drive, sheets } = await getUserDriveClients();
  const folder = await drive.files.get({ fileId: folderId, supportsAllDrives: true, fields: 'capabilities(canAddChildren)' });
  if (!folder.data.capabilities?.canAddChildren) throw new Error('已連結的 Google 帳號沒有在年度資料夾新增檔案的權限');
  const cleanName = eventName.replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 80);
  const createdIds: string[] = [];

  async function createSheet(title: string, headers: string[]) {
    const created = await sheets.spreadsheets.create({ requestBody: {
      properties: { title, locale: 'zh_TW', timeZone: 'Asia/Taipei' },
      sheets: [{ properties: { title: '工作表1' } }],
    } });
    const id = created.data.spreadsheetId;
    if (!id) throw new Error(`Google Sheets 未回傳「${title}」的試算表 ID`);
    createdIds.push(id);
    const endColumn = String.fromCharCode(64 + headers.length);
    await sheets.spreadsheets.values.update({
      spreadsheetId: id, range: `工作表1!A1:${endColumn}1`, valueInputOption: 'RAW', requestBody: { values: [headers] },
    });
    const file = await drive.files.get({ fileId: id, supportsAllDrives: true, fields: 'parents' });
    await drive.files.update({ fileId: id, addParents: folderId, removeParents: file.data.parents?.join(','), supportsAllDrives: true, fields: 'id,parents' });
    return id;
  }

  try {
    const attendeeHeaders = version === '同工'
      ? ['序號', '姓名', '到達時間', '已到', '性別', '所屬小組', '聯絡組', '聯絡電話', '其他']
      : ['已到', '到達時間', '備註', '所屬小隊', '報名序號', '兒童姓名', '','','','','','','','','','','','','','','是否已聯繫'];
    if (eventType === '所有同工') {
      attendeeHeaders[4] = '';
      attendeeHeaders[8] = '';
      attendeeHeaders.push(...allStaffHeaders.filter((label) => !['項次', '姓名', '所屬小組', '聯絡組', '聯絡電話'].includes(label)));
    } else if (eventType === '兒童聖誕午會') {
      attendeeHeaders[2] = '項次';
      attendeeHeaders.splice(6, 14, ...christmasHeaders.slice(4));
    }
    const activitySheetId = await createSheet(`${cleanName}_出席名單`, attendeeHeaders);
    const logSheetId = await createSheet(`${cleanName}_操作紀錄`, ['時間', '操作人員', '動作', '序號', '姓名', '操作結果', '備註']);
    return { activitySheetId, logSheetId, createdIds };
  } catch (error) {
    await Promise.all(createdIds.map((id) => drive.files.delete({ fileId: id, supportsAllDrives: true }).catch(() => undefined)));
    throw error;
  }
}

export async function copyActivityConfigSheet(sourceId: string, folderId: string, title: string) {
  const { drive } = await getUserDriveClients();
  const result = await drive.files.copy({
    fileId: sourceId, supportsAllDrives: true,
    requestBody: { name: title, parents: [folderId] }, fields: 'id,parents',
  });
  const id = result.data.id;
  if (!id) throw new Error('Google Drive 未回傳活動設定副本 ID');
  const parents = result.data.parents || [];
  if (!parents.includes(folderId)) {
    await drive.files.update({ fileId: id, addParents: folderId, removeParents: parents.join(','), supportsAllDrives: true, fields: 'id,parents' });
  }
  return id;
}

export async function deleteDriveFiles(ids: string[]) {
  const { drive } = await getUserDriveClients();
  await Promise.all(ids.map((id) => drive.files.delete({ fileId: id, supportsAllDrives: true }).catch(() => undefined)));
}

export async function createYearActivitySheet(folderId: string) {
  if (!/^[\w-]+$/.test(folderId)) throw new Error('年度資料夾 ID 無效');
  const { drive, sheets } = await getUserDriveClients();
  const folder = await drive.files.get({ fileId: folderId, supportsAllDrives: true, fields: 'capabilities(canAddChildren)' });
  if (!folder.data.capabilities?.canAddChildren) throw new Error('已連結的 Google 帳號沒有在年度資料夾新增檔案的權限');
  const created = await sheets.spreadsheets.create({ requestBody: {
    properties: { title: '活動設定', locale: 'zh_TW', timeZone: 'Asia/Taipei' },
    sheets: [
      { properties: { title: '工作表1' } },
      { properties: { title: '資訊' } },
    ],
  } });
  const id = created.data.spreadsheetId;
  if (!id) throw new Error('Google Sheets 未回傳新試算表 ID');
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: id, range: '工作表1!A1:F1', valueInputOption: 'RAW',
      requestBody: { values: [['活動名稱', '活動試算表連結', 'event ID', '備註', '操作紀錄連結', '版本']] },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: id, range: '資訊!A1:A2', valueInputOption: 'RAW',
      requestBody: { values: [['後台密碼'], ['']] },
    });
    const file = await drive.files.get({ fileId: id, supportsAllDrives: true, fields: 'parents' });
    await drive.files.update({
      fileId: id, addParents: folderId, removeParents: file.data.parents?.join(','),
      supportsAllDrives: true, fields: 'id,parents',
    });
    return id;
  } catch (error) {
    await drive.files.delete({ fileId: id, supportsAllDrives: true }).catch(() => undefined);
    throw error;
  }
}

export async function getYearRegistryId() {
  const root = process.env.GOOGLE_YEAR_ROOT_FOLDER_ID;
  if (root) return findFolderSpreadsheet(driveFolderId(root), '年度登記表');
  const id = process.env.GOOGLE_YEAR_REGISTRY_SHEET_ID;
  if (!id) throw new Error('尚未設定年度資料來源');
  return id;
}

function sessionSecret() {
  return process.env.YEAR_ADMIN_SESSION_SECRET || '';
}

export function makeYearAdminToken() {
  const expiry = String(Date.now() + 8 * 60 * 60 * 1000);
  const signature = createHmac('sha256', sessionSecret()).update(expiry).digest('hex');
  return `${expiry}.${signature}`;
}

export async function hasYearAdminSession() {
  const token = (await cookies()).get(YEAR_ADMIN_COOKIE)?.value || '';
  const [expiry, signature] = token.split('.');
  if (!expiry || !signature || Number(expiry) < Date.now() || !sessionSecret()) return false;
  const expected = createHmac('sha256', sessionSecret()).update(expiry).digest('hex');
  const actualBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function getSheets() {
  if (!registryConfigured()) throw new Error('GOOGLE_YEAR_REGISTRY_SHEET_ID 未設定');
  return getGoogleSheetsClient();
}

export async function readYearConfigs() {
  const sheets = getSheets();
  const registryId = await getYearRegistryId();
  const [active, values] = await Promise.all([
    sheets.spreadsheets.values.get({ spreadsheetId: registryId, range: ACTIVE_CELL }),
    sheets.spreadsheets.values.get({ spreadsheetId: registryId, range: ROWS_RANGE }),
  ]);
  const configs = (values.data.values || []).map((row, index): YearConfig => ({
    configId: row[0] || '', year: row[1] || '', name: row[2] || '', configSheetId: row[3] || '',
    folderUrl: row[4] || '', status: row[5] || 'draft', acceptsCheckins: String(row[6]).toUpperCase() !== 'FALSE',
    createdAt: row[7] || '', validatedAt: row[8] || '', rowNumber: index + 4, publishedBindings: row[9] || '',
  })).filter((row) => row.configId);
  return { registryId, activeConfigId: active.data.values?.[0]?.[0] || '', configs };
}

export function activityBindings(rows: unknown[][]) {
  return JSON.stringify(rows.filter((row) => row[2]).map((row) => [
    String(row[2]), extractSheetIdFromUrl(String(row[1] || '')),
    extractSheetIdFromUrl(String(row[4] || '')), String(row[5] || ''),
  ]).sort((a, b) => a[0].localeCompare(b[0])));
}

export async function validateYearConfig(config: YearConfig, configs: YearConfig[], candidateRows?: unknown[][]) {
  const sheets = getSheets();
  const { configSheetId, folderUrl } = config;
  const drive = getGoogleDriveMetadataClient();
  const sheetBindings = new Map<string, string[]>();
  const otherConfigs = configs.filter((other) => other.configId !== config.configId);
  for (const other of otherConfigs) {
    if (other.status === 'draft' && other.configSheetId !== process.env.GOOGLE_EVENT_CONFIG_SHEET_ID) continue;
    const rows = await sheets.spreadsheets.values.get({ spreadsheetId: other.configSheetId, range: 'A2:F' });
    const sameYearFolder = other.year === config.year && other.folderUrl === config.folderUrl;
    for (const row of rows.data.values || []) {
      const eventId = String(row[2] || '').trim();
      if (!eventId) continue;
      const version = String(row[5] || '').trim();
      for (const [value, role] of [[row[1], 'attendee'], [row[4], 'log']] as const) {
        if (!value) continue;
        const id = extractSheetIdFromUrl(String(value));
        const binding = `${sameYearFolder ? `${config.year}:${config.folderUrl}` : other.configId}:${eventId}:${role}:${version}`;
        sheetBindings.set(id, [...(sheetBindings.get(id) || []), binding]);
      }
    }
  }
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: configSheetId, fields: 'sheets.properties' });
  const tabs = new Set((spreadsheet.data.sheets || []).map((sheet) => sheet.properties?.title));
  if (!tabs.has('工作表1')) return { ok: false, errors: ['缺少「工作表1」分頁'], activityCount: 0, bindings: '' };
  const rows = candidateRows ?? (await sheets.spreadsheets.values.get({ spreadsheetId: configSheetId, range: '工作表1!A1:F' })).data.values ?? [];
  const headers = rows[0] || [];
  const errors: string[] = [];
  if (!tabs.has('資訊')) errors.push('缺少「資訊」分頁');
  if (!headers[5]) errors.push('缺少 F 欄版本標題');
  const folderId = folderUrl.match(/\/folders\/([\w-]+)/)?.[1];
  async function verifyTarget(id: string, label: string, eventId: string, role: 'attendee' | 'log', version: string) {
    if (!/^[\w-]+$/.test(id)) { errors.push(`${label}缺少有效試算表連結`); return; }
    const bindings = sheetBindings.get(id) || [];
    const ownBinding = `${config.year}:${config.folderUrl}:${eventId}:${role}:${version}`;
    if (bindings.some((binding) => binding !== ownBinding)) errors.push(`${label}指向其他已登記設定使用的試算表`);
    try {
      await sheets.spreadsheets.get({ spreadsheetId: id, fields: 'spreadsheetId' });
    } catch {
      errors.push(`${label}無法讀取`);
      return;
    }
    try {
      const file = await drive.files.get({ fileId: id, supportsAllDrives: true, fields: 'capabilities(canEdit),parents' });
      if (!file.data.capabilities?.canEdit) errors.push(`${label}可讀取，但無法確認可寫入`);
      if (folderId) {
        let parents = file.data.parents || [];
        const seen = new Set<string>();
        while (parents.length && !parents.includes(folderId)) {
          const parent = parents.find((value) => !seen.has(value));
          if (!parent) break;
          seen.add(parent);
          const result = await drive.files.get({ fileId: parent, supportsAllDrives: true, fields: 'parents' });
          parents = [...parents.filter((value) => value !== parent), ...(result.data.parents || [])];
        }
        if (!parents.includes(folderId)) errors.push(`${label}不在設定資料夾中，或無法確認歸屬`);
      }
    } catch {
      errors.push(`${label}可讀取，但 Drive 無法驗證寫入權限或資料夾歸屬`);
    }
  }
  if (!headers[0] || !headers[1] || !headers[2]) errors.push('活動設定表 A1:C1 缺少必要欄位');
  const ids = new Set<string>();
  let activityCount = 0;
  for (const [index, row] of rows.slice(1).entries()) {
    const eventId = String(row[2] || '').trim();
    if (!eventId) { if (row.some(Boolean)) errors.push(`第 ${index + 2} 列缺少活動 ID`); continue; }
    activityCount += 1;
    if (ids.has(eventId)) errors.push(`第 ${index + 2} 列活動 ID 重複：${eventId}`);
    ids.add(eventId);
    const attendeeId = extractSheetIdFromUrl(String(row[1] || '').trim());
    const version = String(row[5] || '').trim();
    if (!['同工', '兒童'].includes(version)) errors.push(`第 ${index + 2} 列版本需為「同工」或「兒童」`);
    await verifyTarget(attendeeId, `第 ${index + 2} 列 B 欄出席名單`, eventId, 'attendee', version);
    if (row[4]) await verifyTarget(extractSheetIdFromUrl(String(row[4])), `第 ${index + 2} 列 E 欄操作紀錄`, eventId, 'log', version);
  }
  if (!activityCount) errors.push('設定表沒有可用活動');
  const bindings = activityBindings(rows.slice(1));
  if (bindings.length > 45000) errors.push('活動對應超出登記表單格容量');
  if (config.publishedBindings && config.publishedBindings !== bindings) errors.push('已驗證的活動對應已變更，請建立新設定');
  return { ok: errors.length === 0, errors, activityCount, bindings };
}

export async function registerLegacyConfigForQrCompatibility() {
  const legacySheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
  if (!legacySheetId) return null;
  const registry = await readYearConfigs();
  const existing = registry.configs.filter((config) => config.configSheetId === legacySheetId);
  if (existing.length > 1) throw new Error('年度登記表有多筆舊活動設定，請先人工確認');
  if (existing[0]?.publishedBindings) return existing[0];

  const drive = getGoogleDriveMetadataClient();
  const sourceFile = await drive.files.get({ fileId: legacySheetId, supportsAllDrives: true, fields: 'name,parents' });
  const folderId = sourceFile.data.parents?.[0];
  if (!folderId) throw new Error('無法確認舊活動設定表所屬年度資料夾');
  const folder = await drive.files.get({ fileId: folderId, supportsAllDrives: true, fields: 'name,mimeType' });
  const year = folder.data.name?.match(/20\d{2}/)?.[0];
  if (!year || folder.data.mimeType !== 'application/vnd.google-apps.folder') {
    throw new Error('無法從舊活動設定表的上層資料夾辨識年度，請先人工登記舊年度');
  }

  const config: YearConfig = {
    configId: existing[0]?.configId || `legacy-${createHash('sha256').update(legacySheetId).digest('hex').slice(0, 24)}`,
    year, name: `${year} 舊活動設定（QR 相容）`, configSheetId: legacySheetId,
    folderUrl: `https://drive.google.com/drive/folders/${folderId}`, status: 'draft', acceptsCheckins: true,
    createdAt: existing[0]?.createdAt || new Date().toISOString(), validatedAt: '',
    rowNumber: existing[0]?.rowNumber || 0, publishedBindings: '',
  };
  const candidates = registry.configs.filter((item) => item.configSheetId !== legacySheetId);
  const { bindings, ...validation } = await validateYearConfig(config, candidates);
  if (!validation.ok) throw new Error(`舊活動設定無法安全登記：${validation.errors.join('；')}`);
  const validatedAt = new Date().toISOString();
  const values = [[config.configId, config.year, config.name, legacySheetId, config.folderUrl, 'validated', 'TRUE', config.createdAt, validatedAt, bindings]];
  const sheets = getGoogleSheetsClient();
  if (config.rowNumber) {
    await sheets.spreadsheets.values.update({ spreadsheetId: registry.registryId, range: `年度設定!A${config.rowNumber}:J${config.rowNumber}`, valueInputOption: 'RAW', requestBody: { values } });
  } else {
    await sheets.spreadsheets.values.append({ spreadsheetId: registry.registryId, range: '年度設定!A4:J', valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values } });
  }
  const saved = await readYearConfigs();
  const registered = saved.configs.find((item) => item.configSheetId === legacySheetId && item.publishedBindings === bindings);
  if (!registered) throw new Error('舊活動設定已寫入，但無法確認年度登記結果');
  return registered;
}

export async function resolveYearEvent(eventId: string, configId?: string, legacySheetId?: string) {
  const { configs, registryId } = await readYearConfigs();
  const sheets = getSheets();
  const candidates = configs.filter((row) => configId
    ? row.configId === configId
    : row.configSheetId === process.env.GOOGLE_EVENT_CONFIG_SHEET_ID);
  const matches = [];
  for (const config of candidates) {
    if (!['validated', 'active', 'archived'].includes(config.status)) continue;
    const result = await sheets.spreadsheets.values.get({ spreadsheetId: config.configSheetId, range: '工作表1!A2:G' });
    if (!config.publishedBindings || config.publishedBindings !== activityBindings(result.data.values || [])) continue;
    const rows = (result.data.values || []).filter((item) => item[2] === eventId);
    if (rows.length !== 1) continue;
    const [row] = rows;
    const sheetId = extractSheetIdFromUrl(row[1] || '');
    if (legacySheetId && legacySheetId !== sheetId) continue;
    matches.push({ config, event: { eventId, name: row[0] || eventId, sheetId, logSheetId: extractSheetIdFromUrl(row[4] || ''), version: row[5] || '', eventType: row[6] || '' } });
  }
  return matches.length === 1 ? { ...matches[0], registryId } : null;
}

export async function resolveRequestedActivity(
  eventId: string | null, sheetId: string | null, configId?: string | null, checkin = false,
) {
  if (!registryConfigured()) return { sheetId, logSheetId: undefined };
  const match = eventId && (configId || sheetId)
    ? await resolveYearEvent(eventId, configId || undefined, sheetId || undefined)
    : null;
  const state = checkin && match
    ? (await readActivityStates(match.registryId)).get(`${eventId}:${match.event.sheetId}`) || 'open'
    : 'open';
  return {
    sheetId: match && (!checkin || (match.config.acceptsCheckins && state === 'open')) ? match.event.sheetId : null,
    checkinClosed: Boolean(checkin && match && (!match.config.acceptsCheckins || state !== 'open')),
    logSheetId: match?.event.logSheetId ?? null,
  };
}

export async function resolveRequestedSheet(eventId: string | null, sheetId: string | null, configId?: string | null) {
  return (await resolveRequestedActivity(eventId, sheetId, configId)).sheetId;
}
