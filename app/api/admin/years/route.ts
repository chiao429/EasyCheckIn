import { readActivityStates, saveActivityState } from '@/lib/activity-state';
import { eventTypes } from '@/lib/event-types';
import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getGoogleSheetsClient } from '@/lib/google-sheets';
import { isDriveConnected } from '@/lib/year-drive-oauth';
import { activityBindings, createEventSheets, createYearActivitySheet, deleteDriveFiles, driveFolderId, hasYearAdminSession, makeYearAdminToken, readYearConfigs, registerLegacyConfigForQrCompatibility, registryConfigured, resolveYearEvent, validateYearConfig, YEAR_ADMIN_COOKIE } from '@/lib/year-registry';

export const runtime = 'nodejs';

export async function GET() {
  if (!(await hasYearAdminSession())) return NextResponse.json({ success: false }, { status: 401 });
  try {
    return NextResponse.json({ success: true, driveConnected: await isDriveConnected(), ...(await readYearConfigs()) });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : '無法讀取年度設定' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ success: false, message: '請求格式錯誤' }, { status: 400 }); }
  if (body.action === 'login') {
    if (!process.env.YEAR_ADMIN_PASSWORD || !process.env.YEAR_ADMIN_SESSION_SECRET) return NextResponse.json({ success: false, message: '年度管理登入尚未設定' }, { status: 503 });
    if (body.password !== process.env.YEAR_ADMIN_PASSWORD) return NextResponse.json({ success: false, message: '密碼錯誤' }, { status: 401 });
    const response = NextResponse.json({ success: true });
    response.cookies.set(YEAR_ADMIN_COOKIE, makeYearAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 });
    return response;
  }
  if (body.action === 'logout') {
    const response = NextResponse.json({ success: true });
    response.cookies.set(YEAR_ADMIN_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  }
  if (!(await hasYearAdminSession())) return NextResponse.json({ success: false }, { status: 401 });
  if (!registryConfigured()) return NextResponse.json({ success: false, message: '尚未設定年度資料來源' }, { status: 503 });

  try {
    const { registryId: id, configs: initialConfigs, activeConfigId: initialActiveConfigId } = await readYearConfigs();
    let configs = initialConfigs;
    let activeConfigId = initialActiveConfigId;
    const sheets = getGoogleSheetsClient();
    if (body.action === 'archive-config') {
      const config = configs.find((item) => item.configId === body.configId);
      if (!config?.publishedBindings || config.configId === activeConfigId) {
        return NextResponse.json({ success: false, message: '請先切換首頁年度，再封存已驗證的設定' }, { status: 409 });
      }
      await sheets.spreadsheets.values.update({
        spreadsheetId: id, range: `年度設定!F${config.rowNumber}:G${config.rowNumber}`,
        valueInputOption: 'RAW', requestBody: { values: [['archived', 'FALSE']] },
      });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'rename-config') {
      const config = configs.find((item) => item.configId === body.configId);
      const name = String(body.name || '').trim();
      if (!config || !name || name.length > 100) {
        return NextResponse.json({ success: false, message: '請輸入 1 至 100 字的年度名稱' }, { status: 400 });
      }
      await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `年度設定!C${config.rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [[name]] } });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'edit-activity') {
      const configId = String(body.configId || '');
      const eventId = String(body.eventId || '');
      const name = String(body.name || '').trim();
      const note = String(body.note || '').trim();
      if (!name || name.length > 100 || note.length > 500) {
        return NextResponse.json({ success: false, message: '請確認名稱與備註長度' }, { status: 400 });
      }
      const match = configId && eventId ? await resolveYearEvent(eventId, configId) : null;
      if (!match) return NextResponse.json({ success: false, message: '找不到活動' }, { status: 404 });
      const spreadsheetId = match.config.configSheetId;
      const rows = (await sheets.spreadsheets.values.get({ spreadsheetId, range: '工作表1!A2:G' })).data.values || [];
      if (activityBindings(rows) !== match.config.publishedBindings) {
        return NextResponse.json({ success: false, message: '活動設定已變更，請重新整理' }, { status: 409 });
      }
      const row = rows.findIndex((item) => item[2] === eventId) + 2;
      await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: 'RAW', data: [
        { range: `工作表1!A${row}`, values: [[name]] },
        { range: `工作表1!D${row}`, values: [[note]] },
      ] } });
      return NextResponse.json({ success: true });
    }
    if (body.action === 'activity-state') {
      const state = body.state;
      if (state !== 'open' && state !== 'closed' && state !== 'archived' && state !== 'deleted') {
        return NextResponse.json({ success: false, message: '報到狀態無效' }, { status: 400 });
      }
      const eventId = String(body.eventId || '');
      const configId = String(body.configId || '');
      const activity = configId && eventId ? await resolveYearEvent(eventId, configId) : null;
      if (!activity?.event.sheetId) return NextResponse.json({ success: false, message: '找不到活動' }, { status: 404 });
      if (state === 'open' && (activity.config.status === 'archived' || !activity.config.acceptsCheckins)) {
        return NextResponse.json({ success: false, message: '請先在年度設定開啟簽到' }, { status: 409 });
      }
      const current = (await readActivityStates(id)).get(`${eventId}:${activity.event.sheetId}`) || 'open';
      if (state === 'deleted' && current === 'deleted') return NextResponse.json({ success: true });
      if (current === 'deleted' || (current === 'archived' && state !== 'deleted')) {
        return NextResponse.json({ success: false, message: '目前狀態不允許這項操作' }, { status: 409 });
      }
      if (state === 'open') {
        const roster = await sheets.spreadsheets.values.get({
          spreadsheetId: activity.event.sheetId,
          range: activity.event.version.includes('兒童') ? 'E2:F' : 'A2:B',
        });
        if (!roster.data.values?.some(([serial, name]) => String(serial || '').trim() && String(name || '').trim())) {
          return NextResponse.json({ success: false, message: '請先匯入名單再開放報到' }, { status: 409 });
        }
      }
      await saveActivityState(id, eventId, activity.event.sheetId, state);
      return NextResponse.json({ success: true });
    }
    if (body.action === 'delete-config') {
      const configId = String(body.configId || '');
      const config = configs.find((item) => item.configId === configId);
      if (!config) return NextResponse.json({ success: false, message: '找不到年度設定' }, { status: 404 });
      if (activeConfigId === configId) return NextResponse.json({ success: false, message: '目前啟用中的年度不能刪除' }, { status: 409 });
      if (config.publishedBindings) return NextResponse.json({ success: false, message: '此設定已有已驗證的活動與 QR Code 對應，為保留舊連結不能刪除' }, { status: 409 });
      await sheets.spreadsheets.values.clear({ spreadsheetId: id, range: `年度設定!A${config.rowNumber}:J${config.rowNumber}` });
      const remaining = await readYearConfigs();
      if (remaining.configs.some((item) => item.configId === configId)) {
        return NextResponse.json({ success: false, message: '年度登記項目清除後仍可讀取，請重新整理確認' }, { status: 503 });
      }
      return NextResponse.json({ success: true, message: '年度登記已刪除；Drive 資料夾和檔案保留' });
    }
    if (body.action === 'create-event') {
      const eventName = String(body.eventName || '').trim();
      const version = String(body.version || '').trim();
      const eventType = String(body.eventType || '');
      if (eventType && (!eventTypes.some((type) => type === eventType)
        || (eventType !== '其他' && version !== (eventType === '兒童聖誕午會' ? '兒童' : '同工')))) {
        return NextResponse.json({ success: false, message: '活動類型與版本不符' }, { status: 400 });
      }
      const note = String(body.note || '').trim();
      const year = String(body.year || '').trim();
      const yearConfigs = configs.filter((config) => config.year === year);
      const base = yearConfigs.find((config) => config.configId === activeConfigId)
        || [...yearConfigs].sort((left, right) => Number(right.status !== 'draft') - Number(left.status !== 'draft') || right.rowNumber - left.rowNumber)[0];
      if (!eventName || eventName.length > 100 || !['同工', '兒童'].includes(version)) {
        return NextResponse.json({ success: false, message: '請提供 1 到 100 字的活動名稱及有效版本' }, { status: 400 });
      }
      if (!/^\d{4}$/.test(year) || !base) {
        return NextResponse.json({ success: false, message: '請選擇一個已登記的年度' }, { status: 400 });
      }
      if (!['draft', 'validated', 'active'].includes(base.status)) {
        return NextResponse.json({ success: false, message: '所選年度設定狀態不支援新增活動' }, { status: 409 });
      }
      const folderId = driveFolderId(base.folderUrl);
      if (!folderId) return NextResponse.json({ success: false, message: '所選年度缺少有效 Drive 資料夾連結' }, { status: 409 });
      const spreadsheetId = base.configSheetId;
      const range = '工作表1!A1:G';
      const readRows = async () => (await sheets.spreadsheets.values.get({ spreadsheetId, range })).data.values || [];
      const eventId = `evt_${randomUUID()}`;
      const createdIds: string[] = [];
      let appendAttempted = false;
      try {
        const rows = await readRows();
        const originalBindings = activityBindings(rows.slice(1));
        if (base.publishedBindings && base.publishedBindings !== originalBindings) {
          return NextResponse.json({ success: false, message: '目前活動設定已與已驗證版本不符，請先重新檢查年度設定' }, { status: 409 });
        }
        const assets = await createEventSheets(folderId, eventName, version as '同工' | '兒童', eventType);
        createdIds.push(...assets.createdIds);
        const activitySheetUrl = `https://docs.google.com/spreadsheets/d/${assets.activitySheetId}/edit`;
        const logSheetUrl = `https://docs.google.com/spreadsheets/d/${assets.logSheetId}/edit`;
        const newRow = [eventName, activitySheetUrl, eventId, note, logSheetUrl, version, eventType];
        const validation = await validateYearConfig({ ...base, publishedBindings: '' }, configs, [...rows, newRow]);
        if (!validation.ok) throw new Error(`新活動資料驗證失敗：${validation.errors.join('；')}`);

        await saveActivityState(id, eventId, assets.activitySheetId, 'draft');
        const latest = (await readYearConfigs()).configs.find((config) => config.configId === base.configId);
        if (!latest || latest.status === 'archived' || latest.publishedBindings !== base.publishedBindings ||
            activityBindings((await readRows()).slice(1)) !== originalBindings) {
          throw new Error('年度設定已變更，請重新整理後再試');
        }
        appendAttempted = true;
        await sheets.spreadsheets.values.append({
          spreadsheetId, range, valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS',
          requestBody: { values: [newRow] },
        }).catch(() => undefined);
        if (activityBindings((await readRows()).slice(1)) !== validation.bindings) {
          throw new Error('無法確認新活動已寫入，請先檢查活動設定表');
        }
        const publishedRange = `年度設定!I${latest.rowNumber}:J${latest.rowNumber}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: id, range: publishedRange, valueInputOption: 'RAW',
          requestBody: { values: [[new Date().toISOString(), validation.bindings]] },
        }).catch(() => undefined);
        const saved = (await readYearConfigs()).configs.find((config) => config.configId === base.configId);
        if (saved?.publishedBindings !== validation.bindings ||
            activityBindings((await readRows()).slice(1)) !== validation.bindings) {
          throw new Error('無法確認活動已發布，請先檢查年度設定再重試');
        }
        return NextResponse.json({
          success: true, eventId, configId: base.configId, year, activated: base.configId === activeConfigId,
          activitySheetUrl, logSheetUrl,
        });
      } catch (error) {
        if (!appendAttempted) await deleteDriveFiles(createdIds).catch(() => undefined);
        throw error;
      }
    }

    if (body.action === 'create') {
      const year = String(body.year || '').trim();
      const name = String(body.name || '').trim();
      const folderInput = String(body.folderUrl || '').trim();
      const folderId = driveFolderId(folderInput);
      if (!/^\d{4}$/.test(year) || !name || !folderId) {
        return NextResponse.json({ success: false, message: '請填入有效年度、名稱和年度 Drive 資料夾連結' }, { status: 400 });
      }
      const folderUrl = folderId ? `https://drive.google.com/drive/folders/${folderId}` : '';
      const duplicate = configs.find((config) => config.year === year && config.folderUrl === folderUrl);
      if (duplicate) return NextResponse.json({ success: false, message: '這個年度資料夾已登記' }, { status: 409 });
      let configSheetId: string;
      try {
        configSheetId = await createYearActivitySheet(folderId);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ success: false, message }, { status: message.includes('連結') ? 503 : 422 });
      }
      const configId = randomUUID();
      const createdAt = new Date().toISOString();
      await sheets.spreadsheets.values.append({ spreadsheetId: id, range: '年度設定!A4:I', valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', requestBody: { values: [[configId, year, name, configSheetId, folderUrl, 'draft', 'TRUE', createdAt, '']] } });
      return NextResponse.json({ success: true, configId, configSheetId });
    }

    if (body.action === 'validate' || body.action === 'activate' || body.action === 'checkins') {
      const configId = String(body.configId || '');
      const config = configs.find((item) => item.configId === configId);
      if (!config) return NextResponse.json({ success: false, message: '找不到年度設定' }, { status: 404 });
      if (config.status === 'archived') return NextResponse.json({ success: false, message: '此年度設定已封存' }, { status: 409 });
      const rowNumber = config.rowNumber;
      if (body.action === 'checkins') {
        if (typeof body.enabled !== 'boolean') return NextResponse.json({ success: false }, { status: 400 });
        await sheets.spreadsheets.values.update({ spreadsheetId: id, range: `年度設定!G${rowNumber}`, valueInputOption: 'RAW', requestBody: { values: [[body.enabled ? 'TRUE' : 'FALSE']] } });
        return NextResponse.json({ success: true });
      }
      const legacySheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
      if (body.action === 'activate' && legacySheetId && config.configSheetId !== legacySheetId &&
          !configs.some((item) => item.configSheetId === legacySheetId && item.publishedBindings)) {
        try {
          const legacy = await registerLegacyConfigForQrCompatibility();
          if (!legacy?.publishedBindings) throw new Error('舊活動設定表未能驗證');
          const refreshed = await readYearConfigs();
          configs = refreshed.configs;
          activeConfigId = refreshed.activeConfigId;
        } catch (error) {
          return NextResponse.json({ success: false, message: error instanceof Error ? error.message : '舊活動設定無法安全登記，已保留目前年度' }, { status: 422 });
        }
      }
      const { bindings, ...validation } = await validateYearConfig(config, configs);
      if (!validation.ok) return NextResponse.json({ success: false, validation }, { status: 422 });
      if (body.action === 'validate') {
        await sheets.spreadsheets.values.batchUpdate({
          spreadsheetId: id,
          requestBody: { valueInputOption: 'RAW', data: [
            { range: `年度設定!F${rowNumber}`, values: [['validated']] },
            { range: `年度設定!I${rowNumber}:J${rowNumber}`, values: [[new Date().toISOString(), bindings]] },
          ] },
        });
        return NextResponse.json({ success: validation.ok, validation }, { status: validation.ok ? 200 : 422 });
      }
      if (activeConfigId === configId) return NextResponse.json({ success: true, validation });
      if (body.expectedActiveConfigId !== activeConfigId || (await readYearConfigs()).activeConfigId !== activeConfigId) {
        return NextResponse.json({ success: false, message: '目前年度已變更，請重新整理後再操作' }, { status: 409 });
      }
      if (!config.publishedBindings || config.status !== 'validated') return NextResponse.json({ success: false, message: '請先驗證年度設定' }, { status: 409 });
      try {
        await sheets.spreadsheets.values.update({ spreadsheetId: id, range: '年度設定!B2', valueInputOption: 'RAW', requestBody: { values: [[configId]] } });
      } catch {
        // The write can succeed remotely even if the request times out.
      }
      try {
        const check = await sheets.spreadsheets.values.get({ spreadsheetId: id, range: '年度設定!B2' });
        if (check.data.values?.[0]?.[0] !== configId) throw new Error('啟用狀態回讀不一致');
      } catch (error) {
        return NextResponse.json({ success: false, message: '無法確認啟用結果，請重新整理狀態後再操作' }, { status: 503 });
      }
      return NextResponse.json({ success: true, validation });
    }
    return NextResponse.json({ success: false, message: '不支援的操作' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: error instanceof Error ? error.message : '年度設定操作失敗' }, { status: 500 });
  }
}
