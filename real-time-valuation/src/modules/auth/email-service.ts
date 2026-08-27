

import { EMAILJS_CONFIG } from '@/config/constants'

export function isEmailConfigured(): boolean {
  return !!(EMAILJS_CONFIG.SERVICE_ID && EMAILJS_CONFIG.TEMPLATE_ID && EMAILJS_CONFIG.PUBLIC_KEY)
}

export function isFeedbackConfigured(): boolean {
  return !!(EMAILJS_CONFIG.SERVICE_ID && EMAILJS_CONFIG.FEEDBACK_TEMPLATE_ID && EMAILJS_CONFIG.PUBLIC_KEY)
}

async function readEmailError(resp: Response): Promise<string> {
  try {
    const text = await resp.text()
    if (!text) return resp.statusText
    try {
      const json = JSON.parse(text)

      const msg = json?.text ?? json?.message ?? json?.msg
      return msg || text
    } catch {
      return text
    }
  } catch {
    return resp.statusText
  }
}

export interface SendResult {
  sent: boolean

  fallbackHint?: string
}

export async function sendVerifyCodeEmail(toEmail: string, code: string, expireMin: number): Promise<SendResult> {
  if (!isEmailConfigured()) {
    // eslint-disable-next-line no-console
    console.warn(`[auth] EmailJS 未配置，验证码降级输出：${code}（${expireMin} 分钟内有效，收件：${toEmail}）`)
    return {
      sent: false,
      fallbackHint: `未配置邮件服务，验证码：${code}（开发模式，请配置 EmailJS 后启用真实发信）`,
    }
  }

  const body = {
    service_id: EMAILJS_CONFIG.SERVICE_ID,
    template_id: EMAILJS_CONFIG.TEMPLATE_ID,
    user_id: EMAILJS_CONFIG.PUBLIC_KEY,
    template_params: {
      to_email: toEmail,
      code,
      expire: `${expireMin}`,
    },
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)

  try {
    const resp = await fetch(EMAILJS_CONFIG.SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      const errText = await readEmailError(resp)
      throw new Error(`邮件发送失败：${errText}`)
    }
    return { sent: true }
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('邮件发送超时，请稍后重试')
    }
    throw e instanceof Error ? e : new Error('邮件发送失败')
  }
}

export async function sendFeedbackEmail(subject: string, content: string): Promise<void> {
  if (!isFeedbackConfigured()) {
    // eslint-disable-next-line no-console
    console.warn('[feedback] EmailJS 未配置，反馈内容降级输出：\n' + content)
    throw new Error('反馈服务尚未配置，请稍后再试')
  }

  const body = {
    service_id: EMAILJS_CONFIG.SERVICE_ID,
    template_id: EMAILJS_CONFIG.FEEDBACK_TEMPLATE_ID,
    user_id: EMAILJS_CONFIG.PUBLIC_KEY,
    template_params: {
      to_email: EMAILJS_CONFIG.FEEDBACK_TO_EMAIL,
      subject,
      content,
    },
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)

  try {
    const resp = await fetch(EMAILJS_CONFIG.SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
    clearTimeout(timer)
    if (!resp.ok) {
      const errText = await readEmailError(resp)
      throw new Error(`反馈提交失败：${errText}`)
    }
  } catch (e) {
    clearTimeout(timer)
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new Error('提交超时，请检查网络后重试')
    }
    throw e instanceof Error ? e : new Error('反馈提交失败')
  }
}
