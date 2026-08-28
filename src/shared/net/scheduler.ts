import { waitUntilVisible, onVisibilityChange } from '@/shared/net/page-visibility'

export interface JobResult {
  complete: boolean

  progressed?: boolean

  nextDelay?: number
}

export interface JobOptions {
  key: string

  interval: number

  retryBase?: number

  retryMax?: number

  phase?: number

  run: () => Promise<JobResult>
}

interface JobState {
  opts: JobOptions
  running: boolean
  missStreak: number
  timer: ReturnType<typeof setTimeout> | null
  resolveSleep: (() => void) | null
}

const jobs = new Map<string, JobState>()

let visibilityBound = false

function bindVisibilityWake(): void {
  if (visibilityBound) return
  visibilityBound = true
  onVisibilityChange((visible) => {
    if (!visible) return
    for (const job of jobs.values()) {
      if (job.running) interrupt(job)
    }
  })
}

const DEFAULT_RETRY_BASE = 3000

const DEFAULT_RETRY_MAX = 5 * 60 * 1000

const PHASE_STEP = 1500

const MIN_YIELD = 10

export function defineJob(opts: JobOptions): void {
  const existing = jobs.get(opts.key)
  if (existing) {
    existing.opts = opts
    return
  }
  jobs.set(opts.key, {
    opts,
    running: false,
    missStreak: 0,
    timer: null,
    resolveSleep: null,
  })
}

export function startJob(key: string): void {
  const job = jobs.get(key)
  if (!job || job.running) return
  bindVisibilityWake()
  job.running = true
  job.missStreak = 0
  void launch(job)
}

export function stopJob(key: string): void {
  const job = jobs.get(key)
  if (!job) return
  job.running = false
  interrupt(job)
}

export function wakeJob(key: string): void {
  const job = jobs.get(key)
  if (!job || !job.running) return
  job.missStreak = 0
  interrupt(job)
}

export function startAllJobs(): void {
  for (const key of jobs.keys()) startJob(key)
}

export function stopAllJobs(): void {
  for (const key of jobs.keys()) stopJob(key)
}

export function jobStats(): Array<{ key: string; running: boolean; missStreak: number }> {
  return [...jobs.values()].map(j => ({
    key: j.opts.key,
    running: j.running,
    missStreak: j.missStreak,
  }))
}

function interrupt(job: JobState): void {
  if (job.timer) { clearTimeout(job.timer); job.timer = null }
  if (job.resolveSleep) { const r = job.resolveSleep; job.resolveSleep = null; r() }
}

function sleep(job: JobState, ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    job.resolveSleep = resolve
    job.timer = setTimeout(() => {
      job.timer = null
      job.resolveSleep = null
      resolve()
    }, ms)
  })
}

async function launch(job: JobState): Promise<void> {
  const phase = (job.opts.phase ?? 0) * PHASE_STEP
  if (phase > 0) await new Promise<void>(r => setTimeout(r, phase))
  if (!job.running) return
  void loop(job)
}

async function loop(job: JobState): Promise<void> {
  while (job.running) {
    await waitUntilVisible()
    if (!job.running) break

    let result: JobResult
    try {
      result = await job.opts.run()
    } catch {
      result = { complete: false, progressed: false }
    }
    if (!job.running) break

    if (result.complete) {
      job.missStreak = 0
      await sleep(job, result.nextDelay ?? job.opts.interval)
      continue
    }

    if (result.progressed) {
      job.missStreak = 0
      await sleep(job, MIN_YIELD)
      continue
    }

    job.missStreak++
    const base = job.opts.retryBase ?? DEFAULT_RETRY_BASE
    const max = job.opts.retryMax ?? DEFAULT_RETRY_MAX
    await sleep(job, Math.min(base * 2 ** (job.missStreak - 1), max))
  }
}
