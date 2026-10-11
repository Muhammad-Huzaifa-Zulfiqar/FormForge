import { createHash } from 'crypto'

export const HONEYPOT_FIELD = '_gotcha'

// Real users never see this hidden field, so any value means a bot filled it in.
export function isHoneypotTripped(body: Record<string, unknown>): boolean {
  const v = body[HONEYPOT_FIELD]
  return v !== undefined && v !== null && String(v).trim() !== ''
}

// Store a salted hash instead of the raw IP (privacy + still usable for rate limiting).
export function hashIp(ip: string, salt = process.env.IP_HASH_SALT ?? 'dev-salt'): string {
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex')
}

export async function verifyRecaptcha(token: unknown): Promise<boolean> {
  if (typeof token !== 'string' || !token) return false
  const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY ?? '',
      response: token,
    }),
  })
  const json = await res.json()
  return json.success === true
}
