const crypto = require('crypto');

const KMS_KEY_NAME = process.env.KMS_KEY_NAME || null;
const FALLBACK_SECRET_KEY = crypto.createHash('sha256')
  .update(process.env.IMAP_ENCRYPTION_KEY || process.env.ENCRYPTION_SECRET || process.env.SESSION_SECRET || 'finanzapp-vault-secret-salt-2026')
  .digest();

async function encryptKms(plaintext) {
  if (!plaintext) return null;
  if (!KMS_KEY_NAME) {
    return plaintext;
  }
  const { KeyManagementServiceClient } = require('@google-cloud/kms');
  const kmsClient = new KeyManagementServiceClient();
  const [result] = await kmsClient.encrypt({ name: KMS_KEY_NAME, plaintext: Buffer.from(plaintext) });
  return result.ciphertext.toString('base64');
}

async function decryptKms(ciphertextBase64) {
  if (!ciphertextBase64) return null;
  if (!KMS_KEY_NAME) {
    return ciphertextBase64;
  }
  const { KeyManagementServiceClient } = require('@google-cloud/kms');
  const kmsClient = new KeyManagementServiceClient();
  const [result] = await kmsClient.decrypt({ name: KMS_KEY_NAME, ciphertext: Buffer.from(ciphertextBase64, 'base64') });
  return result.plaintext.toString();
}

/**
 * Cifra secretos con KMS si está disponible, o mediante AES-256-GCM localmente.
 * @param {string} plaintext
 * @returns {Promise<string|null>}
 */
async function encryptSecret(plaintext) {
  if (!plaintext) return null;
  if (KMS_KEY_NAME) {
    try {
      const encrypted = await encryptKms(plaintext);
      if (encrypted && encrypted !== plaintext) return encrypted;
    } catch (e) {
      console.warn('[encryptSecret] KMS falló, usando AES-256-GCM:', e.message);
    }
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', FALLBACK_SECRET_KEY, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `aes:${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Descifra secretos soportando tanto AES-256-GCM como KMS o texto plano heredado.
 * @param {string} ciphertext
 * @returns {Promise<string|null>}
 */
async function decryptSecret(ciphertext) {
  if (!ciphertext) return null;
  if (typeof ciphertext === 'string' && ciphertext.startsWith('aes:')) {
    const parts = ciphertext.split(':');
    if (parts.length === 4) {
      try {
        const iv = Buffer.from(parts[1], 'hex');
        const authTag = Buffer.from(parts[2], 'hex');
        const encrypted = parts[3];
        const decipher = crypto.createDecipheriv('aes-256-gcm', FALLBACK_SECRET_KEY, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch (err) {
        console.error('[decryptSecret] Error descifrando AES-256:', err.message);
        return null;
      }
    }
  }
  if (KMS_KEY_NAME) {
    try {
      return await decryptKms(ciphertext);
    } catch (e) {
      console.warn('[decryptSecret] KMS falló, retornando como texto plano:', e.message);
    }
  }
  return ciphertext;
}

module.exports = {
  encryptSecret,
  decryptSecret,
  encryptKms,
  decryptKms
};

