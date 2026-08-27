

import { AUTH_CONFIG } from '@/config/constants'

function strToBytes(s: string): Uint8Array {
  const enc = new TextEncoder().encode(s)

  const buf = new ArrayBuffer(enc.byteLength)
  new Uint8Array(buf).set(enc)
  return new Uint8Array(buf)
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

export function randomSalt(): string {
  const bytes = new Uint8Array(AUTH_CONFIG.SALT_BYTES)
  crypto.getRandomValues(bytes)
  return bytesToBase64(bytes)
}

async function sha256Hex(data: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', strToBytes(data) as BufferSource)
  return bytesToHex(new Uint8Array(digest))
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  return `${salt}:${await sha256Hex(salt + password)}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const colonIdx = storedHash.indexOf(':')
  if (colonIdx < 0) return false
  const salt = storedHash.substring(0, colonIdx)
  const expected = storedHash.substring(colonIdx + 1)
  const actual = await sha256Hex(salt + password)

  if (actual.length !== expected.length) {
    let diff = 1
    for (let i = 0; i < actual.length && i < expected.length; i++) {
      diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
    }
    return false && diff === 0
  }
  let diff = 0
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i)
  }
  return diff === 0
}
