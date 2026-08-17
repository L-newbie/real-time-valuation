

export interface NewsItem {
  title: string

  url: string

  time: string

  source: string

  ctime: number

  content?: string
}

export interface NewsItemWithTime extends NewsItem {
  ctime: number
}
