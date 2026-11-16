import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { google } from 'googleapis';
import { getGoogleSheetsClient } from '@/lib/google-sheets';
import { getYearRegistryId } from '@/lib/year-registry';

const TOKEN_RANGE = '年度設定!L2';

function encryptionKey() {
  const secret = process.env.YEAR_ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('YEAR_ADMIN_SESSION_SECRET 未設定');
  return createHash('sha256').update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.');
}

function decrypt(value: string) {
  const [iv, tag, payload] = value.split('.').map((part) => Buffer.from(part, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(payload), decipher.final()]).toString('utf8');
}

function oauthClient() {
  const { GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET } = process.env;
  if (!GOOGLE_OAUTH_CLIENT_ID || !GOOGLE_OAUTH_CLIENT_SECRET) throw new Error('尚未設定 Google OAuth 用戶端');
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || 'http://localhost:3000/api/admin/years/oauth/callback';
  return new google.auth.OAuth2(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, redirectUri);
}

export function createDriveConsentUrl(state: string) {
  return oauthClient().generateAuthUrl({
    access_type: 'offline', prompt: 'consent', state,
    scope: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
  });
}

export async function exchangeDriveCode(code: string) {
  const auth = oauthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) throw new Error('Google 沒有回傳 refresh token，請重新連結並確認授權畫面允許離線存取');
  return tokens.refresh_token;
}

export async function saveDriveRefreshToken(token: string) {
  const registryId = await getYearRegistryId();
  await getGoogleSheetsClient().spreadsheets.values.update({
    spreadsheetId: registryId, range: TOKEN_RANGE, valueInputOption: 'RAW', requestBody: { values: [[encrypt(token)]] },
  });
}

export async function isDriveConnected() {
  const registryId = await getYearRegistryId();
  const result = await getGoogleSheetsClient().spreadsheets.values.get({ spreadsheetId: registryId, range: TOKEN_RANGE });
  return Boolean(result.data.values?.[0]?.[0]);
}

export async function getUserDriveClients() {
  const registryId = await getYearRegistryId();
  const result = await getGoogleSheetsClient().spreadsheets.values.get({ spreadsheetId: registryId, range: TOKEN_RANGE });
  const stored = result.data.values?.[0]?.[0];
  if (!stored) throw new Error('請先連結可建立雲端檔案的 Google 帳號');
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: decrypt(stored) });
  return {
    sheets: google.sheets({ version: 'v4', auth }),
    drive: google.drive({ version: 'v3', auth }),
  };
}
