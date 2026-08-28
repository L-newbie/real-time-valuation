

import { useFundStore } from '@/modules/fund/fund-store'
import { useHoldingStore } from '@/modules/holding/holding-store'
import { useGroupStore } from '@/modules/group/group-store'
import { removeKnownManager } from '@/composables/use-manager-check'

// 从当前分组移除；该基金若已不属于任何分组，才连全局行情缓存一并清掉。
// 别的分组还留着它时，估值仍要照常刷新，所以不能无条件 removeFund。
export function removeFundFromActiveGroup(fundCode: string): void {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const groupStore = useGroupStore()

  holdingStore.removeHoldingsByFund(fundCode)
  groupStore.removeFromGroup(groupStore.activeGroupId, fundCode)

  if (groupStore.isOrphan(fundCode)) {
    fundStore.removeFund(fundCode)
    removeKnownManager(fundCode)
  }
}

// 清空分组：移出组内全部基金并清掉该组持仓，分组本身保留。
// 只属于本组的基金会成为孤儿，连同全局行情缓存一并清除。
export function clearGroup(groupId: string): void {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const groupStore = useGroupStore()

  const codes = [...groupStore.getMembers(groupId)]
  holdingStore.removeHoldingsByGroup(groupId)
  for (const code of codes) groupStore.removeFromGroup(groupId, code)

  for (const code of codes) {
    if (!groupStore.isOrphan(code)) continue
    fundStore.removeFund(code)
    removeKnownManager(code)
  }
}

export function purgeGroup(groupId: string): void {
  const fundStore = useFundStore()
  const holdingStore = useHoldingStore()
  const groupStore = useGroupStore()

  holdingStore.removeHoldingsByGroup(groupId)
  const orphans = groupStore.deleteGroup(groupId)
  for (const code of orphans) {
    fundStore.removeFund(code)
    removeKnownManager(code)
  }
}
