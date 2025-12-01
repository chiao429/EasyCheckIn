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
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
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
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:D', // 從第二列開始讀取（跳過標題）
    });

    const rows = response.data.values || [];
    return rows.map((row) => ({
      序號: row[0] || '',
      姓名: row[1] || '',
      到達時間: row[2] || '',
      已到: row[3] || 'FALSE',
    }));
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
    // 取得所有資料
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A2:D',
    });

    const rows = response.data.values || [];
    
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
      },
    };
  } catch (error) {
    console.error('Error during check-in:', error);
    throw new Error('簽到過程發生錯誤');
  }
}

// 初始化 Google Sheet（建立標題列）
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
export async function searchAttendee(
  sheetId: string,
  query: string
): Promise<Attendee[]> {
  const allAttendees = await getAllAttendees(sheetId);
  const trimmed = query.trim();
  const lowerQuery = trimmed.toLowerCase();

  // 1. 先用序號做「精準比對」
  const exactBySerial = allAttendees.filter(
    (attendee) => attendee.序號.toLowerCase() === lowerQuery
  );
  if (exactBySerial.length > 0) {
    return exactBySerial;
  }

  // 2. 若找不到序號，再用姓名做「模糊查詢」
  return allAttendees.filter((attendee) =>
    attendee.姓名.toLowerCase().includes(lowerQuery)
  );
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
    | 'mark_cancelled_failed';
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
