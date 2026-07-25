import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;

if (!process.env.INTEGRATION_ENCRYPTION_KEY) {
  console.warn('[SECURITY WARNING] INTEGRATION_ENCRYPTION_KEY environment variable is not set. Using local development fallback key.');
}
const masterKeyStr = process.env.INTEGRATION_ENCRYPTION_KEY || 'fallback-master-key-must-be-32-chars-long-1234';

function getDerivedKey(): Buffer {
  return crypto.scryptSync(masterKeyStr, 'salt-zorvik-chat', KEY_LENGTH);
}

export function encrypt(text: string): string {
  try {
    const key = getDerivedKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  } catch (err) {
    console.error('Encryption failed:', err);
    throw new Error('Encryption failed');
  }
}

export function decrypt(cipherText: string): string {
  try {
    const parts = cipherText.split(':');
    if (parts.length !== 3) throw new Error('Invalid cipher text format');
    
    const [ivHex, tagHex, encryptedHex] = parts;
    const key = getDerivedKey();
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Decryption failed');
  }
}
