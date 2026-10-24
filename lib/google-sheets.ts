import { google } from 'googleapis';

// 共用：從 Google Sheet 連結或 ID 中抽出 Sheet ID
export function extractSheetIdFromUrl(urlOrId: string): string {
  if (!urlOrId) return '';
  if (!urlOrId.includes('docs.google.com')) return urlOrId.trim();

  const match = urlOrId.match(/\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : urlOrId.trim();
}

// Google Sheets API 客戶端
export function getGoogleSheetsClient() {
  const clientEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_CLIENT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    throw new Error(
      'Google Sheets credentials are missing: GOOGLE_CLIENT_EMAIL/GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY are required'
    );
  }

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: clientEmail,
      private_key: privateKey,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  return google.sheets({ version: 'v4', auth });
}

// 資料型別定義
export interface Attendee {
  序號: string;
  姓名: string;
  到達時間: string;
  已到: string;
  聯絡組?: string;
  需要聯繫?: string;
  詳細欄位?: DetailField[];
}

export interface DetailField {
  標題: string;
  值: string;
}

// 從活動設定試算表讀取後台密碼（資訊!A2）
export async function getAdminPasswordFromConfigSheet(): Promise<string | null> {
  const configSheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
  if (!configSheetId) {
    console.error('GOOGLE_EVENT_CONFIG_SHEET_ID is not set');
    return null;
  }

  const sheets = getGoogleSheetsClient();

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
      range: '資訊!A2:A2',
    });

    const rows = response.data.values || [];
    const password = rows[0]?.[0];
    if (!password || typeof password !== 'string') {
      console.warn('Admin password not found in 資訊!A2');
      return null;
    }

    return password;
  } catch (error) {
    console.error('Error reading admin password from config sheet:', error);
    return null;
  }
}

// 取得所有參加者資料
export async function getAllAttendees(sheetId: string): Promise<Attendee[]> {
  const sheets = getGoogleSheetsClient();
  
  try {
    // 讀取標題列和資料列
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:I', // 從第一列開始讀取（包含標題），包含 I 欄聯絡組
    });

    const rows = response.data.values || [];
    const headerRow = rows[0] || [];
    const dataRows = rows.slice(1);
    
    // 除錯：檢查前幾筆資料
    if (dataRows.length > 0) {
      console.log('Google Sheets 原始資料（前3筆）:', dataRows.slice(0, 3).map((row, idx) => ({
        列號: idx + 2,
        row長度: row.length,
        序號: row[0],
        姓名: row[1],
        已到: row[3],
        '性別_E': row[4],
        '所屬小組_F': row[5],
        '聯絡組_G': row[6],
        '聯絡電話_H': row[7],
        '其他_I': row[8],
      })));
    }
    
    return dataRows.map((row) => {
      // E~I 欄位 (索引 4~8)
      const extraHeaders = headerRow.slice(4, 9);
      const extraValues = row.slice(4, 9).map((v) => (v ?? '').toString());
      const 詳細欄位: DetailField[] = extraHeaders.map((h, idx) => ({
        標題: (h || '').toString(),
        值: extraValues[idx] || '',
      }));

      return {
        序號: row[0] || '',
        姓名: row[1] || '',
        到達時間: row[2] || '',
        已到: row[3] || 'FALSE',
        // 聯絡組別固定從 G 欄讀取（索引 6）
        聯絡組: (row[6] || '').toString().trim(),
        詳細欄位,
      };
    });
  } catch (error) {
    console.error('Error fetching attendees:', error);
    throw new Error('無法取得參加者資料');
  }
}

// 簽到功能
export async function checkIn(
  sheetId: string,
  identifier: string
): Promise<{ success: boolean; message: string; data?: Attendee }> {
  const sheets = getGoogleSheetsClient();

  try {
    // 取得所有資料（含標題列與 E~I 詳細欄位，供報到成功後顯示報名資訊）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:I',
    });

    const allRows = response.data.values || [];
    const headerRow = allRows[0] || [];
    const rows = allRows.slice(1);
    const detailsOf = (row: any[]): DetailField[] =>
      headerRow
        .slice(4, 9)
        .map((h, idx) => ({ 標題: (h || '').toString(), 值: (row[4 + idx] ?? '').toString() }))
        .filter((f) => f.標題.trim() !== '');
    
    // 尋找符合的序號或姓名
    let rowIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row[0] === identifier || row[1] === identifier) {
        rowIndex = i;
        break;
      }
    }

    if (rowIndex === -1) {
      return {
        success: false,
        message: '找不到此序號或姓名，請確認後再試',
      };
    }

    // 檢查是否已簽到
    if (rows[rowIndex][3] === 'TRUE') {
      return {
        success: false,
        message: '此序號/姓名已經簽到過了',
        data: {
          序號: rows[rowIndex][0],
          姓名: rows[rowIndex][1],
          到達時間: rows[rowIndex][2],
          已到: rows[rowIndex][3],
          詳細欄位: detailsOf(rows[rowIndex]),
        },
      };
    }

    // 更新簽到時間和狀態
    const now = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const actualRowIndex = rowIndex + 2; // +2 因為從第2列開始且索引從1開始
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `C${actualRowIndex}:D${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[now, 'TRUE']],
      },
    });

    return {
      success: true,
      message: '簽到成功！',
      data: {
        序號: rows[rowIndex][0],
        姓名: rows[rowIndex][1],
        到達時間: now,
        已到: 'TRUE',
        詳細欄位: detailsOf(rows[rowIndex]),
      },
    };
  } catch (error) {
    console.error('Error during check-in:', error);
    throw new Error('簽到過程發生錯誤');
  }
}

// 初始化 Google Sheet（建立標題列）
// ───────── 同一家人（聯絡電話相同）一起報到 ─────────

export interface FamilyMember {
  /** 試算表列號（1 起算，含標題列） */
  rowIndex: number;
  序號: string;
  姓名: string;
  已到: string;
  到達時間: string;
}

const normalizePhone = (v: unknown) => (v ?? '').toString().replace(/\D/g, '');

function taipeiNow() {
  return new Date().toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

async function readAdultSheet(sheetId: string) {
  const sheets = getGoogleSheetsClient();
  const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A1:I' });
  const allRows = response.data.values || [];
  const headerRow = (allRows[0] || []).map((h) => (h || '').toString());
  const rows = allRows.slice(1);
  // 聯絡電話欄：E~I 欄中標題含「電話」的第一欄
  const phoneCol = headerRow.findIndex((h, idx) => idx >= 4 && idx <= 8 && h.includes('電話'));
  const detailsOf = (row: any[]): DetailField[] =>
    headerRow
      .slice(4, 9)
      .map((h, idx) => ({ 標題: h, 值: (row[4 + idx] ?? '').toString() }))
      .filter((f) => f.標題.trim() !== '');
  return { sheets, headerRow, rows, phoneCol, detailsOf };
}

const toMember = (row: any[], i: number): FamilyMember => ({
  rowIndex: i + 2,
  序號: (row[0] || '').toString(),
  姓名: (row[1] || '').toString(),
  到達時間: (row[2] || '').toString(),
  已到: (row[3] || '').toString(),
});

/** 找到輸入的人，以及與他聯絡電話相同的其他人（家人） */
export async function findFamily(
  sheetId: string,
  identifier: string
): Promise<{ main: FamilyMember; others: FamilyMember[] } | null> {
  const { rows, phoneCol } = await readAdultSheet(sheetId);
  const idx = rows.findIndex((row) => row[0] === identifier || row[1] === identifier);
  if (idx === -1) return null;
  const main = toMember(rows[idx], idx);
  if (phoneCol === -1) return { main, others: [] };
  const phone = normalizePhone(rows[idx][phoneCol]);
  // 號碼太短（空白或不完整）不視為家人，避免把所有沒填電話的人湊在一起
  if (phone.length < 8) return { main, others: [] };
  const others = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => i !== idx && normalizePhone(row[phoneCol]) === phone && (row[1] || '').toString().trim())
    .map(({ row, i }) => toMember(row, i));
  return { main, others };
}

/**
 * 一次替多列報到（同一家人）。
 * 寫入前重新讀取並確認列號對應的姓名沒變，已報到者略過。
 */
export async function checkInRows(
  sheetId: string,
  targets: { rowIndex: number; 姓名: string }[]
): Promise<{ checkedIn: Attendee[]; skipped: { 姓名: string; reason: string }[] }> {
  const { sheets, rows, detailsOf } = await readAdultSheet(sheetId);
  const now = taipeiNow();
  const checkedIn: Attendee[] = [];
  const skipped: { 姓名: string; reason: string }[] = [];
  const data: { range: string; values: string[][] }[] = [];

  for (const t of targets) {
    const row = rows[t.rowIndex - 2];
    if (!row || (row[1] || '').toString() !== t.姓名) {
      skipped.push({ 姓名: t.姓名, reason: '資料已變動，請重新查詢' });
      continue;
    }
    if (row[3] === 'TRUE') {
      skipped.push({ 姓名: t.姓名, reason: `已於 ${row[2] || ''} 簽到` });
      continue;
    }
    data.push({ range: `C${t.rowIndex}:D${t.rowIndex}`, values: [[now, 'TRUE']] });
    checkedIn.push({
      序號: (row[0] || '').toString(),
      姓名: t.姓名,
      到達時間: now,
      已到: 'TRUE',
      詳細欄位: detailsOf(row),
    });
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
  }
  return { checkedIn, skipped };
}

export async function initializeSheet(sheetId: string): Promise<void> {
  const sheets = getGoogleSheetsClient();

  try {
    // 檢查是否已有標題列
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:D1',
    });

    if (!response.data.values || response.data.values.length === 0) {
      // 建立標題列
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: 'A1:D1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['序號', '姓名', '到達時間', '已到']],
        },
      });
    }
  } catch (error) {
    console.error('Error initializing sheet:', error);
    throw new Error('無法初始化工作表');
  }
}

// 搜尋參加者
export interface AttendeeWithDetails extends Attendee {
  詳細欄位?: DetailField[];
}

export async function searchAttendee(
  sheetId: string,
  query: string
): Promise<AttendeeWithDetails[]> {
  const sheets = getGoogleSheetsClient();

  // 一次讀取 A1:H，第一列為標題列，其餘為資料列
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'A1:H',
  });

  const rows = response.data.values || [];
  const headerRow = rows[0] || [];
  const dataRows = rows.slice(1);

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  const all: AttendeeWithDetails[] = dataRows.map((row) => {
    const 序號 = (row[0] || '').toString();
    const 姓名 = (row[1] || '').toString();
    const 到達時間 = (row[2] || '').toString();
    const 已到 = (row[3] || '').toString() || 'FALSE';

    // E~H 欄位 (索引 4~7)
    const extraHeaders = headerRow.slice(4, 8);
    const extraValues = row.slice(4, 8).map((v) => (v ?? '').toString());
    const 詳細欄位: DetailField[] = extraHeaders.map((h, idx) => ({
      標題: (h || '').toString(),
      值: extraValues[idx] || '',
    }));

    return {
      序號,
      姓名,
      到達時間,
      已到,
      詳細欄位,
    };
  });

  // 1. 先用序號做「精準比對」
  const exactBySerial = all.filter(
    (attendee) => attendee.序號.toLowerCase() === lowerQuery
  );
  if (exactBySerial.length > 0) {
    return exactBySerial;
  }

  // 2. 若找不到序號，再用姓名做「模糊查詢」
  return all.filter((attendee) =>
    attendee.姓名.toLowerCase().includes(lowerQuery)
  );
}

// 兒童版：以不同欄位配置讀取出席名單
// 實際 Sheet 欄位：
// A: 已到, B: 到達時間, C~T: 其他欄位, U: 是否已聯繫, E: 報名序號, F: 兒童姓名
// 但在程式內統一轉成 Attendee 介面：
// 序號 = 報名序號(E), 姓名 = 兒童姓名(F), 到達時間 = B, 已到 = A, 需要聯繫 = U
export async function getAllKidsAttendees(sheetId: string): Promise<Attendee[]> {
  const sheets = getGoogleSheetsClient();

  try {
    // 讀取標題列和資料列，包含到 U 欄
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:U', // 從第一列開始讀取（包含標題），到 U 欄
    });

    const rows = response.data.values || [];
    const headerRow = rows[0] || [];
    const dataRows = rows.slice(1);

    return dataRows
      .map((row) => {
        const 已到 = (row[0] || '').toString();
        const 到達時間 = (row[1] || '').toString();
        const 序號 = (row[4] || '').toString(); // E 欄
        const 姓名 = (row[5] || '').toString(); // F 欄
        const 需要聯繫 = (row[20] || '').toString(); // U 欄 (索引 20)

        // D~T 欄位 (索引 3~19) 作為詳細欄位
        const extraHeaders = headerRow.slice(3, 20);
        const extraValues = row.slice(3, 20).map((v) => (v ?? '').toString());
        const 詳細欄位: DetailField[] = extraHeaders.map((h, idx) => ({
          標題: (h || '').toString(),
          值: extraValues[idx] || '',
        }));

        return {
          序號,
          姓名,
          到達時間,
          已到: 已到 || 'FALSE',
          需要聯繫,
          詳細欄位,
        };
      })
      .filter((attendee) => {
        // 過濾掉姓名和序號都是空白的資料（合併儲存格造成的空白列）
        return attendee.姓名.trim() !== '' || attendee.序號.trim() !== '';
      });
  } catch (error) {
    console.error('Error fetching kids attendees:', error);
    throw new Error('無法取得兒童出席名單資料');
  }
}

export interface KidsDetailField {
  標題: string;
  值: string;
}

export interface KidsAttendeeDetails extends Attendee {
  詳細欄位?: KidsDetailField[];
  rowIndex?: number;
}

// 簡單的兒童名單快取：以 sheetId 為 key，短時間內重複查詢時共用同一份資料
interface KidsSheetCacheEntry {
  headerRow: any[];
  dataRows: any[][];
  fetchedAt: number;
}

const kidsSheetCache = new Map<string, KidsSheetCacheEntry>();
const KIDS_SHEET_CACHE_TTL_MS = 10_000; // 10 秒快取時間，可視情況調整

export async function searchKidsAttendee(
  sheetId: string,
  query: string
): Promise<KidsAttendeeDetails[]> {
  const sheets = getGoogleSheetsClient();

  // 兒童名單實際欄位：
  // A: 已到, B: 到達時間, C: ?(保留), D: 所屬小隊, E: 報名序號, F: 兒童姓名, G~K: 其他欄位
  // 這裡一次讀取 A1:K，第一列作為標題，第二列以後是資料

  const now = Date.now();
  let headerRow: any[] = [];
  let dataRows: any[][] = [];

  const cached = kidsSheetCache.get(sheetId);
  if (cached && now - cached.fetchedAt < KIDS_SHEET_CACHE_TTL_MS) {
    headerRow = cached.headerRow;
    dataRows = cached.dataRows;
  } else {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A1:K',
    });

    const rows = response.data.values || [];
    headerRow = rows[0] || [];
    dataRows = rows.slice(1);

    kidsSheetCache.set(sheetId, {
      headerRow,
      dataRows,
      fetchedAt: now,
    });
  }

  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  const nameMatches: KidsAttendeeDetails[] = [];
  const extraHeaders = headerRow.slice(3, 11); // D~K

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const status = (row[0] || '').toString();
    const time = (row[1] || '').toString();
    const serial = (row[4] || '').toString();
    const name = (row[5] || '').toString();

    // 跳過姓名和序號都是空白的資料（合併儲存格造成的空白列）
    if (!serial.trim() && !name.trim()) continue;

    const serialLower = serial.toLowerCase();
    const nameLower = name.toLowerCase();
    const sheetRowIndex = i + 2;

    // 1. 若序號與查詢字串精準相同，立刻回傳單筆結果
    if (serialLower === lowerQuery) {
      const extraValues = row.slice(3, 11).map((v) => (v ?? '').toString());
      const 詳細欄位: KidsDetailField[] = extraHeaders.map((h, idx) => ({
        標題: (h || '').toString(),
        值: extraValues[idx] || '',
      }));
      return [
        {
          序號: serial,
          姓名: name,
          到達時間: time,
          已到: status || 'FALSE',
          詳細欄位,
          rowIndex: sheetRowIndex,
        },
      ];
    }

    // 2. 否則記錄姓名模糊比對的結果，最後一起回傳
    if (nameLower.includes(lowerQuery)) {
      const extraValues = row.slice(3, 11).map((v) => (v ?? '').toString());
      const 詳細欄位: KidsDetailField[] = extraHeaders.map((h, idx) => ({
        標題: (h || '').toString(),
        值: extraValues[idx] || '',
      }));
      nameMatches.push({
        序號: serial,
        姓名: name,
        到達時間: time,
        已到: status || 'FALSE',
        詳細欄位,
        rowIndex: sheetRowIndex,
      });
    }
  }

  // 若沒有序號精準符合，就回傳所有姓名模糊比對的結果
  return nameMatches;
}

// 兒童版簽到：依照兒童名單欄位配置更新 A:已到, B:到達時間
export async function checkInKids(
  sheetId: string,
  identifier: string,
  rowIndex?: number
): Promise<{ success: boolean; message: string; data?: Attendee }> {
  const sheets = getGoogleSheetsClient();

  try {
    if (typeof rowIndex === 'number' && rowIndex >= 2) {
      const targetRowNumber = rowIndex;
      // 寫入前重新讀取該列：已報到不得重複報到；列內容與序號/姓名不符時（列被移動）拒絕寫入
      const current = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: `A${targetRowNumber}:F${targetRowNumber}`,
      });
      const currentRow = current.data.values?.[0] || [];
      const currentSerial = (currentRow[4] || '').toString();
      const currentName = (currentRow[5] || '').toString();
      if (identifier && identifier !== currentSerial && identifier !== currentName) {
        return { success: false, message: '資料已變動，請重新搜尋後再報到' };
      }
      if ((currentRow[0] || '').toString() === 'TRUE') {
        return {
          success: false,
          message: `此兒童已於 ${(currentRow[1] || '').toString()} 報到過，不可重複報到`,
          data: { 序號: currentSerial, 姓名: currentName, 到達時間: (currentRow[1] || '').toString(), 已到: 'TRUE' },
        };
      }
      const now = new Date().toLocaleString('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `A${targetRowNumber}:B${targetRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['TRUE', now]],
        },
      });

      kidsFullSheetCache.delete(sheetId);
      const cached = kidsSheetCache.get(sheetId);
      if (cached) {
        const cacheRowIndex = targetRowNumber - 2;
        if (cacheRowIndex >= 0 && cacheRowIndex < cached.dataRows.length) {
          const cacheRow = cached.dataRows[cacheRowIndex] || [];
          cacheRow[0] = 'TRUE';
          cacheRow[1] = now;
          cached.dataRows[cacheRowIndex] = cacheRow;
        }
      }

      return {
        success: true,
        message: '簽到成功！',
        data: {
          序號: identifier,
          姓名: identifier,
          到達時間: now,
          已到: 'TRUE',
        },
      };
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:F',
    });

    const rows = response.data.values || [];

    let matchedIndex = -1;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const serial = (row[4] || '').toString();
      const name = (row[5] || '').toString();
      if (serial === identifier || name === identifier) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex === -1) {
      return {
        success: false,
        message: '找不到此序號或姓名，請確認後再試',
      };
    }

    const row = rows[matchedIndex];
    const currentStatus = (row[0] || '').toString();

    if (currentStatus === 'TRUE') {
      const 序號 = (row[4] || '').toString();
      const 姓名 = (row[5] || '').toString();
      const 到達時間 = (row[1] || '').toString();

      return {
        success: false,
        message: '此序號/姓名已經簽到過了',
        data: {
          序號,
          姓名,
          到達時間,
          已到: 'TRUE',
        },
      };
    }

    const now = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const actualRowIndex = matchedIndex + 2;
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `A${actualRowIndex}:B${actualRowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [['TRUE', now]],
      },
    });

    const updatedRow = rows[matchedIndex];
    const 序號 = (updatedRow[4] || '').toString();
    const 姓名 = (updatedRow[5] || '').toString();

    return {
      success: true,
      message: '簽到成功！',
      data: {
        序號,
        姓名,
        到達時間: now,
        已到: 'TRUE',
      },
    };
  } catch (error) {
    console.error('Error during kids check-in:', error);
    throw new Error('兒童簽到過程發生錯誤');
  }
}

// ───────── 兒童版：同一家庭（家長電話相同）一起報到 ─────────

/**
 * 讀取兒童名單並找出家長電話欄。
 * 家長姓名/電話若是合併儲存格，只有第一列有值：兩欄都空白時沿用上一列（與 toggle-contact 相同作法）。
 */
const kidsFullSheetCache = new Map<string, { values: any[][]; fetchedAt: number }>();

async function readKidsSheet(sheetId: string, opts: { fresh?: boolean } = {}) {
  const sheets = getGoogleSheetsClient();
  // 查詢同戶資料用 10 秒快取（減少 Google API 讀取次數）；寫入前一律重新讀取
  const cachedFull = kidsFullSheetCache.get(sheetId);
  let allRows: any[][];
  if (!opts.fresh && cachedFull && Date.now() - cachedFull.fetchedAt < KIDS_SHEET_CACHE_TTL_MS) {
    allRows = cachedFull.values;
  } else {
    const response = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'A1:U' });
    allRows = response.data.values || [];
    kidsFullSheetCache.set(sheetId, { values: allRows, fetchedAt: Date.now() });
  }
  const headerRow = (allRows[0] || []).map((h) => (h || '').toString());
  const rows = allRows.slice(1);
  const phoneCol =
    headerRow.findIndex((h) => h.includes('家長') && h.includes('電話')) !== -1
      ? headerRow.findIndex((h) => h.includes('家長') && h.includes('電話'))
      : headerRow.findIndex((h, idx) => idx >= 6 && h.includes('電話'));
  const parentCol = headerRow.findIndex((h) => h.includes('家長') && !h.includes('電話'));

  const phones: string[] = [];
  let lastPhone = '';
  rows.forEach((row, i) => {
    const hasKid = !!((row[4] || '').toString().trim() || (row[5] || '').toString().trim());
    let phone = phoneCol === -1 ? '' : normalizePhone(row[phoneCol]);
    const parent = parentCol === -1 ? '' : (row[parentCol] || '').toString().trim();
    if (!phone && !parent && hasKid && i > 0) phone = lastPhone;
    if (!hasKid) lastPhone = '';
    else lastPhone = phone;
    phones.push(phone);
  });

  // 與 searchKidsAttendee 相同：D~K 欄做為詳細資料（第一欄通常是所屬小隊）
  const detailsOf = (row: any[]): DetailField[] =>
    headerRow.slice(3, 11).map((h, idx) => ({ 標題: h, 值: (row[3 + idx] ?? '').toString() }));
  return { sheets, headerRow, rows, phones, detailsOf };
}

export interface KidsFamilyMember {
  rowIndex: number;
  序號: string;
  姓名: string;
  已到: string;
  到達時間: string;
  小隊: string;
  詳細欄位: DetailField[];
}

export async function findKidsFamily(
  sheetId: string,
  rowIndex: number
): Promise<{ main: KidsFamilyMember; others: KidsFamilyMember[] } | null> {
  const { rows, phones, detailsOf } = await readKidsSheet(sheetId);
  const toMember = (row: any[], i: number): KidsFamilyMember => ({
    rowIndex: i + 2,
    序號: (row[4] || '').toString(),
    姓名: (row[5] || '').toString(),
    已到: (row[0] || '').toString(),
    到達時間: (row[1] || '').toString(),
    小隊: detailsOf(row)[0]?.值 || '',
    詳細欄位: detailsOf(row),
  });
  const idx = rowIndex - 2;
  if (!rows[idx]) return null;
  const main = toMember(rows[idx], idx);
  const phone = phones[idx];
  if (!phone || phone.length < 8) return { main, others: [] };
  const others = rows
    .map((row, i) => ({ row, i }))
    .filter(({ row, i }) => i !== idx && phones[i] === phone && (row[5] || '').toString().trim())
    .map(({ row, i }) => toMember(row, i));
  return { main, others };
}

export async function checkInKidsRows(
  sheetId: string,
  targets: { rowIndex: number; 姓名: string }[]
): Promise<{ checkedIn: (Attendee & { rowIndex: number })[]; skipped: { 姓名: string; reason: string }[] }> {
  const { sheets, rows, detailsOf } = await readKidsSheet(sheetId, { fresh: true });
  const now = taipeiNow();
  const checkedIn: (Attendee & { rowIndex: number })[] = [];
  const skipped: { 姓名: string; reason: string }[] = [];
  const data: { range: string; values: string[][] }[] = [];

  for (const t of targets) {
    const row = rows[t.rowIndex - 2];
    if (!row || (row[5] || '').toString() !== t.姓名) {
      skipped.push({ 姓名: t.姓名, reason: '資料已變動，請重新查詢' });
      continue;
    }
    if (row[0] === 'TRUE') {
      skipped.push({ 姓名: t.姓名, reason: `已於 ${row[1] || ''} 報到` });
      continue;
    }
    data.push({ range: `A${t.rowIndex}:B${t.rowIndex}`, values: [['TRUE', now]] });
    checkedIn.push({
      rowIndex: t.rowIndex,
      序號: (row[4] || '').toString(),
      姓名: t.姓名,
      到達時間: now,
      已到: 'TRUE',
      詳細欄位: detailsOf(row),
    });
  }

  if (data.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: { valueInputOption: 'RAW', data },
    });
    // 同步快取，避免 10 秒內查詢仍顯示未報到
    kidsFullSheetCache.delete(sheetId);
    const cached = kidsSheetCache.get(sheetId);
    if (cached) {
      for (const c of checkedIn) {
        const cacheRow = cached.dataRows[c.rowIndex - 2];
        if (cacheRow) {
          cacheRow[0] = 'TRUE';
          cacheRow[1] = now;
        }
      }
    }
  }
  return { checkedIn, skipped };
}

// 紀錄管理員相關操作（例如代為簽到、取消簽到、標記不會來）
// 以 eventId 為主鍵從活動設定表中找到對應列，依據該列 E 欄的 log sheet 連結寫入紀錄
export async function logManagerAction(params: {
  eventId: string;
  action:
    | 'manager_checkin'
    | 'manager_checkin_failed'
    | 'cancel_checkin'
    | 'cancel_checkin_failed'
    | 'mark_cancelled'
    | 'mark_cancelled_failed'
    | 'mark_late'
    | 'mark_late_failed'
    | 'toggle_contact'
    | 'toggle_contact_failed'
    | 'admin_login'
    | 'system_error'
    | 'system_warning';
  identifier: string;
  attendeeName?: string;
  result: 'SUCCESS' | 'FAILED';
  message?: string;
  operator?: string;
}) {
  const { eventId, action, identifier, attendeeName, result, message, operator } = params;

  const configSheetId = process.env.GOOGLE_EVENT_CONFIG_SHEET_ID;
  if (!configSheetId) {
    console.error('GOOGLE_EVENT_CONFIG_SHEET_ID is not set, skip manager log');
    return;
  }

  const sheets = getGoogleSheetsClient();

  try {
    // 讀取活動設定表，假設結構：
    // A: 活動名稱
    // B: 活動試算表連結
    // C: eventId
    // D: 備註
    // E: 操作紀錄連結（log Sheet 連結）
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: configSheetId,
      range: 'A2:E',
    });

    const rows = response.data.values || [];

    let logSheetId: string | null = null;

    for (const row of rows) {
      const rowEventId = (row[2] || '').toString();
      if (!rowEventId) continue;

      if (rowEventId === eventId) {
        const logSheetLink = row[4] || '';
        if (!logSheetLink) {
          console.warn('No log sheet link configured for eventId:', eventId);
          return;
        }
        logSheetId = extractSheetIdFromUrl(logSheetLink);
        break;
      }
    }

    if (!logSheetId) {
      console.warn('logManagerAction: cannot find matching log sheet for eventId', eventId);
      return;
    }

    console.log('logManagerAction: using logSheetId for eventId', {
      eventId,
      logSheetId,
      action,
    });

    const now = new Date().toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    // 將內部動作代碼轉成中文描述
    const displayAction = (() => {
      switch (action) {
        case 'manager_checkin':
          return '代為簽到-成功';
        case 'manager_checkin_failed':
          return '代為簽到-失敗';
        case 'cancel_checkin':
          return '取消簽到-成功';
        case 'cancel_checkin_failed':
          return '取消簽到-失敗';
        case 'mark_cancelled':
          return '標記不會來-成功';
        case 'mark_cancelled_failed':
          return '標記不會來-失敗';
        case 'mark_late':
          return '標記晚到-成功';
        case 'mark_late_failed':
          return '標記晚到-失敗';
        case 'admin_login':
          return '後台登入-成功';
        case 'system_error':
          return '系統錯誤';
        case 'system_warning':
          return '系統警告';
        default:
          return action;
      }
    })();

    // 確保 log Sheet 有標題列
    const headerResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: logSheetId,
      range: 'A1:G1',
    });

    if (!headerResponse.data.values || headerResponse.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: logSheetId,
        range: 'A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['時間', '操作人員', '動作', '序號', '姓名', '操作結果', '備註']],
        },
      });
    }

    // 寫入一筆 log 記錄（欄位順序：時間, 操作人員, 動作, 序號, 姓名, 操作結果, 備註）
    await sheets.spreadsheets.values.append({
      spreadsheetId: logSheetId,
      range: 'A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          now,
          operator || '',
          displayAction,
          identifier,
          attendeeName || '',
          result,
          message && message.trim() ? message : '-',
        ]],
      },
    });
  } catch (error) {
    console.error('Error logging manager action:', error);
  }
}

/** 兒童名單被其他 API 直接修改後呼叫，清除搜尋與同戶查詢的快取 */
export function invalidateKidsCache(sheetId: string) {
  kidsSheetCache.delete(sheetId);
  kidsFullSheetCache.delete(sheetId);
}
