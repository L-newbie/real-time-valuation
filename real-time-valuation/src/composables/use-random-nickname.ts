

import { ref } from 'vue'
import { STORAGE_KEYS } from '@/config/constants'
import { loadJSON, saveJSON } from '@/shared/cache/local-storage-io'

export interface RandomUser {
  nickname: string

  color: string

  initial: string
}

interface StoredUser extends RandomUser {
  seed: number
}

const ADJECTIVES = [
  '疾风的', '静默的', '炽热的', '霜降的', '破晓的', '星陨的', '深海的', '晨曦的',
  '暮光的', '雷霆的', '幽兰的', '烈焰的', '寒霜的', '苍穹的', '流光的', '长夜的',
  '远山的', '清波的', '惊鸿的', '逐月的',
]
const NOUNS = [
  '赤狐', '青鸟', '玄鹤', '墨龙', '白虎', '朱雀', '玉兔', '金鲤', '银鹰', '苍狼',
  '碧蛇', '紫燕', '丹凤', '素麟', '翠羽', '墨鲤', '霜鹰', '云鹤', '雪豹', '星鹿',
]

function hashStr(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  }
  return h
}

function collectFingerprint(): string {
  const parts: string[] = []
  try { parts.push(navigator.userAgent) } catch {  }
  try { parts.push(navigator.language) } catch {  }
  try {
    parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`)
  } catch {  }
  try {
    parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '')
  } catch {  }
  try { parts.push(String(navigator.hardwareConcurrency || '')) } catch {  }
  try { parts.push(navigator.platform || '') } catch {  }
  return parts.join('|')
}

function generate(): StoredUser {
  const seed = hashStr(collectFingerprint())
  const adj = ADJECTIVES[seed % ADJECTIVES.length]
  const noun = NOUNS[(seed >> 8) % NOUNS.length]
  const nickname = `${adj}${noun}`
  return {
    nickname,
    color: `hsl(${seed % 360}, 65%, 55%)`,
    initial: nickname.charAt(0),
    seed,
  }
}

let cached: RandomUser | null = null

export function useRandomNickname() {
  if (cached) return { user: ref<RandomUser>(cached) }

  const stored = loadJSON<StoredUser | null>(STORAGE_KEYS.RANDOM_NICKNAME, null)
  if (stored && stored.nickname && stored.color) {
    cached = { nickname: stored.nickname, color: stored.color, initial: stored.initial || stored.nickname.charAt(0) }
  } else {
    const generated = generate()
    saveJSON(STORAGE_KEYS.RANDOM_NICKNAME, generated)
    cached = { nickname: generated.nickname, color: generated.color, initial: generated.initial }
  }

  return { user: ref<RandomUser>(cached) }
}
