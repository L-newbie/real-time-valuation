

export interface ProxyCandidate {
  name: string

  build: (targetUrl: string) => string

  wrap: boolean
}

export const PROXY_CANDIDATES: ProxyCandidate[] = [
  { name: 'corsproxy', build: (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`, wrap: false },
  { name: 'allorigins-raw', build: (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`, wrap: false },
  { name: 'allorigins-get', build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrap: true },
]
