

import { loadString, saveString } from '@/shared/cache/local-storage-io'

const GAME_HINT_KEY = 'jgb_game_entry_hint_shown'

export function shouldShowGameHint(): boolean {
  return loadString(GAME_HINT_KEY) !== '1'
}

export function markGameHintShown(): void {
  saveString(GAME_HINT_KEY, '1')
}
