import { google } from 'googleapis';

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
  const lowerQuery = query.toLowerCase();

  return allAttendees.filter(
    (attendee) =>
      attendee.序號.toLowerCase().includes(lowerQuery) ||
      attendee.姓名.toLowerCase().includes(lowerQuery)
  );
}
