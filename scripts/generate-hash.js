/**
 * Generate password hash using PBKDF2-SHA256
 */
const ALGORITHM = 'PBKDF2';
const HASH_ALGORITHM = 'SHA-256';
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;

function generateSalt(length = SALT_LENGTH) {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBase64(bytes) {
  // Node.js Buffer approach
  return Buffer.from(bytes).toString('base64');
}

async function deriveKey(password, salt, iterations = ITERATIONS) {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordBuffer,
    ALGORITHM,
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: ALGORITHM,
      salt: salt,
      iterations: iterations,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    KEY_LENGTH * 8
  );
  
  return new Uint8Array(derivedBits);
}

async function hashPassword(password) {
  const salt = generateSalt();
  const hash = await deriveKey(password, salt);
  
  return `pbkdf2_sha256$${ITERATIONS}$${toBase64(salt)}$${toBase64(hash)}`;
}

// Generate hash for test password
async function main() {
  const password = 'SuperAdmin123';
  const hash = await hashPassword(password);
  console.log('Password:', password);
  console.log('Hash:', hash);
}

main();
