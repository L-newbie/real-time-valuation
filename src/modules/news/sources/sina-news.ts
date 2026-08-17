

import type { NewsItemWithTime } from '../news-types'
import { jsonpRequest, genCallbackName } from '@/shared/net/jsonp-main'
import { formatTimestamp, formatTime } from '../format/news-time'
import { getBeijingTodayStr } from '@/shared/utils/date-format'

interface SinaNewsRaw {
  title: string
  url: string
  ctime: number
  media_name: string
}

const LIDS = [2509, 2510, 2511, 2512, 2513]

export async function fetchSinaNews(): Promise<NewsItemWithTime[]> {
  const today = getBeijingTodayStr()
  const allNews: NewsItemWithTime[] = []
  for (const lid of LIDS) {
    try {
      const cb = genCallbackName(`sinaNews_${lid}`)
      const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=50&page=1&callback=${cb}`
      const resp = await jsonpRequest<{ result?: { data?: SinaNewsRaw[] } }>(url, cb, 6000)
      if (!resp?.result?.data) continue
      for (const item of resp.result.data) {
        if (formatTimestamp(item.ctime) !== today) continue
        allNews.push({
          title: item.title, url: item.url,
          time: formatTime(item.ctime),
          source: item.media_name || '新浪财经',
          ctime: item.ctime,
        })
      }
    } catch {  }
  }
  return allNews
}

export async function fetchSinaNewsDeep(beforeCtime: number): Promise<NewsItemWithTime[]> {
  const today = getBeijingTodayStr()
  const allNews: NewsItemWithTime[] = []
  for (const lid of LIDS) {
    for (let page = 5; page <= 10; page++) {
      try {
        const cb = genCallbackName(`sinaDeep_${lid}_${page}`)
        const url = `https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=${lid}&k=&num=50&page=${page}&callback=${cb}`
        const resp = await jsonpRequest<{ result?: { data?: SinaNewsRaw[] } }>(url, cb, 6000)
        if (!resp?.result?.data) break
        let hasRelevant = false
        for (const item of resp.result.data) {
          if (formatTimestamp(item.ctime) !== today) continue
          if (item.ctime < beforeCtime) {
            hasRelevant = true
            allNews.push({
              title: item.title, url: item.url,
              time: formatTime(item.ctime),
              source: item.media_name || '新浪财经',
              ctime: item.ctime,
            })
          }
        }
        if (!hasRelevant) break
      } catch {  }
    }
  }
  return allNews
}
