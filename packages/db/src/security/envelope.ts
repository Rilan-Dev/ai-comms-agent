import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const VERSION = 1;

export interface EncryptedEnvelope {
  version: number;
  algorithm: typeof ALGORITHM;
  wrappedKey: string;
  wrappedKeyIv: string;
  wrappedKeyTag: string;
  ciphertext: string;
  ciphertextIv: string;
  ciphertextTag: string;
}

function assertKey(key: Buffer): void {
  if (key.length !== KEY_BYTES) {
    throw new Error("CREDENTIALS_MASTER_KEY must be exactly 32 bytes");
  }
}

function encryptWithKey(plaintext: Buffer, key: Buffer): {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
} {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

function decryptWithKey(ciphertext: Buffer, key: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Envelope-encrypt a credential payload.
 *
 * A fresh DEK encrypts the payload. The DEK is then wrapped by the KEK.
 * The serialized envelope is suitable for the bytea database columns.
 */
export function encryptCredential(plaintext: string | Buffer, kek: Buffer): Buffer {
  assertKey(kek);
  const dek = randomBytes(KEY_BYTES);
  const payload = Buffer.isBuffer(plaintext) ? plaintext : Buffer.from(plaintext, "utf8");

  const encryptedPayload = encryptWithKey(payload, dek);
  const wrappedDek = encryptWithKey(dek, kek);

  const envelope: EncryptedEnvelope = {
    version: VERSION,
    algorithm: ALGORITHM,
    wrappedKey: wrappedDek.ciphertext.toString("base64"),
    wrappedKeyIv: wrappedDek.iv.toString("base64"),
    wrappedKeyTag: wrappedDek.tag.toString("base64"),
    ciphertext: encryptedPayload.ciphertext.toString("base64"),
    ciphertextIv: encryptedPayload.iv.toString("base64"),
    ciphertextTag: encryptedPayload.tag.toString("base64"),
  };

  return Buffer.from(JSON.stringify(envelope), "utf8");
}

export function decryptCredential(envelopeBytes: Buffer, kek: Buffer): Buffer {
  assertKey(kek);
  let envelope: EncryptedEnvelope;

  try {
    envelope = JSON.parse(envelopeBytes.toString("utf8")) as EncryptedEnvelope;
  } catch {
    throw new Error("Invalid encrypted credential envelope");
  }

  if (envelope.version !== VERSION || envelope.algorithm !== ALGORITHM) {
    throw new Error("Unsupported encrypted credential envelope");
  }

  const dek = decryptWithKey(
    Buffer.from(envelope.wrappedKey, "base64"),
    kek,
    Buffer.from(envelope.wrappedKeyIv, "base64"),
    Buffer.from(envelope.wrappedKeyTag, "base64"),
  );

  return decryptWithKey(
    Buffer.from(envelope.ciphertext, "base64"),
    dek,
    Buffer.from(envelope.ciphertextIv, "base64"),
    Buffer.from(envelope.ciphertextTag, "base64"),
  );
}

export function parseCredentialsMasterKey(value: string): Buffer {
  const trimmed = value.trim();
  const candidates = [
    Buffer.from(trimmed, "base64"),
    Buffer.from(trimmed, "hex"),
  ];

  const key = candidates.find((candidate) => candidate.length === KEY_BYTES);
  if (!key) {
    throw new Error("CREDENTIALS_MASTER_KEY must decode to exactly 32 bytes");
  }
  return key;
}
