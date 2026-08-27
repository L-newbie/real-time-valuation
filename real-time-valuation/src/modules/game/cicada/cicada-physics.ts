

const TAU = Math.PI * 2

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v)

const ROPE_K = 2600
const ROPE_D = 14
const GRAV = 1150
const AIR_DRAG = 0.35

const AUTO_TARGET_RPS = 3.4

export interface ToyState {
  W: number
  H: number

  ropeLen: number

  autoR: number

  stick: { x: number; y: number }

  target: { x: number; y: number }

  tube: { x: number; y: number; vx: number; vy: number }

  auto: { on: boolean; rps: number; phase: number; cx: number; cy: number }

  theta: number
  prevTheta: number
  omega: number

  rps: number

  taut: number

  drive: number

  active: number

  interacted: boolean

  idleTime: number

  revAccum: number
}

export function createToyState(): ToyState {
  return {
    W: 0, H: 0,
    ropeLen: 150,
    autoR: 58,
    stick: { x: 0, y: 0 },
    target: { x: 0, y: 0 },
    tube: { x: 0, y: 0, vx: 0, vy: 0 },
    auto: { on: false, rps: 0, phase: 0, cx: 0, cy: 0 },
    theta: 0, prevTheta: 0, omega: 0,
    rps: 0, taut: 0, drive: 0, active: 0,
    interacted: false,
    idleTime: 0,
    revAccum: 0,
  }
}

export function recenterToy(s: ToyState): void {
  s.target.x = s.stick.x = s.W * 0.5
  s.target.y = s.stick.y = s.H * 0.42
  s.tube.x = s.stick.x + 8
  s.tube.y = s.stick.y + s.ropeLen * 0.92
  s.tube.vx = 34
  s.tube.vy = 0
  s.prevTheta = Math.atan2(s.tube.y - s.stick.y, s.tube.x - s.stick.x)
}

export function resizeToy(s: ToyState, W: number, H: number): void {
  s.W = W
  s.H = H
  const minDim = Math.min(W, H)
  s.ropeLen = clamp(minDim * 0.28, 90, 150)
  s.autoR = clamp(minDim * 0.13, 38, 58)

  if (!s.interacted) {
    recenterToy(s)
  } else {
    s.target.x = clamp(s.target.x, 0, W)
    s.target.y = clamp(s.target.y, 0, H)
  }
  if (s.auto.on) {
    s.auto.cx = clamp(s.auto.cx, W * 0.28, W * 0.72)
    s.auto.cy = clamp(s.auto.cy, H * 0.26, H * 0.6)
  }
}

function physStep(s: ToyState, h: number): void {
  const { tube, stick } = s
  const dx = tube.x - stick.x
  const dy = tube.y - stick.y
  const d = Math.hypot(dx, dy) || 1e-6
  const ux = dx / d
  const uy = dy / d

  let ax = 0
  let ay = GRAV
  if (d > s.ropeLen) {
    const vrad = tube.vx * ux + tube.vy * uy
    const f = -ROPE_K * (d - s.ropeLen) - ROPE_D * vrad
    ax += f * ux
    ay += f * uy
  }
  ax -= AIR_DRAG * tube.vx
  ay -= AIR_DRAG * tube.vy

  tube.vx += ax * h
  tube.vy += ay * h
  tube.x += tube.vx * h
  tube.y += tube.vy * h
}

export function updateToy(s: ToyState, dt: number): number {
  if (s.auto.on) {
    s.auto.rps += (AUTO_TARGET_RPS - s.auto.rps) * Math.min(1, dt * 1.1)
    s.auto.phase += s.auto.rps * TAU * dt
    s.target.x = s.auto.cx + s.autoR * Math.cos(s.auto.phase)
    s.target.y = s.auto.cy + s.autoR * Math.sin(s.auto.phase)
  } else {
    s.auto.rps *= Math.max(0, 1 - dt * 3)
  }

  const k = 1 - Math.exp(-dt * 26)
  s.stick.x += (s.target.x - s.stick.x) * k
  s.stick.y += (s.target.y - s.stick.y) * k

  let acc = dt
  const h = 1 / 240
  while (acc > 1e-6) {
    const step = Math.min(h, acc)
    physStep(s, step)
    acc -= step
  }

  s.theta = Math.atan2(s.tube.y - s.stick.y, s.tube.x - s.stick.x)
  let dth = s.theta - s.prevTheta
  while (dth > Math.PI) dth -= TAU
  while (dth < -Math.PI) dth += TAU
  s.omega += (dth / dt - s.omega) * Math.min(1, dt * 9)
  s.prevTheta = s.theta
  s.rps = Math.abs(s.omega) / TAU

  let revs = 0
  if (!s.auto.on && s.active > 0.3) {
    s.revAccum += Math.abs(dth)
    if (s.revAccum >= TAU) {
      revs = Math.floor(s.revAccum / TAU)
      s.revAccum -= revs * TAU
    }
  } else {
    s.revAccum = 0
  }

  const ropeDist = Math.hypot(s.tube.x - s.stick.x, s.tube.y - s.stick.y)
  s.taut = clamp((ropeDist / s.ropeLen - 0.88) / 0.12, 0, 1)
  s.drive = clamp((s.rps - 1.1) / 2.6, 0, 1)
  const tgt = Math.pow(s.drive, 1.25) * s.taut
  s.active += (tgt - s.active) * Math.min(1, dt * (tgt > s.active ? 10 : 3.2))

  return revs
}
