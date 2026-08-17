import type { NewsItem } from '../news-types'
import { fetchSinaNews, fetchSinaNewsDeep } from '../sources/sina-news'
import { mergeAndDedup } from '../filter/news-merge'

export async function fetchTodayNews(): Promise<NewsItem[]> {
  const sina = await fetchSinaNews()
  return mergeAndDedup(sina)
}

export async function fetchMoreNews(beforeCtime: number): Promise<NewsItem[]> {
  const sina = await fetchSinaNewsDeep(beforeCtime)
  return mergeAndDedup(sina)
}
