/**
 * R2 PDF 署名ユーティリティ
 * 
 * Firecrawl に渡す R2 PDF URL に署名と期限を付与し、
 * 不正アクセスを防止する。
 */

/**
 * HMAC-SHA256 署名を生成（16進数文字列）
 */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * 署名を検証
 */
export async function verifySignature(
  secret: string,
  key: string,
  exp: number,
  sig: string
): Promise<{ valid: boolean; reason?: string }> {
  // 期限チェック
  const now = Math.floor(Date.now() / 1000);
  if (exp < now) {
    return { valid: false, reason: 'URL expired' };
  }

  // 署名チェック
  const message = `${key}.${exp}`;
  const expectedSig = await hmacSha256Hex(secret, message);
  
  if (sig !== expectedSig) {
    return { valid: false, reason: 'Invalid signature' };
  }

  return { valid: true };
}

/**
 * 署名付き R2 PDF URL を生成
 * 
 * @param baseUrl - アプリケーションのベースURL (例: https://hojyokin.pages.dev)
 * @param r2Key - R2 オブジェクトのキー (例: pdf/a0WJ.../xxx.pdf)
 * @param secret - 署名シークレット
 * @param ttlSeconds - 有効期限（秒）、デフォルト600秒（10分）
 */
export async function buildSignedR2PdfUrl(
  baseUrl: string,
  r2Key: string,
  secret: string,
  ttlSeconds: number = 600
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const message = `${r2Key}.${exp}`;
  const sig = await hmacSha256Hex(secret, message);
  
  return `${baseUrl}/api/r2-pdf?key=${encodeURIComponent(r2Key)}&exp=${exp}&sig=${sig}`;
}

/**
 * r2:// URL から R2 キーを抽出
 * 
 * @param r2Url - r2://subsidy-knowledge/pdf/xxx.pdf 形式の URL
 * @returns R2 キー (pdf/xxx.pdf) または null
 */
export function extractR2Key(r2Url: string): string | null {
  const r2Prefix = 'r2://subsidy-knowledge/';
  if (r2Url.startsWith(r2Prefix)) {
    return r2Url.substring(r2Prefix.length);
  }
  return null;
}
