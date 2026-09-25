import crypto from "crypto";

/**
 * Ported from includes/credentials.php. Same format: base64(iv[12] + tag[16] + ciphertext),
 * AES-256-GCM, key from CREDENTIAL_KEY env var (base64-encoded 32 bytes).
 * This means credentials encrypted by the old PHP app can be decrypted here, and
 * vice versa, as long as CREDENTIAL_KEY is the same value in both environments.
 */
function getCredentialKey(): Buffer {
  const envKey = process.env.CREDENTIAL_KEY;
  if (!envKey) {
    throw new Error("The CREDENTIAL_KEY environment variable is missing.");
  }
  const key = Buffer.from(envKey, "base64");
  if (key.length !== 32) {
    throw new Error("The CREDENTIAL_KEY environment variable is invalid.");
  }
  return key;
}

export function encryptCredential(plainText: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getCredentialKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptCredential(storedValue: string): string {
  const decoded = Buffer.from(storedValue, "base64");
  const iv = decoded.subarray(0, 12);
  const tag = decoded.subarray(12, 28);
  const encrypted = decoded.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", getCredentialKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
