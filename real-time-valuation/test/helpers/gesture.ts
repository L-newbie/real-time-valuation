/**
 * 手势合成 - 在 happy-dom 里模拟触摸/鼠标交互序列
 *
 * happy-dom 无真实触屏，但业务代码只读事件对象的 touches/clientX 等字段，
 * 故构造结构相同的合成事件派发即可，足以驱动手势逻辑跑完整条路径。
 */

/** 构造一个 Touch 样子的对象（happy-dom 无 Touch 构造函数） */
function makeTouch(x: number, y: number, target: EventTarget) {
  return {
    identifier: 0,
    target,
    clientX: x,
    clientY: y,
    pageX: x,
    pageY: y,
    screenX: x,
    screenY: y,
    radiusX: 1,
    radiusY: 1,
    rotationAngle: 0,
    force: 1,
  }
}

/** 派发一个触摸事件 */
export function dispatchTouch(
  el: Element | Document,
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  x: number,
  y: number,
): Event {
  const target = el as EventTarget
  const touch = makeTouch(x, y, target)
  const ev: any = new Event(type, { bubbles: true, cancelable: true })
  const list = type === 'touchend' || type === 'touchcancel' ? [] : [touch]
  ev.touches = list
  ev.targetTouches = list
  ev.changedTouches = [touch]
  ;(el as any).dispatchEvent(ev)
  return ev
}

/** 派发一个鼠标事件 */
export function dispatchMouse(
  el: Element | Document,
  type: 'mousedown' | 'mousemove' | 'mouseup' | 'mouseleave' | 'click' | 'contextmenu',
  x = 0,
  y = 0,
): Event {
  const ev: any = new Event(type, { bubbles: true, cancelable: true })
  ev.clientX = x
  ev.clientY = y
  ev.pageX = x
  ev.pageY = y
  ev.button = type === 'contextmenu' ? 2 : 0
  ;(el as any).dispatchEvent(ev)
  return ev
}

/** 完整滑动手势：start → 多个 move → end */
export function swipe(
  el: Element | Document,
  opts: { fromX: number; toX: number; y?: number; steps?: number },
): void {
  const { fromX, toX, y = 200, steps = 5 } = opts
  dispatchTouch(el, 'touchstart', fromX, y)
  const dx = (toX - fromX) / steps
  for (let i = 1; i <= steps; i++) {
    dispatchTouch(el, 'touchmove', fromX + dx * i, y)
  }
  dispatchTouch(el, 'touchend', toX, y)
}

/** 左滑（手指向左移动） */
export function swipeLeft(el: Element | Document, distance = 200): void {
  swipe(el, { fromX: 300, toX: 300 - distance })
}

/** 右滑 */
export function swipeRight(el: Element | Document, distance = 200): void {
  swipe(el, { fromX: 100, toX: 100 + distance })
}

/** 长按：按下后等待超过长按阈值再抬起 */
export async function longPress(el: Element, x = 100, y = 100, holdMs = 700): Promise<void> {
  dispatchTouch(el, 'touchstart', x, y)
  await wait(holdMs)
  dispatchTouch(el, 'touchend', x, y)
}

/** 长按但中途移动（应取消长按） */
export async function longPressWithMove(el: Element, x = 100, y = 100): Promise<void> {
  dispatchTouch(el, 'touchstart', x, y)
  await wait(200)
  dispatchTouch(el, 'touchmove', x + 60, y + 60)
  await wait(500)
  dispatchTouch(el, 'touchend', x + 60, y + 60)
}

/** 鼠标长按（桌面端等价） */
export async function mouseLongPress(el: Element, x = 100, y = 100, holdMs = 700): Promise<void> {
  dispatchMouse(el, 'mousedown', x, y)
  await wait(holdMs)
  dispatchMouse(el, 'mouseup', x, y)
}

/** 双击（两次快速轻点） */
export async function doubleTap(el: Element, x = 100, y = 100): Promise<void> {
  dispatchTouch(el, 'touchstart', x, y)
  dispatchTouch(el, 'touchend', x, y)
  await wait(50)
  dispatchTouch(el, 'touchstart', x, y)
  dispatchTouch(el, 'touchend', x, y)
}

/** 拖拽文件到元素上 */
export function dropFile(el: Element, file: { name: string; type: string; content?: string }): void {
  const f: any = {
    name: file.name,
    type: file.type,
    size: (file.content ?? 'x').length,
    arrayBuffer: async () => new ArrayBuffer(8),
    text: async () => file.content ?? '',
  }
  const ev: any = new Event('drop', { bubbles: true, cancelable: true })
  ev.dataTransfer = { files: [f], items: [{ kind: 'file', type: file.type, getAsFile: () => f }], types: ['Files'] }
  el.dispatchEvent(ev)
}

/** 粘贴图片 */
export function pasteImage(el: Element | Document): void {
  const f: any = { name: 'paste.png', type: 'image/png', size: 100, arrayBuffer: async () => new ArrayBuffer(8) }
  const ev: any = new Event('paste', { bubbles: true, cancelable: true })
  ev.clipboardData = { files: [f], items: [{ kind: 'file', type: 'image/png', getAsFile: () => f }], types: ['Files'] }
  ;(el as any).dispatchEvent(ev)
}

/** 等待 n 毫秒（真实等待，不受伪时钟影响） */
export function wait(ms: number): Promise<void> {
  return new Promise(r => globalThis.setTimeout(r, ms))
}

/** 等待 Vue 完成 DOM 更新 + 微任务队列清空 */
export async function flush(times = 3): Promise<void> {
  for (let i = 0; i < times; i++) {
    await Promise.resolve()
    await new Promise(r => globalThis.setTimeout(r, 0))
  }
}
