/**
 * パスワードハッシュ (PBKDF2-SHA256)
 * 
 * Cloudflare Workers の WebCrypto API を使用
 * 保存形式: pbkdf2_sha256$iterations$salt_base64$hash_base64
 */

const ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000;  // Cloudflare Workers limit (max 100000)
const KEY_LENGTH = 32;      // 256 bits
const SALT_LENGTH = 16;     // 128 bits

/**
 * ランダムなソルトを生成
 */
function generateSalt(length: number = SALT_LENGTH): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Uint8Array を Base64 に変換
 */
function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Base64 を Uint8Array に変換
 */
function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * PBKDF2でハッシュを生成
 */
async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = ITERATIONS
): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  // パスワードからキーマテリアルを生成
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    ALGORITHM,
    false,
    ['deriveBits']
  );
  
  // PBKDF2でキーを導出
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt,
      iterations: iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH * 8 // bits
  );
  
  return new Uint8Array(derivedBits);
}

/**
 * パスワードをハッシュ化
 * 
 * @param password - 平文パスワード
 * @returns 保存用ハッシュ文字列 (pbkdf2_sha256$iterations$salt$hash)
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  
  return `pbkdf2_sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

/**
 * パスワードを検証
 * 
 * @param password - 平文パスワード
 * @param storedHash - 保存されたハッシュ文字列
 * @returns 一致すれば true
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') {
      return false;
    }
    
    const iterations = parseInt(parts[1], 10);
    const salt = fromBase64(parts[2]);
    const expectedHash = fromBase64(parts[3]);
    
    const actualHash = await deriveKey(password, salt, iterations);
    
    // タイミング攻撃対策: 定数時間比較
    if (actualHash.length !== expectedHash.length) {
      return false;
    }
    
    let result = 0;
    for (let i = 0; i < actualHash.length; i++) {
      result |= actualHash[i] ^ expectedHash[i];
    }
    
    return result === 0;
  } catch {
    return false;
  }
}

/**
 * パスワード強度チェック
 * 
 * @param password - 平文パスワード
 * @returns エラーメッセージの配列（空なら合格）
 */
export function validatePasswordStrength(password: string): string[] {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('パスワードは8文字以上必要です');
  }
  if (password.length > 128) {
    errors.push('パスワードは128文字以下にしてください');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('小文字(a-z)を含めてください');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('大文字(A-Z)を含めてください');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('数字(0-9)を含めてください');
  }
  
  return errors;
}
