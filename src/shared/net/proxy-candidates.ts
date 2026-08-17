

export interface ProxyCandidate {
  name: string

  build: (targetUrl: string) => string

  wrap: boolean
}

export const PROXY_CANDIDATES: ProxyCandidate[] = [
  { name: 'allorigins-get', build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrap: true },
]
