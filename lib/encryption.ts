import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "crypto"

/**
 * AES-256-GCM encryption for storing sensitive values (API keys, tokens, etc.)
 * Key is read from ENCRYPTION_KEY env var (64 hex chars = 32 bytes).
 * Falls back to a random key in dev — NOT suitable for persistent storage.
 */
const ENCRYPTION_KEY: Buffer = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, "hex")
  : randomBytes(32)

if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY env var is required in production")
}

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12 // GCM recommended IV size
const AUTH_TAG_LENGTH = 16

/**
 * Encrypts a plaintext string. Returns a colon-separated string: `iv:authTag:ciphertext`
 * @example const token = encrypt("sk-live-...")
 */
export function encrypt(text: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv)

  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")

  const authTag = cipher.getAuthTag()
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`
}

/**
 * Decrypts a string encrypted by `encrypt()`.
 * @throws if the format is invalid or the auth tag doesn't match (tampered data)
 */
export function decrypt(encryptedText: string): string {
  const parts = encryptedText.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format — expected iv:authTag:ciphertext")
  }

  const iv = Buffer.from(parts[0], "hex")
  const authTag = Buffer.from(parts[1], "hex")
  const encrypted = parts[2]

  const decipher = createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encrypted, "hex", "utf8")
  decrypted += decipher.final("utf8")

  return decrypted
}

/**
 * Returns true if `encryptedText` is a valid encrypted value that decrypts to `plaintext`.
 * Uses a try/catch to handle auth tag failures gracefully.
 */
export function verifyEncrypted(plaintext: string, encryptedText: string): boolean {
  try {
    return decrypt(encryptedText) === plaintext
  } catch {
    return false
  }
}

/**
 * Derives a deterministic key from a passphrase and salt (e.g., for per-user field encryption).
 * Output is a 32-byte Buffer suitable for use as an AES-256 key.
 */
export function deriveKey(passphrase: string, salt: string): Buffer {
  return scryptSync(passphrase, salt, 32)
}

/**
 * Constant-time comparison to prevent timing attacks when comparing tokens/hashes.
 */
export function safeCompare(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, "utf8")
    const bBuf = Buffer.from(b, "utf8")
    if (aBuf.length !== bBuf.length) return false
    return timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

/**
 * Generates a cryptographically secure random hex token of `byteLength` bytes.
 * Default produces a 32-character hex string (16 bytes).
 */
export function generateSecureToken(byteLength = 16): string {
  return randomBytes(byteLength).toString("hex")
}
