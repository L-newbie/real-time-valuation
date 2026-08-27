/**
 * matchMedia 桩 + ECharts 桩
 *
 * matchMedia：happy-dom 未完整实现，而 use-breakpoint.ts 依赖它做响应式断点。
 *   提供三档切换（mobile/tablet/desktop），供 UI 用例验证不同布局下都能渲染。
 *
 * ECharts：happy-dom 无 Canvas，真实 echarts 初始化会抛错。
 *   桩掉后只验证"初始化被调用 / 配置生成 / 销毁被调用"，不验证渲染像素。
 */

export type Breakpoint = 'mobile' | 'tablet' | 'desktop'

let current: Breakpoint = 'desktop'

export function setBreakpoint(bp: Breakpoint): void {
  current = bp
}
export function resetBreakpoint(): void {
  current = 'desktop'
}

function matches(query: string): boolean {
  const q = query.replace(/\s+/g, '')
  if (q.includes('max-width:767px')) return current === 'mobile'
  if (q.includes('min-width:768px') && q.includes('max-width:1023px')) return current === 'tablet'
  if (q.includes('min-width:1024px')) return current === 'desktop'
  if (q.includes('prefers-reduced-motion')) return false
  if (q.includes('prefers-color-scheme:dark')) return false
  return false
}

export function installMediaStub(): void {
  const impl = (query: string) => {
    const list: any = {
      media: query,
      matches: matches(query),
      onchange: null,
      addListener: (fn: any) => list._l.push(fn),
      removeListener: (fn: any) => (list._l = list._l.filter((f: any) => f !== fn)),
      addEventListener: (_t: string, fn: any) => list._l.push(fn),
      removeEventListener: (_t: string, fn: any) => (list._l = list._l.filter((f: any) => f !== fn)),
      dispatchEvent: () => true,
      _l: [] as any[],
    }
    return list
  }
  Object.defineProperty(globalThis, 'matchMedia', { value: impl, writable: true, configurable: true })
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'matchMedia', { value: impl, writable: true, configurable: true })
  }
}

/* ─────────────── ECharts 桩 ─────────────── */

/** 记录图表调用，供 UI 用例断言"初始化了/设置配置了/销毁了" */
export const chartCalls = {
  init: 0,
  setOption: 0,
  dispose: 0,
  resize: 0,
  lastOption: null as any,
}

export function resetChartCalls(): void {
  chartCalls.init = 0
  chartCalls.setOption = 0
  chartCalls.dispose = 0
  chartCalls.resize = 0
  chartCalls.lastOption = null
}

export function makeFakeChart() {
  chartCalls.init++
  return {
    setOption(opt: any) {
      chartCalls.setOption++
      chartCalls.lastOption = opt
    },
    dispose() {
      chartCalls.dispose++
    },
    resize() {
      chartCalls.resize++
    },
    on() {},
    off() {},
    getZr: () => ({ on() {}, off() {} }),
    convertToPixel: () => [0, 0],
    convertFromPixel: () => [0, 0],
    getOption: () => chartCalls.lastOption,
    clear() {},
  }
}

/** happy-dom 缺 Canvas，补最小实现，避免 echarts/图表库初始化抛错 */
export function installCanvasStub(): void {
  if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = function () {
      return {
        fillRect() {}, clearRect() {}, getImageData: () => ({ data: [] }),
        putImageData() {}, createImageData: () => [], setTransform() {},
        drawImage() {}, save() {}, fillText() {}, restore() {}, beginPath() {},
        moveTo() {}, lineTo() {}, closePath() {}, stroke() {}, translate() {},
        scale() {}, rotate() {}, arc() {}, fill() {},
        measureText: () => ({ width: 0 }), transform() {}, rect() {}, clip() {},
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} }),
      } as any
    } as any
  }
}
