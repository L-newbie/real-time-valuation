
import { useFundStore } from '@/modules/fund/fund-store'
import {
  checkManagerChanges as checkManagerChangesImpl,
  removeKnownManager,
} from '@/modules/fund/misc/manager-check'
import type { ManagerChange } from '@/modules/fund/fund-types'

export { removeKnownManager }

export async function checkManagerChanges(): Promise<ManagerChange[]> {
  const fundStore = useFundStore()
  const codes = fundStore.fundCodes
  if (codes.length === 0) return []
  return checkManagerChangesImpl(codes)
}
