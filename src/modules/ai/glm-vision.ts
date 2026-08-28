

import type { RecognizedFund } from './ai-types'
import { API_URLS, GLM_CONFIG } from '@/config/constants'

const RECOGNITION_PROMPT = `你是一个基金持仓截图识别助手，主要识别支付宝基金持仓截图（其他持仓App截图同样适用）。请识别图中所有基金的信息，返回一个JSON数组，每个元素只包含以下字段：

- fundCode: 基金代码（6位纯数字，支付宝截图通常在基金名称下方或详情里）
- fundName: 基金名称（完整名称，如"易方达蓝筹精选混合"）
- holdingAmount: 持有金额（数值，单位元，如15234.56转为数字15234.56）
- holdingProfit: 持有收益（数值，单位元，亏损为负数，如-123.45）

【最关键·按列位置识别，不要被列名混淆】
图中每只基金占一行，同一行从左到右依次有 4 个数字区域，位置固定：
  位置①（最左金额）：持有金额       → 填入 holdingAmount
  位置②（第二个金额）：昨日收益      → 【绝对不要取，不是持有收益】
  位置③（第三个金额）：持有收益      → 填入 holdingProfit（你要的就是这个）
  位置④（最右）：持有收益率，带%号   → 是百分比不是金额，【绝对不要取】
- 判定方法：对每一行，从左到右数金额数值的个数。第 1 个金额=holdingAmount，
  第 2 个金额是昨日收益（跳过），第 3 个金额=holdingProfit。
  带百分号%的不是金额，不计入金额个数，永远不要填。
- 反复出错的就是把第 2 个金额（昨日收益）当成 holdingProfit。请记住：
  holdingProfit 是"从左数第 3 个金额数值"，不是第 2 个，不是第 1 个。
  昨日收益（第 2 个金额）绝对不取。

【诚实读取原则】
- 必须逐个像素地看清图中每个数字，把图中实际出现的数字原样抄录，严禁根据基金名称推测、严禁编造、严禁用0或连续数字凑数。
- 如果某只基金的某个数字看不清、被遮挡或不存在，则对应字段省略，不要用 0、null 或估算值填充。
- 持有收益若为 0，只有当图中明确印着"0.00"或"0"时才能填 0；看不清就省略，不要填 0。

【完整扫描，尤其右侧】
- 截图较宽，信息从左到右分布在多列。请从图像最左扫到最右、顶部扫到底部，确认每行的 4 个数字都读到。
- 逐行处理：对每只基金，必须同时读出名称/代码 + 该行从左到右第 1 个金额(持有金额)、
  第 3 个金额(持有收益)，缺一不可。第 2 个(昨日收益)和第 4 个(持有收益率%)只读不取。
- 自查：返回的每只基金是否都有 holdingAmount 和 holdingProfit？且 holdingProfit 是该行
  从左数第 3 个金额（不是第 2 个）？若大量缺失或取成了第 2 个，重新扫描。

注意：
1. 只识别上述4个字段，不要识别收益率/涨跌幅/当日收益/累计收益等
2. holdingProfit 必须是金额数值（元），不是百分比；是该行从左数第 3 个金额，不是第 2 个（昨日收益）
3. 只返回JSON数组，不要返回任何其他文字说明
4. 看不清/不存在的字段直接省略，不要填 0 或估算
5. 持有收益亏损必须为负数（如 -123.45），看不清就省略，不要填 0
6. 基金代码从图中直接读出，无法确认6位代码的可省略 fundCode 字段（不要编造代码）`

interface GLMResponse {
  choices: Array<{
    message: { content: string }
  }>
}

async function readErrorBody(resp: Response): Promise<string> {
  try {
    const text = await resp.text()
    if (!text) return resp.statusText
    try {
      const json = JSON.parse(text)
      const msg = json?.error?.message ?? json?.message ?? json?.msg
      const code = json?.error?.code ?? json?.code
      return [code && `code=${code}`, msg || text].filter(Boolean).join(' ')
    } catch {
      return text
    }
  } catch {
    return resp.statusText
  }
}

export async function recognizeFundFromImage(
  imageBase64: string,
  signal?: AbortSignal,
): Promise<RecognizedFund[]> {
  const apiKey = GLM_CONFIG.API_KEY
  if (!apiKey) {
    throw new Error('未配置 GLM API Key')
  }

  const requestBody = {
    model: GLM_CONFIG.MODEL,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: RECOGNITION_PROMPT },
          { type: 'image_url', image_url: { url: imageBase64 } },
        ],
      },
    ],
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), GLM_CONFIG.TIMEOUT)

  signal?.addEventListener('abort', () => ctrl.abort())

  let response: GLMResponse
  try {
    const resp = await fetch(API_URLS.GLM_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      const errBody = await readErrorBody(resp)
      if (resp.status === 500 && !errBody) {
        throw new Error('GLM 代理转发失败 (500)：vite proxy → open.bigmodel.cn 连接被重置或网络拦截，请检查网络/代理（非智谱服务端错误）')
      }
      throw new Error(`GLM API 错误 (${resp.status}): ${errBody || resp.statusText}`)
    }
    response = await resp.json() as GLMResponse
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('GLM 识别超时或已取消')
    }

    if (e instanceof Error && e.message.startsWith('GLM API 错误')) {
      throw e
    }

    throw new Error(`GLM 请求失败：${(e as Error).message}（可能需配置 CORS 代理）`)
  }

  const content = response.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('GLM API 返回内容为空')
  }

  const funds = parseFundsFromContent(content)

  return funds
    .map(f => ({
      fundCode: f.fundCode != null ? String(f.fundCode) : '',
      fundName: f.fundName || '',
      holdingAmount: f.holdingAmount != null ? Number(f.holdingAmount) : undefined,
      holdingProfit: f.holdingProfit != null ? Number(f.holdingProfit) : undefined,
    }))
}

function parseFundsFromContent(content: string): RecognizedFund[] {
  const fenceMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = (fenceMatch ? fenceMatch[1] : content).trim()

  try {
    const direct = JSON.parse(candidate)
    if (Array.isArray(direct)) return direct as RecognizedFund[]
  } catch {  }

  const start = candidate.indexOf('[')
  if (start === -1) {
    throw new Error('无法从 AI 响应中提取基金信息（未找到 JSON 数组）')
  }
  let depth = 0, inStr = false, escape = false, end = -1
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i]
    if (inStr) {
      if (escape) escape = false
      else if (ch === '\\') escape = true
      else if (ch === '"') inStr = false
    } else if (ch === '"') inStr = true
    else if (ch === '[') depth++
    else if (ch === ']') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) {
    throw new Error('无法从 AI 响应中提取基金信息（JSON 数组不完整）')
  }
  try {
    return JSON.parse(candidate.slice(start, end + 1))
  } catch (e) {
    throw new Error(`AI 响应 JSON 解析失败：${(e as Error).message}`)
  }
}
