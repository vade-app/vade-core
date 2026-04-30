// DFT explorer v0 — signal generation from the COO memo lineage.
//
// First-light demo signal: the chain's own publication cadence
// (memos per day, in chronological order) becomes the time-series
// input to a naive DFT. The recursion is the point — the chain
// looking at itself in the frequency domain on the day the explorer
// ships. After v0, the signal source becomes pluggable.

import type { MemoEntry } from '../lineage/layout'

export interface SignalSample {
  date: string  // YYYY-MM-DD
  value: number
}

export interface DftBin {
  k: number
  magnitude: number
  frequency: number  // cycles per total window
  periodDays: number | null  // window length / k, or null for k=0 (DC)
}

export interface SignalSpectrum {
  signal: SignalSample[]
  spectrum: DftBin[]
  dc: number  // mean
  totalMemos: number
  windowDays: number  // signal.length
}

// Bucket memos per day from the minimum to the maximum date in the
// corpus, padding zero-count days so the time series is uniformly
// sampled. Per Nyquist, only k = 0..N/2 carry independent information
// for a real signal of length N; we return that half.
export function memosToSpectrum(memos: MemoEntry[]): SignalSpectrum {
  if (memos.length === 0) {
    return { signal: [], spectrum: [], dc: 0, totalMemos: 0, windowDays: 0 }
  }

  const dateOf = (m: MemoEntry) => m.id.slice(0, 10)
  const all = memos.map(dateOf).sort()
  const start = all[0]!
  const end = all[all.length - 1]!

  const counts = new Map<string, number>()
  for (const d of all) counts.set(d, (counts.get(d) ?? 0) + 1)

  const signal: SignalSample[] = []
  const cursor = new Date(`${start}T00:00:00Z`)
  const last = new Date(`${end}T00:00:00Z`)
  while (cursor.getTime() <= last.getTime()) {
    const iso = cursor.toISOString().slice(0, 10)
    signal.push({ date: iso, value: counts.get(iso) ?? 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  const x = signal.map((s) => s.value)
  const N = x.length

  // Naive O(N^2) DFT. N=19 today; 19^2 = 361 ops; trivially fast.
  // Returning magnitudes only — phase is interesting but not the v0
  // story. The v0 story is "do the periodicities of the chain show
  // anything legible at this length scale."
  const spectrum: DftBin[] = []
  const half = Math.floor(N / 2) + 1
  for (let k = 0; k < half; k++) {
    let re = 0
    let im = 0
    for (let n = 0; n < N; n++) {
      const xn = x[n]!
      const phi = (-2 * Math.PI * k * n) / N
      re += xn * Math.cos(phi)
      im += xn * Math.sin(phi)
    }
    spectrum.push({
      k,
      magnitude: Math.sqrt(re * re + im * im),
      frequency: k / N,
      periodDays: k === 0 ? null : N / k,
    })
  }

  const dc = N > 0 ? x.reduce((a, b) => a + b, 0) / N : 0

  return {
    signal,
    spectrum,
    dc,
    totalMemos: memos.length,
    windowDays: N,
  }
}
