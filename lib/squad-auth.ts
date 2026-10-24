import { createHash, createHmac, timingSafeEqual } from 'crypto';

// 小隊長頁的登入憑證：HMAC 簽章，內含密碼指紋（改密碼後舊憑證自動失效）
const TOKEN_DAYS = 3;

function secret(): string {
  const base = process.env.ADMIN_JWT_SECRET || process.env.GOOGLE_PRIVATE_KEY || '';
  if (!base) throw new Error('缺少簽章用的伺服器設定');
  return createHash('sha256').update(`kids-squad:${base}`).digest('hex');
}

const fingerprint = (password: string) => createHash('sha256').update(password).digest('hex').slice(0, 16);
const sign = (payload: string) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function issueSquadToken(password: string): string {
  const payload = Buffer.from(
    JSON.stringify({ fp: fingerprint(password), exp: Date.now() + TOKEN_DAYS * 86_400_000 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifySquadToken(token: string | null | undefined, currentPassword: string): boolean {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  if (expected.length !== signature.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
    return false;
  }
  try {
    const { fp, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return exp > Date.now() && fp === fingerprint(currentPassword);
  } catch {
    return false;
  }
}

export function passwordMatches(input: string, actual: string): boolean {
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(actual).digest();
  return timingSafeEqual(a, b);
}
