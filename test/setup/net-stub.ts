/**
 * 网络桩 - 拦截 fetch 与 <script> 注入（JSONP），返回预置样本
 *
 * 测试绝不真正联网：真实请求会因网络波动/接口变更导致结果飘，
 * 且会消耗密钥额度。所有出站请求在此拦截。
 *
 * 三种模式（用例可切换，用于验证功能是"降级可用"还是"整个崩"）：
 *   ok     正常响应
 *   fail   接口失败（网络错误/超时）
 *   dirty  返回脏数据（字段缺失/格式错）
 *
 * JSONP 拦截原理：业务代码走 document.createElement('script') + appendChild，
 * 此处劫持 appendChild，识别 script.src 后直接调用 window 上的回调函数，
 * 模拟脚本加载完成。
 */

export type NetMode = 'ok' | 'fail' | 'dirty'

let mode: NetMode = 'ok'
/** 记录本轮所有请求 URL，供用例断言"确实发起了请求" */
export const requestLog: string[] = []

export function setNetMode(m: NetMode): void {
  mode = m
}
export function getNetMode(): NetMode {
  return mode
}
export function resetNet(): void {
  mode = 'ok'
  requestLog.length = 0
}

/* ─────────────── 样本数据 ─────────────── */

/** 基金估值（fundgz jsonpgz 回调） */
const SAMPLE_FUNDGZ = {
  fundcode: '000001',
  name: '华夏成长混合',
  jzrq: '2026-08-06',
  dwjz: '1.2340',
  gsz: '1.2450',
  gszzl: '0.89',
  gztime: '2026-08-07 14:30',
}

/** 股票行情（东财 push2 ulist） */
const SAMPLE_EM_QUOTES = {
  rc: 0,
  data: {
    total: 2,
    diff: [
      { f12: '600519', f14: '贵州茅台', f2: 1680.5, f3: 1.25, f13: 1 },
      { f12: '000858', f14: '五粮液', f2: 152.3, f3: -0.68, f13: 0 },
    ],
  },
}

/** 腾讯行情（qt.gtimg 文本格式） */
const SAMPLE_TENCENT = `v_sh600519="1~贵州茅台~600519~1680.50~1659.80~1665.00~123456~0~0~1680.50~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~0~20.70~1.25~1690.00~1650.00~1680.50/123456/20000000000~123456~2000000~0.98~28.50~~1690.00~1650.00~2.41~21000.00~21100.00~1.20~1825.78~1493.82~1.50~0~0~0~0~0~0~0~0~0";`

/** Yahoo chart */
const SAMPLE_YAHOO = {
  chart: {
    result: [
      {
        meta: {
          symbol: 'AAPL',
          regularMarketPrice: 225.5,
          chartPreviousClose: 223.1,
          previousClose: 223.1,
          marketState: 'REGULAR',
          exchangeTimezoneName: 'America/New_York',
          gmtoffset: -14400,
        },
        timestamp: [1754570000, 1754570120],
        indicators: { quote: [{ close: [224.8, 225.5], open: [224.0, 224.8], high: [225.6, 225.9], low: [223.9, 224.5], volume: [1000, 1200] }] },
      },
    ],
    error: null,
  },
}

/** 东财 K线 */
const SAMPLE_EM_KLINE = {
  rc: 0,
  data: {
    code: '600519',
    name: '贵州茅台',
    klines: ['2026-08-06,1650.00,1659.80,1665.00,1645.00,120000,200000000,1.20,0.85,14.00,0.50'],
  },
}

/** 基金历史净值 lsjz（HTML 表格） */
const SAMPLE_LSJZ = `var apidata={ content:"<table class='w782 comm lsjz'><tbody><tr><td>2026-08-06</td><td class='tor bold'>1.2340</td><td class='tor bold'>3.4560</td><td class='tor bold red'>0.85%</td><td class='tor'></td><td class='tor'></td><td class='tor'></td></tr><tr><td>2026-08-05</td><td class='tor bold'>1.2236</td><td class='tor bold'>3.4300</td><td class='tor bold grn'>-0.42%</td><td class='tor'></td><td class='tor'></td><td class='tor'></td></tr></tbody></table>",records:2,pages:1,curpage:1};`

/** 基金持仓 F10（apidata 回调） */
const SAMPLE_F10 = `var apidata={ content:"<div class='box'><h4 class='t'><label class='left'><a>2026年二季度股票投资明细</a></label></h4><table class='w782 comm tzxq'><tbody><tr><td>1</td><td><a>600519</a></td><td class='tol'><a>贵州茅台</a></td><td class='tor'>8.50%</td><td class='tor'>100,000</td><td class='tor'>168,050</td></tr><tr><td>2</td><td><a>000858</a></td><td class='tol'><a>五粮液</a></td><td class='tor'>6.20%</td><td class='tor'>200,000</td><td class='tor'>30,460</td></tr></tbody></table></div>",arryear:[2026],curyear:2026};`

/** 基金全量数据 pingzhongdata（一堆 var 定义） */
const SAMPLE_PINGZHONG = `
var fS_name = "华夏成长混合";
var fS_code = "000001";
var fund_sourceRate = "1.50";
var fund_Rate = "0.15";
var stockCodes = ["600519","000858"];
var Data_netWorthTrend = [{"x":1754179200000,"y":1.2236,"equityReturn":-0.42},{"x":1754265600000,"y":1.2340,"equityReturn":0.85}];
var Data_ACWorthTrend = [[1754179200000,3.4300],[1754265600000,3.4560]];
var Data_fundSharesPositions = [[1754265600000,88.50]];
var Data_currentFundManager = [{"name":"张三","workTime":"5年","fundSize":"120.00亿"}];
var Data_performanceEvaluation = {"avr":"75.00","categories":["选证能力","收益率","抗风险","稳定性","择时能力"],"dsc":["",""],"data":[70,80,75,72,78]};
var Data_rateInSimilarType = [{"x":1754265600000,"y":25,"sc":"120"}];
`

/** 基金代码目录 */
const SAMPLE_FUND_CATALOG = `var r = [["000001","HXCZHH","华夏成长混合","混合型-灵活","HUAXIACHENGZHANGHUNHE"],["000002","HXCZHH2","华夏成长混合2","混合型-灵活","HUAXIACHENGZHANGHUNHE2"],["110022","YFDXFHY","易方达消费行业","股票型","YIFANGDAXIAOFEIHANGYE"]];`

/** 基金搜索 */
const SAMPLE_FUND_SEARCH = {
  ErrCode: 0,
  Datas: [
    { CODE: '000001', NAME: '华夏成长混合', CATEGORYDESC: '混合型', FundBaseInfo: { SHORTNAME: '华夏成长混合', FTYPE: '混合型' } },
  ],
}

/** 股票搜索（东财 searchapi） */
const SAMPLE_STOCK_SEARCH = {
  QuotationCodeTable: {
    Data: [
      { Code: '600519', Name: '贵州茅台', MktNum: '1', SecurityType: '2', Classify: 'AStock', QuoteID: '1.600519', UnifiedCode: '600519' },
    ],
    Status: 0,
  },
}

/** 指数行情 */
const SAMPLE_INDEX = {
  rc: 0,
  data: {
    diff: [
      { f12: '000001', f14: '上证指数', f2: 3250.5, f3: 0.62, f13: 1 },
      { f12: '399001', f14: '深证成指', f2: 10520.3, f3: -0.31, f13: 0 },
    ],
  },
}

/** 新浪资讯 */
const SAMPLE_SINA_NEWS = {
  result: {
    status: { code: 0 },
    data: [
      { title: '央行公开市场操作', url: 'https://finance.sina.com.cn/a1', ctime: '1754570000', media_name: '新浪财经', intro: '摘要一' },
      { title: '两市成交额破万亿', url: 'https://finance.sina.com.cn/a2', ctime: '1754569000', media_name: '新浪财经', intro: '摘要二' },
    ],
  },
}

/** 东财资讯 */
const SAMPLE_EM_NEWS = {
  data: {
    fastNewsList: [
      { title: '沪指涨0.5%', url: 'https://finance.eastmoney.com/n1', showTime: '2026-08-07 14:00:00', summary: '摘要' },
    ],
  },
}

/** 海外 RSS（rss2json 包装） */
const SAMPLE_RSS = {
  status: 'ok',
  items: [
    { title: 'Fed holds rates', link: 'https://marketwatch.com/n1', pubDate: '2026-08-07 10:00:00', description: 'desc' },
  ],
}

/** 节假日 */
const SAMPLE_HOLIDAY = [{ date: '2026-10-01', localName: '国庆节', name: 'National Day' }]

/** 板块榜单 */
const SAMPLE_SECTOR = {
  rc: 0,
  data: {
    total: 1,
    diff: [{ f12: 'BK0475', f14: '银行', f2: 1250.5, f3: 1.85, f13: 90, f104: 20, f105: 5, f128: '招商银行', f136: 3.2 }],
  },
}

/** GLM 视觉识别响应 */
const SAMPLE_GLM = {
  choices: [
    {
      message: {
        content: '[{"fundCode":"000001","fundName":"华夏成长混合","holdingAmount":15234.56,"holdingProfit":-123.45}]',
      },
    },
  ],
}

/* ─────────────── URL → 样本 路由 ─────────────── */

function matchSample(url: string): unknown {
  const u = url.toLowerCase()
  if (u.includes('fundgz.1234567')) return SAMPLE_FUNDGZ
  if (u.includes('fundcode_search')) return SAMPLE_FUND_CATALOG
  if (u.includes('fundsearchapi') || u.includes('fundsuggest')) return SAMPLE_FUND_SEARCH
  if (u.includes('f10dataapi')) return SAMPLE_LSJZ
  if (u.includes('fundarchivesdatas')) return SAMPLE_F10
  if (u.includes('pingzhongdata')) return SAMPLE_PINGZHONG
  if (u.includes('fundmobapi')) return { Datas: { fundStocks: [{ GPDM: '600519', GPJC: '贵州茅台', JZBL: '8.50' }] }, ErrCode: 0 }
  if (u.includes('searchapi.eastmoney')) return SAMPLE_STOCK_SEARCH
  if (u.includes('push2his') || u.includes('kline')) return SAMPLE_EM_KLINE
  if (u.includes('bk') || u.includes('sector')) return SAMPLE_SECTOR
  if (u.includes('push2.eastmoney')) return u.includes('000001') || u.includes('399001') ? SAMPLE_INDEX : SAMPLE_EM_QUOTES
  if (u.includes('gtimg')) return SAMPLE_TENCENT
  if (u.includes('yahoo')) return SAMPLE_YAHOO
  if (u.includes('date.nager')) return SAMPLE_HOLIDAY
  if (u.includes('sina')) return SAMPLE_SINA_NEWS
  if (u.includes('eastmoney') && u.includes('news')) return SAMPLE_EM_NEWS
  if (u.includes('rss2json') || u.includes('marketwatch') || u.includes('cnbc')) return SAMPLE_RSS
  if (u.includes('bigmodel')) return SAMPLE_GLM
  if (u.includes('emailjs')) return 'OK'
  // 代理包装：allorigins/corsproxy/thingproxy 把目标 URL 编码在参数里，解出来递归匹配
  if (u.includes('allorigins') || u.includes('corsproxy') || u.includes('thingproxy')) {
    const m = url.match(/(?:url=|\?)(https?[^&]*)/i)
    if (m) {
      try {
        return matchSample(decodeURIComponent(m[1]))
      } catch {
        return matchSample(m[1])
      }
    }
  }
  return { ok: true }
}

/** 脏数据版本：结构残缺，用于验证解析层不崩 */
function dirtySample(): unknown {
  return { data: null, rc: undefined, weird: NaN }
}

/* ─────────────── fetch 拦截 ─────────────── */

export function installNetStub(): void {
  globalThis.fetch = (async (input: any) => {
    const url = typeof input === 'string' ? input : (input?.url ?? String(input))
    requestLog.push(url)

    if (mode === 'fail') {
      throw new TypeError('Failed to fetch (stubbed failure)')
    }

    const payload = mode === 'dirty' ? dirtySample() : matchSample(url)
    const isText = typeof payload === 'string'
    const body = isText ? (payload as string) : JSON.stringify(payload)

    return {
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', isText ? 'text/plain' : 'application/json']]),
      url,
      json: async () => (isText ? JSON.parse(body) : payload),
      text: async () => body,
      arrayBuffer: async () => new TextEncoder().encode(body).buffer,
      clone() {
        return this
      },
    } as any
  }) as any

  installJsonpStub()
}

/* ─────────────── JSONP / script 注入拦截 ─────────────── */

/**
 * 业务代码通过 document.createElement('script') + appendChild 发 JSONP。
 * 劫持 appendChild：见到 script 且带 src 时，不真加载，
 * 而是按 URL 匹配样本，直接调用对应回调 / 写入 window 变量。
 */
function installJsonpStub(): void {
  const origAppend = Node.prototype.appendChild
  Node.prototype.appendChild = function <T extends Node>(node: T): T {
    const el = node as unknown as HTMLScriptElement
    if (el && el.tagName === 'SCRIPT' && el.src) {
      const url = el.src
      requestLog.push(url)

      // 关键：把 src 摘掉再入 DOM。否则 happy-dom 会真的去请求这个地址
      // （造成 ECONNRESET / 依赖外网）。业务代码只需要 script 节点存在以便 cleanup。
      try {
        el.removeAttribute('src')
      } catch {
        /* 忽略 */
      }

      // 异步触发，模拟真实脚本加载
      setTimeout(() => {
        if (mode === 'fail') {
          el.onerror?.(new Event('error'))
          return
        }
        try {
          fulfillScript(url, el)
          el.onload?.(new Event('load'))
        } catch {
          el.onerror?.(new Event('error'))
        }
      }, 0)

      // 仍插入 DOM（业务代码 cleanup 时会 removeChild，需能找到 parentNode）
      return origAppend.call(this, node) as T
    }
    return origAppend.call(this, node) as T
  }
}

/** 按 URL 决定：调 JSONP 回调，还是往 window 写 var */
function fulfillScript(url: string, _el: HTMLScriptElement): void {
  const w = globalThis as any
  const payload = mode === 'dirty' ? dirtySample() : matchSample(url)

  // 1) 显式 cb= / callback= 回调参数
  const cbMatch = url.match(/[?&](?:cb|callback)=([^&]+)/i)
  if (cbMatch) {
    const name = decodeURIComponent(cbMatch[1])
    if (typeof w[name] === 'function') {
      // apidata 系列（lsjz / F10）：回调形式是 var apidata={...}，直接赋值
      if (typeof payload === 'string' && payload.includes('var apidata')) {
        assignVarScript(payload)
        return
      }
      w[name](payload)
      return
    }
  }

  // 2) fundgz：固定 jsonpgz 回调
  if (url.includes('fundgz') && typeof w.jsonpgz === 'function') {
    w.jsonpgz(payload)
    return
  }

  // 3) var 定义型脚本（pingzhongdata / fundcode_search / lsjz / F10）
  if (typeof payload === 'string') {
    assignVarScript(payload)
    return
  }

  // 4) 兜底：往 window 挂个同名变量
  w.__lastScriptData = payload
}

/** 执行 "var x = ...;" 形式的脚本文本，把变量挂到 globalThis */
function assignVarScript(src: string): void {
  const w = globalThis as any
  const re = /var\s+([A-Za-z_$][\w$]*)\s*=\s*([\s\S]*?);\s*(?=var\s|$)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const name = m[1]
    const rawValue = m[2]
    try {
      // eslint-disable-next-line no-new-func
      w[name] = new Function(`return (${rawValue})`)()
    } catch {
      w[name] = undefined
    }
  }
}
