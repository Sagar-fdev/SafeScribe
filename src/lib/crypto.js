import bcrypt from 'bcryptjs';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Hash a PIN using bcryptjs
 */
export function hashPin(pin) {
  return bcrypt.hashSync(pin, 10);
}

/**
 * Compare a raw PIN against a stored bcrypt hash
 */
export function comparePin(pin, hash) {
  if (!pin || !hash) return false;
  try {
    return bcrypt.compareSync(pin, hash);
  } catch (err) {
    console.error('Error comparing PIN:', err);
    return false;
  }
}

/**
 * Generate a random 16-character Recovery Code (e.g. ABCD-1234-EFGH-5678)
 */
export function generateRecoveryCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 16; i++) {
    if (i > 0 && i % 4 === 0) {
      code += '-';
    }
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Convert ArrayBuffer to Hex String
 */
export function arrayBufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert Hex String to ArrayBuffer
 */
export function hexToArrayBuffer(hex) {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return view.buffer;
}

/**
 * Derive AES key from PIN using PBKDF2
 */
async function deriveKey(pin, saltBytes, iterations = 100000) {
  const pinBytes = encoder.encode(pin);
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    pinBytes,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt plain text using a PIN derived key (AES-GCM)
 */
export async function encryptData(text, pin) {
  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, saltBytes);
  const textBytes = encoder.encode(text);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    textBytes
  );

  return {
    encryptedContent: arrayBufferToHex(encryptedBuffer),
    salt: arrayBufferToHex(saltBytes),
    iv: arrayBufferToHex(ivBytes),
  };
}

/**
 * Decrypt data using a PIN derived key (AES-GCM)
 */
export async function decryptData(encryptedHex, saltHex, ivHex, pin) {
  const saltBytes = new Uint8Array(hexToArrayBuffer(saltHex));
  const ivBytes = new Uint8Array(hexToArrayBuffer(ivHex));
  const encryptedBuffer = hexToArrayBuffer(encryptedHex);
  const key = await deriveKey(pin, saltBytes);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    encryptedBuffer
  );

  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt a PIN using a key derived from a Recovery Code
 */
export async function encryptPinWithRecoveryCode(pin, recoveryCode) {
  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(recoveryCode, saltBytes);
  const pinBytes = encoder.encode(pin);
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    pinBytes
  );

  return {
    encryptedPin: arrayBufferToHex(encryptedBuffer),
    recoverySalt: arrayBufferToHex(saltBytes),
    recoveryIv: arrayBufferToHex(ivBytes),
  };
}

/**
 * Decrypt a PIN using a key derived from a Recovery Code
 */
export async function decryptPinWithRecoveryCode(encryptedPinHex, recoverySaltHex, recoveryIvHex, recoveryCode) {
  const saltBytes = new Uint8Array(hexToArrayBuffer(recoverySaltHex));
  const ivBytes = new Uint8Array(hexToArrayBuffer(recoveryIvHex));
  const encryptedBuffer = hexToArrayBuffer(encryptedPinHex);
  const key = await deriveKey(recoveryCode, saltBytes);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes,
    },
    key,
    encryptedBuffer
  );

  return decoder.decode(decryptedBuffer);
}

/**
 * Encrypt both title and content using a key derived from keyMaterial.
 * Returns { encryptedTitle, encryptedContent, salt, iv }
 * Where:
 * - salt: salt used for key derivation
 * - iv: IV used for content encryption
 * - encryptedContent: hex of encrypted content
 * - encryptedTitle: title_iv_hex + ":" + title_ciphertext_hex
 */
export async function encryptNote(title, content, keyMaterial) {
  const saltBytes = window.crypto.getRandomValues(new Uint8Array(16));
  const contentIvBytes = window.crypto.getRandomValues(new Uint8Array(12));
  const titleIvBytes = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(keyMaterial, saltBytes);

  const titleBytes = encoder.encode(title || '');
  const contentBytes = encoder.encode(content || '');

  const encryptedTitleBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: titleIvBytes,
    },
    key,
    titleBytes
  );

  const encryptedContentBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: contentIvBytes,
    },
    key,
    contentBytes
  );

  const encryptedTitleHex = arrayBufferToHex(encryptedTitleBuffer);
  const titleIvHex = arrayBufferToHex(titleIvBytes);
  const encryptedContentHex = arrayBufferToHex(encryptedContentBuffer);
  const contentIvHex = arrayBufferToHex(contentIvBytes);

  return {
    encryptedTitle: `${titleIvHex}:${encryptedTitleHex}`,
    encryptedContent: encryptedContentHex,
    salt: arrayBufferToHex(saltBytes),
    iv: contentIvHex,
  };
}

/**
 * Decrypt both title and content using a key derived from keyMaterial.
 * Returns { title, content }
 */
export async function decryptNote(encryptedTitle, encryptedContent, saltHex, ivHex, keyMaterial) {
  if (!encryptedTitle && !encryptedContent) {
    return { title: '', content: '' };
  }

  const saltBytes = new Uint8Array(hexToArrayBuffer(saltHex));
  const key = await deriveKey(keyMaterial, saltBytes);

  let title = '';
  if (encryptedTitle) {
    const parts = encryptedTitle.split(':');
    if (parts.length === 2) {
      const titleIvBytes = new Uint8Array(hexToArrayBuffer(parts[0]));
      const titleEncryptedBuffer = hexToArrayBuffer(parts[1]);
      const decryptedTitleBuffer = await window.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: titleIvBytes,
        },
        key,
        titleEncryptedBuffer
      );
      title = decoder.decode(decryptedTitleBuffer);
    } else {
      throw new Error('Invalid encrypted title format (missing IV prefix)');
    }
  }

  let content = '';
  if (encryptedContent) {
    const contentIvBytes = new Uint8Array(hexToArrayBuffer(ivHex));
    const contentEncryptedBuffer = hexToArrayBuffer(encryptedContent);
    const decryptedContentBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: contentIvBytes,
      },
      key,
      contentEncryptedBuffer
    );
    content = decoder.decode(decryptedContentBuffer);
  }

  return { title, content };
}

