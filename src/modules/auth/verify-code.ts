

import { AUTH_CONFIG, EMAILJS_CONFIG } from '@/config/constants'

interface CodeRecord {
  code: string

  expireAt: number

  sentAt: number
}

const codeMap = new Map<string, CodeRecord>()

export function generateCode(): string {
  const len = AUTH_CONFIG.CODE_LENGTH
  const digits = new Uint32Array(len)
  crypto.getRandomValues(digits)
  let code = ''
  for (let i = 0; i < len; i++) {
    code += (digits[i] % 10).toString()
  }
  return code
}

function normalize(email: string): string {
  return email.trim().toLowerCase()
}

export function canResend(email: string): { ok: boolean; waitSec: number } {
  const rec = codeMap.get(normalize(email))
  if (!rec) return { ok: true, waitSec: 0 }
  const elapsedSec = Math.floor((Date.now() - rec.sentAt) / 1000)
  const limit = EMAILJS_CONFIG.RESEND_LIMIT_SEC
  if (elapsedSec < limit) {
    return { ok: false, waitSec: limit - elapsedSec }
  }
  return { ok: true, waitSec: 0 }
}

export type IssueResult =
  | { ok: true; code: string; expireAt: number }
  | { ok: false; error: 'RATE_LIMITED'; waitSec: number }

export function issueCode(email: string): IssueResult {
  const key = normalize(email)
  const check = canResend(key)
  if (!check.ok) {
    return { ok: false, error: 'RATE_LIMITED', waitSec: check.waitSec }
  }
  const now = Date.now()
  const code = generateCode()
  const expireAt = now + EMAILJS_CONFIG.CODE_EXPIRE_MIN * 60 * 1000
  codeMap.set(key, { code, expireAt, sentAt: now })
  return { ok: true, code, expireAt }
}

export type ConsumeResult = 'OK' | 'INVALID' | 'EXPIRED' | 'NOT_FOUND'

export function consumeCode(email: string, input: string): ConsumeResult {
  const key = normalize(email)
  const rec = codeMap.get(key)
  if (!rec) return 'NOT_FOUND'

  codeMap.delete(key)
  if (Date.now() > rec.expireAt) return 'EXPIRED'
  if (input.trim() !== rec.code) return 'INVALID'
  return 'OK'
}
