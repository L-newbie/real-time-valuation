

import { clamp, type ToyState } from './cicada-physics'

const AUDIO_BASE = 'games/cicada/audio/'

const AUDIO_FILES = [
  '1.mp3',
  '37815454648-1-192.mp3',
  '37815454648-1-192_1.mp3',
  '37815454648-1-192_2.mp3',
  '40016871707-1-192.mp3',
  '40016871707-1-192_1.mp3',
  '40016871707-1-192_2.mp3',
  '40016871707-1-192_3.mp3',
  '40016871707-1-192_4.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1_1.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1_2.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1_3.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1_4.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1_5.mp3',
  'ba4faa37240e4a2486cbe54b666d76a1_6.mp3',
]

interface Sample {
  buffer: AudioBuffer
}

interface AudioNodes {
  master: GainNode
  mode: 'sample' | 'synth' | null

  samples: Sample[]
  sample: AudioBufferSourceNode | null
  lastSampleIndex: number

  triggerPending: boolean

  osc?: OscillatorNode
  lfo?: OscillatorNode
  nGain?: GainNode
  wah?: BiquadFilterNode
}

let AC: AudioContext | null = null
let au: AudioNodes | null = null

function assetUrl(file: string): string {
  const base = (import.meta as any).env?.BASE_URL ?? '/'
  return `${base}${AUDIO_BASE}${file}`
}

export function ensureAudio(fromGesture = false): void {
  try {
    if (AC) {
      if (AC.state !== 'running') void AC.resume().catch(() => {})
      return
    }
    const Ctor = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext
    if (!Ctor) return

    AC = new Ctor() as AudioContext
    void AC.resume().catch(() => {})

    const master = AC.createGain()
    master.gain.value = 0
    const comp = AC.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 8
    comp.attack.value = 0.004
    comp.release.value = 0.18
    master.connect(comp)
    comp.connect(AC.destination)

    au = {
      master, mode: null,
      samples: [], sample: null, lastSampleIndex: -1,
      triggerPending: fromGesture,
    }

    void loadSamples(AC)
  } catch {
  }
}

async function loadSamples(myCtx: AudioContext): Promise<void> {
  const results = await Promise.all(AUDIO_FILES.map(async (file) => {
    try {
      const res = await fetch(assetUrl(file))
      if (!res.ok) return null
      const data = await res.arrayBuffer()
      const buffer = await myCtx.decodeAudioData(data)
      return { buffer } as Sample
    } catch {
      return null
    }
  }))

  if (AC !== myCtx || !au) return

  const valid = results.filter((s): s is Sample => s !== null)
  if (valid.length) {
    au.samples = valid
    au.mode = 'sample'
    if (au.triggerPending) {
      au.triggerPending = false
      triggerSample()
    }
  } else {
    startSynthVoice()
  }
}

function playbackRateForRps(rps: number): number {
  return 0.75 + (1.66 - 0.75) * clamp(rps / 7, 0, 1)
}

let curRps = 0

export function triggerSample(): void {
  if (!AC || !au) return
  if (au.mode !== 'sample') {
    au.triggerPending = true
    return
  }
  if (!au.samples.length) return

  try {
    let idx = Math.floor(Math.random() * au.samples.length)
    if (au.samples.length > 1 && idx === au.lastSampleIndex) {
      idx = (idx + 1 + Math.floor(Math.random() * (au.samples.length - 1))) % au.samples.length
    }
    const buf = au.samples[idx].buffer

    const src = AC.createBufferSource()
    src.buffer = buf
    src.loop = false
    src.playbackRate.value = playbackRateForRps(curRps)
    src.connect(au.master)

    if (au.sample) {
      au.sample.onended = null
      try { au.sample.stop() } catch {  }
      try { au.sample.disconnect() } catch {  }
    }
    au.sample = src
    au.lastSampleIndex = idx

    src.onended = () => {
      if (!au || au.sample !== src) return
      try { src.disconnect() } catch {  }
      au.sample = null

      if (stillPlaying()) triggerSample()
    }
    src.start()
  } catch {
  }
}

let stillPlaying: () => boolean = () => false

export function setPlayingProbe(fn: () => boolean): void {
  stillPlaying = fn
}

function startSynthVoice(): void {
  if (!AC || !au || au.mode) return
  try {
    const t = AC.currentTime

    const osc = AC.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = 70
    const shaper = AC.createWaveShaper()
    const n = 1024
    const curve = new Float32Array(new ArrayBuffer(n * Float32Array.BYTES_PER_ELEMENT))
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1
      curve[i] = Math.tanh(x * 3.2)
    }
    shaper.curve = curve
    shaper.oversample = '2x'
    osc.connect(shaper)

    const am = AC.createGain()
    am.gain.value = 0.62
    const lfo = AC.createOscillator()
    lfo.type = 'sine'
    lfo.frequency.value = 30
    const lfoAmt = AC.createGain()
    lfoAmt.gain.value = 0.34
    lfo.connect(lfoAmt)
    lfoAmt.connect(am.gain)
    shaper.connect(am)

    const nBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate)
    const nd = nBuf.getChannelData(0)
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1
    const noise = AC.createBufferSource()
    noise.buffer = nBuf
    noise.loop = true
    const nFil = AC.createBiquadFilter()
    nFil.type = 'bandpass'
    nFil.frequency.value = 2500
    nFil.Q.value = 0.7
    const nGain = AC.createGain()
    nGain.gain.value = 0
    noise.connect(nFil)
    nFil.connect(nGain)

    const bus = AC.createGain()
    bus.gain.value = 0.9
    am.connect(bus)
    nGain.connect(bus)

    const wah = AC.createBiquadFilter()
    wah.type = 'bandpass'
    wah.frequency.value = 900
    wah.Q.value = 2.2
    bus.connect(wah)

    const sum = AC.createGain()
    sum.gain.value = 1
    const formant = (freq: number, q: number, g: number): void => {
      const f = AC!.createBiquadFilter()
      f.type = 'bandpass'
      f.frequency.value = freq
      f.Q.value = q
      const fg = AC!.createGain()
      fg.gain.value = g
      wah.connect(f)
      f.connect(fg)
      fg.connect(sum)
    }
    formant(1050, 9, 0.9)
    formant(2150, 11, 0.6)
    formant(3350, 13, 0.4)
    const bleed = AC.createGain()
    bleed.gain.value = 0.07
    wah.connect(bleed)
    bleed.connect(sum)

    const hp = AC.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 360
    sum.connect(hp)
    hp.connect(au.master)

    osc.start(t)
    lfo.start(t)
    noise.start(t)
    au.osc = osc
    au.lfo = lfo
    au.nGain = nGain
    au.wah = wah
    au.mode = 'synth'
  } catch {
  }
}

export function updateAudio(s: ToyState): void {
  curRps = s.rps
  if (!AC || AC.state !== 'running' || !au || !au.mode) return
  try {
    const t = AC.currentTime

    au.master.gain.setTargetAtTime(0.85 * Math.pow(s.active, 1.3), t, 0.07)

    if (au.mode === 'sample') {
      if (!au.sample) return

      au.sample.playbackRate.setTargetAtTime(playbackRateForRps(s.rps), t, 0.09)

      au.sample.detune.setTargetAtTime(
        50 * Math.sin(s.theta + 0.9) * clamp(s.active * 1.6, 0, 1), t, 0.04)
      return
    }

    const f0 = clamp(55 + s.rps * 17, 50, 195)
    au.osc!.frequency.setTargetAtTime(f0, t, 0.06)
    au.osc!.detune.setTargetAtTime(
      46 * Math.sin(s.theta + 0.9) * clamp(s.active * 1.6, 0, 1), t, 0.03)
    au.lfo!.frequency.setTargetAtTime(24 + s.rps * 4.5, t, 0.1)
    const wf = 760 + 520 * s.active + (430 + 330 * s.active) * Math.sin(s.theta - 0.7)
    au.wah!.frequency.setTargetAtTime(Math.max(320, wf), t, 0.025)
    au.nGain!.gain.setTargetAtTime(
      (0.03 + 0.17 * s.active) * clamp(s.drive * 4, 0, 1), t, 0.08)
  } catch {
  }
}

export function suspendAudio(): void {
  try {
    if (AC && AC.state === 'running') void AC.suspend().catch(() => {})
  } catch {
  }
}

export function isAudioRunning(): boolean {
  return !!AC && AC.state === 'running'
}

export function disposeAudio(): void {
  try {
    if (au?.sample) {
      au.sample.onended = null
      try { au.sample.stop() } catch {  }
    }
    au?.osc?.stop()
    au?.lfo?.stop()
  } catch {
  }
  try { AC?.close() } catch {  }
  AC = null
  au = null
  curRps = 0
  stillPlaying = () => false
}
