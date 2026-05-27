import crypto from "crypto"

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex")
}

export function tokenExpiry(minutes: number): Date {
  return new Date(Date.now() + minutes * 60_000)
}

export function isExpired(expiresAt: Date): boolean {
  return expiresAt.getTime() < Date.now()
}
