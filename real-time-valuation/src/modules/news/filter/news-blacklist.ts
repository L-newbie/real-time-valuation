

export function isBlacklisted(source: string, blacklist: string[]): boolean {
  if (!source || blacklist.length === 0) return false
  const s = source.toLowerCase()
  return blacklist.some(b => b && s.includes(b.toLowerCase()))
}

export function filterByBlacklist<T extends { source: string }>(items: T[], blacklist: string[]): T[] {
  if (blacklist.length === 0) return items
  return items.filter(item => !isBlacklisted(item.source, blacklist))
}
