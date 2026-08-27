

import { clamp, type ToyState } from './cicada-physics'

const TAU = Math.PI * 2

const TOY_ICON_SIZE = 76

function assetUrl(file: string): string {
  const base = (import.meta as any).env?.BASE_URL ?? '/'
  return `${base}games/cicada/${file}`
}

export interface Renderer {
  resize: (W: number, H: number, dpr: number) => void

  draw: (s: ToyState, now: number, dt: number) => void

  dispose: () => void
}

function mulberry32(seed: number): () => number {
  return function (): number {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Star { x: number; y: number; r: number; a: number; ph: number; sp: number }
interface Ripple { x: number; y: number; r: number; life: number; max: number }

export function createRenderer(ctx: CanvasRenderingContext2D): Renderer {
  let W = 0
  let H = 0
  let DPR = 1
  let bgLayer: HTMLCanvasElement | null = null
  let stars: Star[] = []
  let stickGrad: CanvasGradient | null = null

  const toyIcon = new Image()
  toyIcon.src = assetUrl('2D.png')
  const toyIconFast = new Image()
  toyIconFast.src = assetUrl('2D_1.png')

  const tintCanvas = document.createElement('canvas')
  tintCanvas.width = tintCanvas.height = TOY_ICON_SIZE
  const tintCtx = tintCanvas.getContext('2d')

  const ripples: Ripple[] = []
  let rippleTimer = 0

  function buildBgLayer(): void {
    if (!(W > 0 && H > 0)) return
    const c = document.createElement('canvas')
    c.width = W * DPR
    c.height = H * DPR
    const b = c.getContext('2d')
    if (!b) return
    b.setTransform(DPR, 0, 0, DPR, 0, 0)

    const sky = b.createLinearGradient(0, 0, 0, H)
    sky.addColorStop(0, '#0a1028')
    sky.addColorStop(0.45, '#16204a')
    sky.addColorStop(0.78, '#2c2a55')
    sky.addColorStop(1, '#43325a')
    b.fillStyle = sky
    b.fillRect(0, 0, W, H)

    const glow = b.createRadialGradient(W * 0.5, H * 1.12, 0, W * 0.5, H * 1.12, H * 0.75)
    glow.addColorStop(0, 'rgba(232,140,84,0.16)')
    glow.addColorStop(1, 'rgba(232,140,84,0)')
    b.fillStyle = glow
    b.fillRect(0, 0, W, H)

    const mx = W * 0.78
    const my = H * 0.16
    const mg = b.createRadialGradient(mx, my, 4, mx, my, 130)
    mg.addColorStop(0, 'rgba(247,232,200,0.30)')
    mg.addColorStop(0.25, 'rgba(247,232,200,0.09)')
    mg.addColorStop(1, 'rgba(247,232,200,0)')
    b.fillStyle = mg
    b.beginPath()
    b.arc(mx, my, 130, 0, TAU)
    b.fill()
    b.fillStyle = '#f5e9cb'
    b.beginPath()
    b.arc(mx, my, 26, 0, TAU)
    b.fill()
    b.fillStyle = 'rgba(200,180,150,0.35)'
    b.beginPath(); b.arc(mx - 8, my + 4, 5, 0, TAU); b.fill()
    b.beginPath(); b.arc(mx + 7, my - 7, 3.5, 0, TAU); b.fill()

    bgLayer = c
  }

  function resize(nw: number, nh: number, dpr: number): void {
    W = nw
    H = nh
    DPR = dpr
    stickGrad = null

    const rnd = mulberry32(2024)
    stars = []
    for (let i = 0; i < 90; i++) {
      stars.push({
        x: rnd() * W, y: rnd() * H * 0.72,
        r: 0.5 + rnd() * 1.1,
        a: 0.15 + rnd() * 0.55,
        ph: rnd() * TAU,
        sp: 0.4 + rnd() * 1.2,
      })
    }
    buildBgLayer()
  }

  function redFilterStrength(s: ToyState, now: number): number {
    const stillPulse = 0.5 + 0.5 * Math.sin((now * TAU) / 1.6)
    const speedRed = clamp(s.rps / 6.5, 0, 1)
    return 0.10 + 0.10 * stillPulse + 0.42 * speedRed
  }

  function drawToy(s: ToyState, now: number): void {
    const { stick, tube } = s
    const dx = tube.x - stick.x
    const dy = tube.y - stick.y
    const d = Math.hypot(dx, dy) || 1e-6
    const ux = dx / d
    const uy = dy / d

    ctx.strokeStyle = 'rgba(216,74,53,0.92)'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(stick.x, stick.y)
    if (d < s.ropeLen * 0.97) {
      const sag = (s.ropeLen - d) * 0.55
      ctx.quadraticCurveTo((stick.x + tube.x) / 2, (stick.y + tube.y) / 2 + sag, tube.x, tube.y)
    } else {
      ctx.lineTo(tube.x, tube.y)
    }
    ctx.stroke()

    const sa = 1.15
    const sdx = Math.cos(sa)
    const sdy = Math.sin(sa)
    ctx.save()
    ctx.translate(stick.x, stick.y)
    if (!stickGrad) {
      stickGrad = ctx.createLinearGradient(0, 0, sdx * 88, sdy * 88)
      stickGrad.addColorStop(0, '#e2cd9a')
      stickGrad.addColorStop(1, '#a8894f')
    }
    ctx.strokeStyle = stickGrad
    ctx.lineWidth = 5
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(sdx * 8, sdy * 8)
    ctx.lineTo(sdx * 88, sdy * 88)
    ctx.stroke()

    ctx.strokeStyle = 'rgba(255,240,200,0.35)'
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(sdx * 12 - sdy * 1.4, sdy * 12 + sdx * 1.4)
    ctx.lineTo(sdx * 76 - sdy * 1.4, sdy * 76 + sdx * 1.4)
    ctx.stroke()

    const bead = (bx: number, by: number, r: number): void => {
      ctx.fillStyle = '#c23324'
      ctx.beginPath(); ctx.arc(bx, by, r, 0, TAU); ctx.fill()
      ctx.fillStyle = 'rgba(255,200,180,0.55)'
      ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.35, r * 0.32, 0, TAU); ctx.fill()
    }
    bead(sdx * 14, sdy * 14, 4.6)
    bead(sdx * 4, sdy * 4, 6)
    ctx.restore()

    let icon = toyIcon
    if (s.rps >= 6.5) {
      icon = toyIconFast
    } else {
      const ratio = clamp(s.rps / 6.5, 0, 1)
      const interval = 0.65 + (0.08 - 0.65) * ratio
      icon = Math.floor(now / interval) % 2 ? toyIconFast : toyIcon
    }

    if (!(icon.complete && icon.naturalWidth)) {
      icon = icon === toyIcon ? toyIconFast : toyIcon
    }
    if (!(icon.complete && icon.naturalWidth) || !tintCtx) return

    const redAlpha = redFilterStrength(s, now)
    tintCtx.clearRect(0, 0, TOY_ICON_SIZE, TOY_ICON_SIZE)
    tintCtx.globalCompositeOperation = 'source-over'
    tintCtx.globalAlpha = 1
    tintCtx.drawImage(icon, 0, 0, TOY_ICON_SIZE, TOY_ICON_SIZE)
    tintCtx.globalCompositeOperation = 'source-atop'
    tintCtx.fillStyle = `rgba(205, 18, 18, ${redAlpha.toFixed(3)})`
    tintCtx.fillRect(0, 0, TOY_ICON_SIZE, TOY_ICON_SIZE)
    tintCtx.globalCompositeOperation = 'source-over'

    ctx.save()
    ctx.translate(tube.x, tube.y)

    ctx.rotate(Math.atan2(uy, ux) - Math.PI / 2)
    ctx.drawImage(tintCanvas, -TOY_ICON_SIZE / 2, -TOY_ICON_SIZE / 2, TOY_ICON_SIZE, TOY_ICON_SIZE)
    ctx.restore()
  }

  function drawRipples(s: ToyState, dt: number): void {
    rippleTimer -= dt
    if (s.active > 0.25 && rippleTimer <= 0) {
      rippleTimer = 0.22
      ripples.push({ x: s.tube.x, y: s.tube.y, r: 18, life: 0, max: 0.75 })
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const p = ripples[i]
      p.life += dt
      if (p.life >= p.max) { ripples.splice(i, 1); continue }
      const t = p.life / p.max
      ctx.strokeStyle = `rgba(255,214,150,${(0.5 * (1 - t)).toFixed(3)})`
      ctx.lineWidth = 2 * (1 - t) + 0.5
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r + t * 70, 0, TAU)
      ctx.stroke()
    }
  }

  function draw(s: ToyState, now: number, dt: number): void {
    if (!(W > 0 && H > 0)) return

    if (bgLayer) ctx.drawImage(bgLayer, 0, 0, W, H)
    else { ctx.fillStyle = '#0f1730'; ctx.fillRect(0, 0, W, H) }

    for (const st of stars) {
      const tw = 0.65 + 0.35 * Math.sin(now * st.sp + st.ph)
      ctx.fillStyle = `rgba(255,248,224,${(st.a * tw).toFixed(3)})`
      ctx.beginPath()
      ctx.arc(st.x, st.y, st.r, 0, TAU)
      ctx.fill()
    }

    drawRipples(s, dt)
    drawToy(s, now)
  }

  function dispose(): void {
    bgLayer = null
    stars = []
    ripples.length = 0
    stickGrad = null
  }

  return { resize, draw, dispose }
}
