import { allStaffHeaders, christmasHeaders } from '@/lib/event-types';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/admin-session';
import { extractSheetIdFromUrl, getGoogleSheetsClient, invalidateKidsCache, logManagerAction } from '@/lib/google-sheets';
import { registryConfigured, resolveYearEvent } from '@/lib/year-registry';
import { createXlsxTemplate, parseXlsx } from '@/lib/xlsx';

export const runtime = 'nodejs';

const kidsHeaders = ['所屬小隊', '報名序號', '兒童姓名', ...Array.from({ length: 14 }, (_, i) => `自訂欄位${i + 1}`)];
const staffExtraHeaders = ['行前會出席', '報到', '闖關', '移動', '聚會', '回家'];

function formatContactPhone(value: string) {
  let digits = value.replace(/\D/g, '');
  if (digits.length === 9) digits = `0${digits}`;
  if (digits.length === 10) return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7)}`;
  return value.trim();
}

export async function GET(request: NextRequest) {
  const version = request.nextUrl.searchParams.get('template');
  if (version !== '同工' && version !== '兒童') return NextResponse.json({ success: false, message: '範本版本無效' }, { status: 400 });
  const configId = request.nextUrl.searchParams.get('configId');
  const eventId = request.nextUrl.searchParams.get('eventId');
  const match = registryConfigured() && configId && eventId ? await resolveYearEvent(eventId, configId) : null;
  if (configId && !match) return NextResponse.json({ message: '找不到對應活動' }, { status: 404 });
  const eventType = match?.event.eventType;
  const bytes = eventType === '所有同工' ? createXlsxTemplate(allStaffHeaders)
    : eventType === '兒童聖誕午會' ? createXlsxTemplate(christmasHeaders)
    : eventType === '其他' ? createXlsxTemplate(version === '同工' ? ['序號', '姓名'] : ['報名序號', '兒童姓名'])
    : version === '同工'
    ? await readFile(join(process.cwd(), 'public/templates/staff-briefing-checkin-template.xlsx'))
    : createXlsxTemplate(kidsHeaders);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${version === '同工' ? 'staff' : 'kids'}-template.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const eventId = String(form.get('eventId') || '').trim();
    const version = String(form.get('version') || '').trim();
    const configId = String(form.get('configId') || '').trim();
    const file = form.get('file');
    if (!eventId || !['同工', '兒童'].includes(version) || !(file instanceof File)) {
      return NextResponse.json({ success: false, message: '缺少活動、版本或 XLSX 檔案' }, { status: 400 });
    }
    if (!hasAdminSession(request, eventId)) return NextResponse.json({ success: false, message: '登入已逾期，請重新登入後再匯入' }, { status: 401 });
    if (!file.name.toLowerCase().endsWith('.xlsx')) return NextResponse.json({ success: false, message: '請上傳 .xlsx 格式檔案' }, { status: 400 });
    if (file.size > 5 * 1024 * 1024) return NextResponse.json({ success: false, message: 'XLSX 檔案不可超過 5 MB' }, { status: 413 });

    const annual = registryConfigured();
    let sheetId = '';
    let logSheetId: string | null | undefined;
    let eventType = '';
    let resolvedVersion = '';
    if (annual) {
      const match = configId ? await resolveYearEvent(eventId, configId) : null;
      if (!match) return NextResponse.json({ success: false, message: '年度設定中找不到此活動' }, { status: 404 });
      sheetId = match.event.sheetId;
      logSheetId = match.event.logSheetId || null;
      resolvedVersion = match.event.version;
      eventType = match.event.eventType;
    } else {
      const configSheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
      if (!configSheetId) return NextResponse.json({ success: false, message: '未設定活動設定試算表' }, { status: 500 });
      const response = await getGoogleSheetsClient().spreadsheets.values.get({ spreadsheetId: configSheetId, range: 'A2:F' });
      const row = (response.data.values || []).find((item) => String(item[2] || '').trim() === eventId);
      if (!row?.[1]) return NextResponse.json({ success: false, message: '活動設定中找不到名單連結' }, { status: 404 });
      sheetId = extractSheetIdFromUrl(String(row[1]));
      logSheetId = row[4] ? extractSheetIdFromUrl(String(row[4])) : undefined;
      resolvedVersion = String(row[5] || '');
    }
    if (!sheetId) return NextResponse.json({ success: false, message: '活動名單連結無效' }, { status: 400 });
    if (resolvedVersion && !resolvedVersion.includes(version)) return NextResponse.json({ success: false, message: '匯入範本版本與活動設定不符' }, { status: 400 });

    const rows = parseXlsx(Buffer.from(await file.arrayBuffer()));
    if (rows.length < 2) return NextResponse.json({ success: false, message: 'XLSX 只有標題，沒有可匯入的名單' }, { status: 400 });
    if (rows.length > 5001) return NextResponse.json({ success: false, message: '單次最多匯入 5,000 筆' }, { status: 400 });
    const header = rows[0].map((value) => value.trim());
    const duplicateHeaders = header.filter((value, index) => value && header.indexOf(value) !== index);
    if (duplicateHeaders.length) return NextResponse.json({ success: false, message: `標題重複：${duplicateHeaders[0]}` }, { status: 400 });
    const indexOf = (name: string) => header.indexOf(name);
    const staff = version === '同工';
    const flexible = eventType === '其他';
    const named = (names: string[]) => names.map(indexOf).find((i) => i >= 0) ?? -1;
    const serialIndex = named(staff || flexible ? ['序號', '報名序號', '項次'] : ['報名序號']);
    const namedIndex = named(staff || flexible ? ['姓名', '兒童姓名'] : ['兒童姓名']);
    const nameIndex = namedIndex >= 0 || !flexible ? namedIndex : header.findIndex((label, i) => !!label && i !== serialIndex);
    if (nameIndex < 0 || (!flexible && serialIndex < 0)) return NextResponse.json({ success: false, message: 'XLSX 缺少序號或姓名欄位' }, { status: 400 });
    if (eventType === '兒童聖誕午會' || eventType === '所有同工') {
      const missing = (staff ? allStaffHeaders : christmasHeaders).filter((label) => indexOf(label) < 0);
      if (missing.length) return NextResponse.json({ success: false, message: `範本缺少欄位：${missing.join('、')}` }, { status: 400 });
    }
    const staffDetails = ['性別', '所屬小組', '聯絡組', '聯絡電話', '其他'];
    const namedDetails = header.filter((label, i) => label && i !== serialIndex && (i !== nameIndex || namedIndex < 0));
    const staffExtras = flexible ? namedDetails.filter((label) => !staffDetails.includes(label))
      : eventType === '所有同工' ? allStaffHeaders.filter((label) => label !== '項次' && label !== '姓名' && !staffDetails.includes(label))
      : staffExtraHeaders.filter((label) => indexOf(label) >= 0);
    const kidsDetails = flexible ? namedDetails.filter((label) => label !== '所屬小隊')
      : eventType === '兒童聖誕午會' ? christmasHeaders.slice(4) : kidsHeaders.slice(3);
    if (staff ? staffExtras.length > 17 : kidsDetails.length > 19) {
      return NextResponse.json({ success: false, message: '匯入欄位超過名單表容量，請減少欄位' }, { status: 400 });
    }
    const kidsSlots = Array.from({ length: 14 }, (_, i) => kidsDetails[i] || '');
    const kidsOverflow = kidsDetails.slice(14);
    const kidsThird = eventType === '兒童聖誕午會' ? '項次' : flexible ? '' : '備註';
    const outputHeader = staff
      ? ['序號', '姓名', '到達時間', '已到', ...staffDetails.map((label) =>
        (flexible || eventType === '所有同工') && !header.includes(label) ? '' : label), ...staffExtras]
      : ['已到', '到達時間', kidsThird, flexible && !header.includes('所屬小隊') ? '' : '所屬小隊', '報名序號', '兒童姓名', ...kidsSlots, '是否已聯繫', ...kidsOverflow];

    const seen = new Set<string>();
    const data = rows.slice(1).map((item, rowIndex) => {
      const get = (column: string) => { const i = indexOf(column); return i < 0 ? '' : String(item[i] || '').trim(); };
      const serial = serialIndex < 0 ? String(rowIndex + 1) : String(item[serialIndex] || '').trim();
      const name = String(item[nameIndex] || '').trim();
      const detail = (label: string) => label.includes('電話') ? formatContactPhone(get(label)) : label ? get(label) : '';
      if (eventType === '兒童聖誕午會' && !serial && !name
        && header.some((label) => label.startsWith('手足') && get(label))
        && header.every((label) => !label || label.startsWith('手足') || !get(label))) {
        return ['', '', '', '', '', '', ...kidsSlots.map(detail), ''];
      }
      if (!serial || !name) throw new Error(`第 ${rowIndex + 2} 列缺少序號或姓名`);
      const key = serial.toLocaleLowerCase();
      if (seen.has(key)) throw new Error(`序號重複：${serial}`);
      seen.add(key);
      if (staff) {
        const other = flexible || eventType === '所有同工' ? get('其他') : get('其他') || get('崗位');
        return [serial, name, '', 'FALSE', get('性別'), get('所屬小組'), get('聯絡組'), detail('聯絡電話'), other, ...staffExtras.map(detail)];
      }
      return ['FALSE', '', kidsThird ? get(kidsThird) : '', get('所屬小隊'), serial, name, ...kidsSlots.map(detail), '', ...kidsOverflow.map(detail)];
    });
    const sheets = getGoogleSheetsClient();
    const existing = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A1:Z', valueRenderOption: 'FORMULA' });
    const columnCount = Math.max(
      outputHeader.length,
      ...(existing.data.values || []).map((row) => row.length),
      ...data.map((row) => row.length),
    );
    const lastColumn = (index: number) => {
      let result = '';
      while (index > 0) { index--; result = String.fromCharCode(65 + index % 26) + result; index = Math.floor(index / 26); }
      return result;
    };
    const writeEndColumn = lastColumn(columnCount);
    const rowCount = Math.max((existing.data.values || []).length, data.length + 1);
    const replacement = [outputHeader, ...data];
    while (replacement.length < rowCount) replacement.push(Array(columnCount).fill(''));
    replacement.forEach((row) => { while (row.length < columnCount) row.push(''); });
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: [{ range: `A1:${writeEndColumn}${rowCount}`, values: replacement }],
      },
    });
    if (version === '兒童') invalidateKidsCache(sheetId);
    await logManagerAction({ eventId, logSheetId, action: 'import_attendees', identifier: String(seen.size), result: 'SUCCESS', message: `匯入 ${seen.size} 筆名單`, operator: 'Admin後台' });
    return NextResponse.json({ success: true, importedCount: seen.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : '匯入失敗';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
