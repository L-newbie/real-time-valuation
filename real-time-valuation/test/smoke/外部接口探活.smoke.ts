/**
 * 外部接口探活 - 真实请求全部数据源
 *
 * 覆盖 app 依赖的全部外部接口（密钥类除外，见文件末尾说明）。
 * 每条只验证：能不能连通 + 返回结构里还有没有解析代码依赖的关键字段。
 *
 * 跑法：npm run test:smoke
 * 频率：建议每周一次，或线上出现"数据显示 -- "时立刻跑一次定位。
 */

import { describe } from 'vitest'
import { smokeCase } from './probe'

/* ═══════════ 基金数据源 ═══════════ */

describe('基金数据源', () => {
  smokeCase(
    '01', '天天基金 · 实时估值 (fundgz)',
    'https://fundgz.1234567.com.cn/js/000001.js?rt=' + Date.now(),
    // 解析代码依赖这些字段：见 src/modules/fund/valuation/fundgz-validate.ts
    { expect: ['jsonpgz', 'fundcode', 'dwjz', 'gsz', 'gszzl', 'gztime'] },
  )

  smokeCase(
    '02', '东方财富 · 基金全量数据 (pingzhongdata)',
    'https://fund.eastmoney.com/pingzhongdata/000001.js?v=' + Date.now(),
    // 见 src/modules/fund/valuation/pingzhongdata-fetch.ts
    { expect: ['fS_name', 'fS_code', 'Data_netWorthTrend', 'Data_ACWorthTrend', 'stockCodes'] },
  )

  smokeCase(
    '03', '东方财富 · 历史净值 (F10 lsjz)',
    'https://fundf10.eastmoney.com/F10DataApi.aspx?type=lsjz&code=000001&page=1&per=20',
    // 见 src/modules/fund/valuation/lsjz-parser.ts
    { expect: ['apidata', 'content', 'records'], headers: { Referer: 'https://fundf10.eastmoney.com/' } },
  )

  smokeCase(
    '04', '东方财富 · 基金持仓明细 (F10 FundArchivesDatas)',
    'https://fundf10.eastmoney.com/FundArchivesDatas.aspx?type=jjcc&code=000001&topline=10',
    // 见 src/modules/fund/holdings/holdings-parser.ts
    { expect: ['apidata', 'content'], headers: { Referer: 'https://fundf10.eastmoney.com/' } },
  )

  smokeCase(
    '05', '东方财富 · 基金移动端持仓 (fundmobapi)',
    'https://fundmobapi.eastmoney.com/FundMNewApi/FundMNInverstPosition?FCODE=000001&deviceid=web&plat=Android&product=EFund&version=6.2.8',
    // 见 src/modules/fund/holdings/f10-mobile-fetch.ts
    { expect: ['Datas', 'fundStocks'], json: true },
  )

  smokeCase(
    '06', '东方财富 · 基金代码目录 (fundcode_search)',
    'https://fund.eastmoney.com/js/fundcode_search.js?v=' + Date.now(),
    // 见 src/modules/fund/catalog/fund-code-catalog.ts
    { expect: ['var r'] },
  )

  smokeCase(
    '07', '东方财富 · 基金搜索 (fundsuggest)',
    'https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=000001',
    // 见 src/modules/fund/catalog/fund-search.ts
    { expect: ['Datas'], json: true },
  )

  smokeCase(
    '08', '新浪 · 盘中估值走势 (openapi)',
    'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/FdFundService.getEstimateNetworthPic?symbol=000001',
    // 见 src/modules/fund/intraday/intraday-estimate-fetch.ts
    { expect: ['result'] },
  )
})

/* ═══════════ 股票 / 指数行情源 ═══════════ */

describe('行情数据源', () => {
  smokeCase(
    '09', '腾讯 · 实时行情 (qt.gtimg)',
    'https://qt.gtimg.cn/q=sh600519,sz000858',
    // 见 src/shared/net/tencent-codec.ts
    { expect: ['v_sh600519', '贵州茅台'] },
  )

  smokeCase(
    '10', '腾讯 · K线 (ifzq.gtimg)',
    'https://ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh600519,day,,,20,qfq',
    { expect: ['data', 'sh600519'], json: true },
  )

  smokeCase(
    '11', '东方财富 · 批量行情 (push2 ulist)',
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3&secids=1.600519,0.000858',
    // 见 src/modules/fund/services/em-realtime-service.ts
    { expect: ['data', 'diff', 'f12'], json: true },
  )

  smokeCase(
    '12', '东方财富 · 指数行情 (push2)',
    'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=f12,f13,f14,f2,f3&secids=1.000001,0.399001',
    // 见 src/modules/index/index-service.ts
    { expect: ['data', 'diff'], json: true },
  )

  smokeCase(
    '13', '东方财富 · 历史K线 (push2his)',
    'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=1.600519&klt=101&fqt=1&lmt=20&fields1=f1,f2,f3&fields2=f51,f52,f53',
    // 见 src/modules/fund/services/em-kline-fetch.ts
    { expect: ['data', 'klines'], json: true },
  )

  smokeCase(
    '14', '东方财富 · 板块榜单 (push2 clist)',
    'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=20&fs=m:90+t:2&fields=f12,f14,f2,f3',
    { expect: ['data', 'diff'], json: true },
  )

  smokeCase(
    '15', '东方财富 · 股票搜索 (searchapi)',
    'https://searchapi.eastmoney.com/api/suggest/get?input=600519&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=5',
    // 见 src/modules/stock/search/stock-search.ts
    { expect: ['QuotationCodeTable'], json: true },
  )

  smokeCase(
    '16', 'Yahoo Finance · chart（海外行情主源）',
    'https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=2m',
    // 见 src/modules/fund/services/yahoo-service.ts
    // 注：浏览器里需走代理（无 CORS 头），node 直连可测通
    { expect: ['chart', 'result', 'regularMarketPrice'], json: true },
  )
})

/* ═══════════ 资讯源 ═══════════ */

describe('资讯数据源', () => {
  smokeCase(
    '17', '新浪财经 · 资讯流',
    'https://feed.mix.sina.com.cn/api/roll/get?pageid=155&lid=1686&num=20&page=1',
    // 见 src/modules/news/sources/sina-news.ts
    { expect: ['result', 'data'], json: true },
  )
})

/* ═══════════ 基础服务 ═══════════ */

describe('基础服务', () => {
  smokeCase(
    '21', '节假日服务 (date.nager.at)',
    'https://date.nager.at/api/v3/PublicHolidays/2026/CN',
    // 见 src/modules/fund/services/holiday-service.ts
    { expect: ['date'], json: true },
  )
})

/* ═══════════ CORS 公共代理（海外数据链路命脉）═══════════ */

describe('公共代理', () => {
  // 这几个代理任何一个挂了都不致命（有轮换+熔断），但全挂则海外行情/资讯不可用。
  // 见 src/shared/net/proxy-candidates.ts + proxy-rotation.ts
  smokeCase(
    '22', 'allorigins 代理',
    'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d'),
    { expect: ['chart'] },
  )

  smokeCase(
    '23', 'corsproxy.io 代理',
    'https://corsproxy.io/?' + encodeURIComponent('https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d'),
    { expect: ['chart'] },
  )

  smokeCase(
    '24', 'thingproxy 代理',
    'https://thingproxy.freeboard.io/fetch/https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1d&interval=1d',
    { expect: ['chart'] },
  )
})

/* ═══════════ 说明：为什么不探活密钥类接口 ═══════════
 *
 * 以下两个接口**故意不探活**：
 *   - 智谱 GLM-4V (open.bigmodel.cn)  —— 每次调用消耗免费额度
 *   - EmailJS (api.emailjs.com)       —— 每次调用会真的发出一封邮件，且免费层仅 200 封/月
 *
 * 这两个功能的可用性由主测试的 17 域覆盖（模块可加载、结果解析不崩、配置检查函数可用），
 * 真实调用请手动在页面上验证。
 */
