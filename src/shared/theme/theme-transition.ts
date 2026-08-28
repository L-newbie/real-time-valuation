
const STEPS = 28

function coveredArea(r: number, hw: number, hh: number): number {
  if (r <= 0) return 0
  const N = 96
  const x1 = Math.min(hw, r)
  const dx = x1 / N
  let area = 0
  for (let i = 0; i < N; i++) {
    const x = (i + 0.5) * dx
    area += Math.min(hh, Math.sqrt(Math.max(0, r * r - x * x))) * dx
  }
  return area * 4
}

function radiusForCoverage(target: number, hw: number, hh: number): number {
  const maxR = Math.hypot(hw, hh)
  const want = hw * hh * 4 * target
  let lo = 0
  let hi = maxR
  for (let i = 0; i < 32; i++) {
    const mid = (lo + hi) / 2
    if (coveredArea(mid, hw, hh) < want) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

export function runThemeTransition(apply: () => void): void {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (typeof document.startViewTransition !== 'function' || reduceMotion) {
    apply()
    return
  }

  const root = document.documentElement
  root.dataset.themeReveal = 'on'

  const transition = document.startViewTransition(() => { apply() })

  void transition.ready
    .then(() => {
      const hw = window.innerWidth / 2
      const hh = window.innerHeight / 2
      const maxR = Math.hypot(hw, hh)
      const duration = readRevealDuration()

      const frames: string[] = []
      for (let i = 0; i <= STEPS; i++) {
        const t = i / STEPS
        const coverage = 1 - Math.pow(1 - t, 1.35)
        const r = i === STEPS
          ? maxR * 1.02
          : radiusForCoverage(coverage, hw, hh)
        frames.push(`circle(${r.toFixed(2)}px at 50% 50%)`)
      }

      root.animate(
        { clipPath: frames },
        { duration, easing: 'linear', pseudoElement: '::view-transition-new(root)' },
      )

      root.animate(
        { opacity: [1, 1, 0], offset: [0, 0.55, 1] },
        { duration, easing: 'linear', pseudoElement: '::view-transition-old(root)' },
      )
    })
    .catch(() => {  })

  void transition.finished.finally(() => { delete root.dataset.themeReveal })
}

function readRevealDuration(): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue('--duration-theme-reveal')
    .trim()
  const n = parseFloat(raw)
  if (!Number.isFinite(n)) return 1000
  return raw.endsWith('ms') ? n : n * 1000
}
