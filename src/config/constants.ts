

export const STORAGE_KEYS = {
  FUND_CODES: 'jgb_fund_codes',

  FUND_NAMES: 'jgb_fund_names',

  HOLDINGS: 'jgb_holdings',

  HOLDINGS_VERSION: 'jgb_holdings_version',

  FUND_CACHE: 'jgb_fund_cache',

  TASKS: 'jgb_tasks',

  HOLDING_ACTIONS: 'jgb_holding_actions',

  USER_AVATAR: 'jgb_user_avatar',

  VIEW_MODE: 'jgb_view_mode',

  COLUMN_CONFIG: 'jgb_column_config',

  AUTO_REFRESH: 'jgb_auto_refresh',

  REFRESH_INTERVAL: 'jgb_refresh_interval',

  FUND_MANAGERS: 'jgb_fund_managers',

  ACTIVE_TAB: 'jgb_active_tab',

  PENDING_ACTIONS: 'jgb_pending_actions',

  SELECTED_INDICES: 'jgb_selected_indices',

  INDEX_SORT: 'jgb_index_sort',

  WATCHLIST: 'jgb_watchlist',

  STOCK_QUOTES_CACHE: 'jgb_stock_quotes_cache',

  STOCK_QUOTES_DATE: 'jgb_stock_quotes_date',

  NEWS_BLACKLIST: 'jgb_news_blacklist',

  NEWS_READ: 'jgb_news_read',

  NEWS_OPENED: 'jgb_news_opened',

  YAHOO_SYMBOL_CACHE: 'jgb_yahoo_symbol_cache',

  SECTOR_MARKET: 'jgb_sector_market',

  SECTOR_METRIC: 'jgb_sector_metric',

  INTRADAY_MAP: 'jgb_intraday_map',

  INTRADAY_MAP_DATE: 'jgb_intraday_map_date',

  MARKET_HOLIDAYS: 'jgb_market_holidays',

  STOCK_PREV_DAY_CACHE: 'jgb_stock_prev_day_cache',

  STOCK_PREV_DAY_DATE: 'jgb_stock_prev_day_date',

  STOCK_REALTIME_CACHE: 'jgb_stock_realtime_cache',

  STOCK_REALTIME_DATE: 'jgb_stock_realtime_date',

  ESTIMATED_GSZZL_CACHE: 'jgb_estimated_gszzl_cache',

  ESTIMATED_GSZZL_DATE: 'jgb_estimated_gszzl_date',

  ESTIMATED_HOLDINGS_CACHE: 'jgb_estimated_holdings_cache',

  ESTIMATED_HOLDINGS_DATE: 'jgb_estimated_holdings_date',

  INDEX_QUOTES_CACHE: 'jgb_index_quotes_cache',

  INDEX_QUOTES_DATE: 'jgb_index_quotes_date',

  USER_SETTINGS: 'jgb_user_settings',

  RANDOM_NICKNAME: 'jgb_random_nickname',

  AUTH: 'jgb_auth',

  FEEDBACK_LAST_SENT: 'jgb_feedback_last_sent',

  LAST_BUSINESS_DAY: 'jgb_last_business_day',

  T1_HOLDINGS_CACHE: 'jgb_t1_holdings_cache',

  T1_HOLDINGS_DATE: 'jgb_t1_holdings_date',

  SECTOR_CACHE: 'jgb_sector_cache',

  FUND_GROUPS: 'jgb_fund_groups',

  ACTIVE_GROUP: 'jgb_active_group',

  GROUP_MEMBERS: 'jgb_group_members',

  LANDING_SEEN: 'jgb_landing_seen',
} as const

export const TENCENT_URLS = {
  FQKLINE: 'https://ifzq.gtimg.cn/appstock/app/fqkline/get',

  QUOTE: 'https://qt.gtimg.cn/q=',
} as const

export const API_URLS = {
  VALUATION: 'https://fundgz.1234567.com.cn/js/',

  FUND_DETAIL: 'https://fund.eastmoney.com/pingzhongdata/',

  SEARCH: 'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx',

  FUND_INFO: 'https://fund.eastmoney.com/js/',

  FUND_CODE_SEARCH: 'https://fund.eastmoney.com/js/fundcode_search.js',

  F10_HOLDINGS: 'https://fundf10.eastmoney.com/FundArchivesDatas.aspx',

  INTRADAY_ESTIMATE: 'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic',

  STOCK_QUOTES: 'https://push2.eastmoney.com/api/qt/ulist.np/get',

  STOCK_QUOTES_MIRRORS: [
    'https://push2.eastmoney.com',
    'https://push2delay.eastmoney.com',
  ] as readonly string[],

  STOCK_KLINE: 'https://push2his.eastmoney.com/api/qt/stock/kline/get',

  SECTOR_RANK: 'https://push2.eastmoney.com/api/qt/clist/get',

  STOCK_SEARCH: 'https://searchapi.eastmoney.com/api/suggest/get',

  YAHOO_CHART: 'https://query1.finance.yahoo.com/v8/finance/chart',

  YAHOO_SEARCH: 'https://query1.finance.yahoo.com/v1/finance/search',

  GLM_API: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',

  NAGER_HOLIDAYS: 'https://date.nager.at/api/v3/PublicHolidays',
} as const

export const GLM_CONFIG = {
  MODEL: 'glm-4v-flash',

  TIMEOUT: 30000,

  API_KEY: '5f5d5b56a328816a3e3cf764affbb7b8.31N6wWUNZjAtNqi4',
} as const

export const EMAILJS_CONFIG = {
  SERVICE_ID: 'service_bjxunan',

  TEMPLATE_ID: '',

  FEEDBACK_TEMPLATE_ID: 'template_6km32o3',

  PUBLIC_KEY: '1JmdRE6hTcfCUqYha',

  SEND_URL: 'https://api.emailjs.com/api/v1.0/email/send',

  FROM_EMAIL: 'weidong624.he@gmail.com',

  FEEDBACK_TO_EMAIL: 'weidong624.he@gmail.com',

  CODE_EXPIRE_MIN: 5,

  RESEND_LIMIT_SEC: 60,

  FEEDBACK_COOLDOWN_SEC: 600,

  FEEDBACK_MAX_LEN: 2000,
} as const

export const AUTH_CONFIG = {
  PASSWORD_MIN_LEN: 8,

  CODE_LENGTH: 6,

  SALT_BYTES: 16,
} as const

export const YAHOO_PROXY_CANDIDATES: ReadonlyArray<{
  name: string
  build: (targetUrl: string) => string

  wrap: boolean
}> = [
  { name: 'allorigins-get', build: (u) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`, wrap: true },
]

export const PROXY_BREAK_THRESHOLD = 3

export const PROXY_BREAK_COOLDOWN_MS = 20 * 1000

export const PROXY_GLOBAL_COOLDOWN_MS = 20 * 1000

export const YAHOO_CONFIG = {
  SYMBOL_CACHE_TTL: 180 * 24 * 60 * 60 * 1000,

  CHART_CLOSE_RANGE: '1mo',

  SLOT_CAP_PER_SOURCE: 2,

  FETCH_TIMEOUT: 3000,

  RETRIES: 1,

  SYMBOL_CONCURRENCY: 3,

  SEARCH_MATCH_COUNT: 5,
} as const

export const F10_CONFIG = {
  TOPLINE_FULL: 200,

  TOPLINE_TOP10: 10,

  TIMEOUT: 6000,
} as const

export const LSJZ_CONFIG = {
  PER_PAGE: 500,

  TIMEOUT: 8000,
} as const

export const ESTIMATE_CONFIG = {
  QUARTER_YEAR_OFFSET_MAX: 2,

  ANNUAL_YEAR_OFFSET_MAX: 3,

  STOCKS_WITH_DATA_MIN: 5,

  WEIGHT_WITH_DATA_MIN: 20,

  MAX_ESTIMATED_CACHE: 50,
} as const

export const FUND_VALUATION_CONFIG = {
  FUNDGZ_TIMEOUT: 4000,

  FUNDGZ_RETRIES: 2,

  FUNDGZ_RETRY_BACKOFF: 300,

  FUND_TYPE_CACHE_MAX: 200,

  BATCH_CONCURRENCY: 3,

  MANAGER_CHECK_CONCURRENCY: 3,
} as const

export const INTRADAY_CONFIG = {
  INTERVAL_MINUTES: 15,

  FETCH_TIMEOUT: 4000,

  FETCH_BATCH: 5,
} as const

export const HOLIDAY_CONFIG = {
  FETCH_TIMEOUT: 6000,

  FETCH_CONCURRENCY: 3,

  MARKETS: ['A', 'HK', 'US', 'JP', 'KR', 'TW', 'DE', 'FR', 'UK'] as const,
} as const

export const FUND_CATALOG_CONFIG = {
  SEARCH_MIN_KEYWORD: 2,

  SEARCH_PAGE_SIZE: 50,

  SEARCH_TIMEOUT: 6000,

  CATALOG_TIMEOUT: 4000,
} as const

export const FUND_LOOP_CONFIG = {
  KLINE_SERVICE_BATCH: 20,

  KLINE_WORKER_CONCURRENCY: 6,

  KLINE_BATCH: 4,

  KLINE_BATCH_GAP: 400,

  REALTIME_BATCH: 80,

  REALTIME_FALLBACK_CONCURRENCY: 4,

  LOOP_PHASE_JITTER: 5000,

  HEARTBEAT_INTERVAL: 60 * 1000,

  EM_FALLBACK_TIMEOUT: 5000,

  WORKER_TIMEOUT: 30 * 1000,

  KLINE_DIRTY_BAR_MAX_DAYS: 60,
} as const

export const DEFAULT_SETTINGS = {
  AUTO_REFRESH: true,

  REFRESH_INTERVAL: 5,

  CACHE_DURATION: 4 * 60 * 60 * 1000,

  VALUATION_DURATION: 24 * 60 * 60 * 1000,

  REQUEST_TIMEOUT: 4000,

  VIEW_MODE: 'table',

  VISIBLE_COLUMNS: [
    'fundCode', 'fundName', 'changeRate', 'todayProfit',
    'holdingAmount', 'totalProfit',
    'lastNetValue', 'costPrice', 'holdingDate', 'valuationTime', 'actions',
  ] as readonly string[],
} as const

export const TRADING_HOURS = {
  MORNING_OPEN: '09:30',
  MORNING_CLOSE: '11:30',
  AFTERNOON_OPEN: '13:00',
  AFTERNOON_CLOSE: '16:00',
} as const

export const NUMBER_FORMAT = {
  MONEY_DECIMALS: 2,

  RATE_DECIMALS: 2,

  NET_VALUE_DECIMALS: 4,

  SHARES_DECIMALS: 2,
} as const

export const INDEX_PRESETS = [

  { secid: '1.000001', code: '000001', name: '上证指数', market: 'sh' },
  { secid: '0.399001', code: '399001', name: '深证成指', market: 'sz' },
  { secid: '0.399006', code: '399006', name: '创业板指', market: 'sz' },
  { secid: '1.000688', code: '000688', name: '科创50', market: 'sh' },
  { secid: '1.000300', code: '000300', name: '沪深300', market: 'sh' },
  { secid: '1.000905', code: '000905', name: '中证500', market: 'sh' },
  { secid: '1.000016', code: '000016', name: '上证50', market: 'sh' },
  { secid: '0.399673', code: '399673', name: '创业板50', market: 'sz' },

  { secid: '100.HSI', code: 'HSI', name: '恒生指数', market: 'hk' },
  { secid: '100.HSCEI', code: 'HSCEI', name: '国企指数', market: 'hk' },
  { secid: '124.HSTECH', code: 'HSTECH', name: '恒生科技', market: 'hk' },

  { secid: '100.DJIA', code: 'DJIA', name: '道琼斯', market: 'us' },
  { secid: '100.NDX', code: 'NDX', name: '纳斯达克', market: 'us' },
  { secid: '100.SPX', code: 'SPX', name: '标普500', market: 'us' },

  { secid: '100.N225', code: 'N225', name: '日经225', market: 'jp' },
  { secid: '100.KS11', code: 'KS11', name: '韩国KOSPI', market: 'kr' },
  { secid: '100.TWII', code: 'TWII', name: '台湾加权', market: 'tw' },

  { secid: '100.FTSE', code: 'FTSE', name: '英国富时100', market: 'uk' },
  { secid: '100.GDAXI', code: 'GDAXI', name: '德国DAX30', market: 'de' },
  { secid: '100.FCHI', code: 'FCHI', name: '法国CAC40', market: 'fr' },
] as const

export const DEFAULT_SELECTED_INDICES = ['1.000001', '0.399001', '0.399006', '100.HSI', '100.DJIA', '100.NDX']

export const FUND_TYPE_TAGS = {
  '股票型': { color: '#ef4444', label: '股' },
  '混合型-偏股': { color: '#f97316', label: '偏股' },
  '混合型-平衡': { color: '#eab308', label: '平衡' },
  '混合型-偏债': { color: '#22c55e', label: '偏债' },
  '债券型': { color: '#3b82f6', label: '债' },
  '指数型': { color: '#8b5cf6', label: '指' },
  'QDII': { color: '#06b6d4', label: 'QDII' },
  'FOF': { color: '#ec4899', label: 'FOF' },
  '货币型': { color: '#14b8a6', label: '货' },
} as const

export const WORKER_NAMES = {
  FUND_EM_CLOSE: 'fund-em-close',
  FUND_EM_REALTIME: 'fund-em-realtime',
  FUND_YAHOO: 'fund-yahoo',
} as const
