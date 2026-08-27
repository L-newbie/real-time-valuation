

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { FundGroup } from './group-types'
import { BUILTIN_GROUP_WATCH } from './group-types'
import { STORAGE_KEYS } from '@/config/constants'
import { loadJSON, saveJSON, loadString, saveString } from '@/shared/cache/local-storage-io'
import { isValidFundCode } from '@/shared/utils/validation'
import { generateId } from '@/shared/utils/validation'

const LEGACY_GROUP_CUSTOM = 'custom'

function defaultGroups(): FundGroup[] {
  return [
    { id: BUILTIN_GROUP_WATCH, name: '自选', createdAt: Date.now(), order: 0, builtin: true },
  ]
}

export const useGroupStore = defineStore('group', () => {
  const groups = ref<FundGroup[]>(defaultGroups())

  const members = ref<Map<string, string[]>>(new Map())

  const activeGroupId = ref<string>(BUILTIN_GROUP_WATCH)

  let restored = false

  const sortedGroups = computed(() => [...groups.value].sort((a, b) => a.order - b.order))

  const activeGroup = computed(() =>
    groups.value.find(g => g.id === activeGroupId.value) ?? sortedGroups.value[0],
  )

  const activeCodes = computed(() => members.value.get(activeGroupId.value) ?? [])

  function getMembers(groupId: string): string[] {
    return members.value.get(groupId) ?? []
  }

  function groupsOf(code: string): string[] {
    const out: string[] = []
    for (const [gid, codes] of members.value) {
      if (codes.includes(code)) out.push(gid)
    }
    return out
  }

  function isOrphan(code: string): boolean {
    for (const codes of members.value.values()) {
      if (codes.includes(code)) return false
    }
    return true
  }

  function allCodes(): string[] {
    const set = new Set<string>()
    for (const codes of members.value.values()) {
      for (const c of codes) set.add(c)
    }
    return [...set]
  }

  function createGroup(name: string): FundGroup | null {
    const trimmed = name.trim()
    if (!trimmed) return null
    const maxOrder = groups.value.reduce((m, g) => Math.max(m, g.order), -1)
    const group: FundGroup = {
      id: generateId(),
      name: trimmed,
      createdAt: Date.now(),
      order: maxOrder + 1,
    }
    groups.value = [...groups.value, group]
    members.value.set(group.id, [])
    members.value = new Map(members.value)
    persistGroups()
    persistMembers()
    return group
  }

  function renameGroup(id: string, name: string): boolean {
    const trimmed = name.trim()
    if (!trimmed) return false
    const group = groups.value.find(g => g.id === id)
    if (!group) return false
    group.name = trimmed
    groups.value = [...groups.value]
    persistGroups()
    return true
  }

  function deleteGroup(id: string): string[] {
    const group = groups.value.find(g => g.id === id)
    if (!group || group.builtin) return []
    if (groups.value.length <= 1) return []

    const removed = getMembers(id)
    members.value.delete(id)
    members.value = new Map(members.value)
    groups.value = groups.value.filter(g => g.id !== id)

    if (activeGroupId.value === id) {
      activeGroupId.value = sortedGroups.value[0]?.id ?? BUILTIN_GROUP_WATCH
      persistActiveGroup()
    }
    persistGroups()
    persistMembers()

    return removed.filter(code => isOrphan(code))
  }

  function addToGroup(groupId: string, codes: string[]): number {
    if (!groups.value.some(g => g.id === groupId)) return 0
    const existing = getMembers(groupId)
    const set = new Set(existing)
    const added: string[] = []
    for (const code of codes) {
      if (!isValidFundCode(code) || set.has(code)) continue
      set.add(code)
      added.push(code)
    }
    if (added.length === 0) return 0
    members.value.set(groupId, [...existing, ...added])
    members.value = new Map(members.value)
    persistMembers()
    return added.length
  }

  function removeFromGroup(groupId: string, code: string): void {
    const existing = members.value.get(groupId)
    if (!existing || !existing.includes(code)) return
    members.value.set(groupId, existing.filter(c => c !== code))
    members.value = new Map(members.value)
    persistMembers()
  }

  function setActiveGroup(id: string): void {
    if (!groups.value.some(g => g.id === id)) return
    activeGroupId.value = id
    persistActiveGroup()
  }

  function persistGroups(): void {
    if (!restored) return
    saveJSON(STORAGE_KEYS.FUND_GROUPS, groups.value)
  }

  function persistMembers(): void {
    if (!restored) return
    const obj: Record<string, string[]> = {}
    for (const [gid, codes] of members.value) obj[gid] = codes
    saveJSON(STORAGE_KEYS.GROUP_MEMBERS, obj)
  }

  function persistActiveGroup(): void {
    if (!restored) return
    saveString(STORAGE_KEYS.ACTIVE_GROUP, activeGroupId.value)
  }

  // 首次升级：分组定义还不存在时，把已有的自选全集整体迁入「自选」组，
  // 用户看到的列表与持仓维持原样。seedCodes 由 bootstrap 传入 fundStore.fundCodes。
  function restoreGroups(seedCodes: string[] = []): void {
    const storedGroups = loadJSON<FundGroup[] | null>(STORAGE_KEYS.FUND_GROUPS, null)
    const isFirstRun = !Array.isArray(storedGroups) || storedGroups.length === 0
    let legacyPurged = false

    groups.value = isFirstRun
      ? defaultGroups()
      : storedGroups.filter(g => !!g?.id && !!g?.name)

    if (groups.value.length === 0) groups.value = defaultGroups()

    const storedMembers = loadJSON<Record<string, string[]> | null>(STORAGE_KEYS.GROUP_MEMBERS, null)
    const map = new Map<string, string[]>()
    for (const g of groups.value) {
      const codes = storedMembers?.[g.id]
      map.set(g.id, Array.isArray(codes) ? codes.filter(c => isValidFundCode(c)) : [])
    }
    members.value = map

    // 早期版本预置过一个「自定义」组，语义上它本来就只是「新建」的占位。
    // 已落盘的空壳在这里一次性摘掉；用户往里放过基金的则保留，不能凭空吞掉数据。
    const legacyCustom = groups.value.find(g => g.id === LEGACY_GROUP_CUSTOM)
    if (legacyCustom && (members.value.get(LEGACY_GROUP_CUSTOM)?.length ?? 0) === 0 && groups.value.length > 1) {
      groups.value = groups.value.filter(g => g.id !== LEGACY_GROUP_CUSTOM)
      members.value.delete(LEGACY_GROUP_CUSTOM)
      members.value = new Map(members.value)
      legacyPurged = true
    } else if (legacyCustom) {
      legacyCustom.builtin = false
      legacyPurged = true
    }

    if (isFirstRun && seedCodes.length > 0) {
      members.value.set(BUILTIN_GROUP_WATCH, seedCodes.filter(c => isValidFundCode(c)))
      members.value = new Map(members.value)
    }

    const storedActive = loadString(STORAGE_KEYS.ACTIVE_GROUP)
    activeGroupId.value = storedActive && groups.value.some(g => g.id === storedActive)
      ? storedActive
      : sortedGroups.value[0].id

    restored = true

    if (isFirstRun || legacyPurged) {
      persistGroups()
      persistMembers()
      persistActiveGroup()
    }
  }

  return {
    groups, members, activeGroupId,
    sortedGroups, activeGroup, activeCodes,
    getMembers, groupsOf, isOrphan, allCodes,
    createGroup, renameGroup, deleteGroup,
    addToGroup, removeFromGroup, setActiveGroup,
    restoreGroups,
  }
})
