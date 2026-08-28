

import type { NewsItem, NewsItemWithTime } from '../news-types'

export function mergeAndDedup(...newsArrays: NewsItemWithTime[][]): NewsItem[] {
  const allNews = newsArrays.flat()
  allNews.sort((a, b) => b.ctime - a.ctime)
  const seen = new Set<string>()
  return allNews.filter(item => {
    if (seen.has(item.title)) return false
    seen.add(item.title)
    return true
  })
}
