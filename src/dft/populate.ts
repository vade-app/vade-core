// Render a SignalSpectrum onto the tldraw editor as a v0 DFT
// explorer page: input bars on top (memos per day), spectrum bars
// below (DFT magnitudes for k = 0..N/2). All shapes are plain `geo`
// rectangles — no custom shape types needed for v0.
//
// Layout coordinates anchor at (0, 0); zoomToFit reframes the whole
// composition. Heights scale within each section independently
// because the DC bin would dwarf any time-series bar otherwise.

import { createShapeId, type Editor } from 'tldraw'
import type { SignalSpectrum } from './signal'

// Bars wide enough that mono-font count labels fit on one line.
const INPUT_BAR_W = 56
const INPUT_BAR_GAP = 6
const INPUT_MAX_H = 200
const INPUT_BASELINE_Y = 380

const SPECTRUM_BAR_W = 80
const SPECTRUM_BAR_GAP = 10
const SPECTRUM_MAX_H = 240

// Layout y-axis is composed top-to-bottom from these constants.
const TITLE_Y = 0
const TITLE_H = 64
const SUBTITLE_Y = 80
const SUBTITLE_H = 40
const TITLE_W_HINT = 700

const DAY_LABEL_Y = INPUT_BASELINE_Y + 10
const DAY_LABEL_H = 36
const INPUT_AXIS_Y = DAY_LABEL_Y + DAY_LABEL_H + 36
const INPUT_AXIS_H = 40

const SPECTRUM_BASELINE_Y = INPUT_AXIS_Y + INPUT_AXIS_H + 80 + SPECTRUM_MAX_H
const PERIOD_LABEL_Y = SPECTRUM_BASELINE_Y + 10
const PERIOD_LABEL_H = 36
const SPECTRUM_AXIS_Y = PERIOD_LABEL_Y + PERIOD_LABEL_H + 14
const SPECTRUM_AXIS_H = 40

function toRichText(text: string): unknown {
  const lines = text.split('\n')
  const content = lines.map((line) =>
    line
      ? { type: 'paragraph', content: [{ type: 'text', text: line }] }
      : { type: 'paragraph' },
  )
  return { type: 'doc', content }
}

function dayLabel(iso: string): string {
  // "2026-04-22" → "22". Just the day-of-month — the month is fixed
  // in the v0 corpus; if a window crosses months later, this becomes
  // a per-bar tick decision.
  return iso.slice(8)
}

function periodLabel(periodDays: number | null): string {
  if (periodDays === null) return 'DC'
  if (periodDays >= 10) return `${periodDays.toFixed(0)}d`
  return `${periodDays.toFixed(1)}d`
}

function isWeekendISO(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`)
  const day = d.getUTCDay()
  return day === 0 || day === 6
}

export interface PopulateDftResult {
  inputBars: number
  spectrumBars: number
}

export function populateDft(editor: Editor, ss: SignalSpectrum): PopulateDftResult {
  if (ss.signal.length === 0) {
    return { inputBars: 0, spectrumBars: 0 }
  }
  const firstSample = ss.signal[0]!
  const lastSample = ss.signal[ss.signal.length - 1]!

  const inputMaxValue = Math.max(...ss.signal.map((s) => s.value), 1)
  const spectrumMaxMag = Math.max(...ss.spectrum.map((b) => b.magnitude), 1)

  const inputTotalW = ss.signal.length * INPUT_BAR_W + (ss.signal.length - 1) * INPUT_BAR_GAP
  const spectrumTotalW = ss.spectrum.length * SPECTRUM_BAR_W + (ss.spectrum.length - 1) * SPECTRUM_BAR_GAP
  const fieldW = Math.max(inputTotalW, spectrumTotalW, TITLE_W_HINT)
  const inputStartX = (fieldW - inputTotalW) / 2
  const spectrumStartX = (fieldW - spectrumTotalW) / 2

  const newGeo = (
    x: number,
    y: number,
    w: number,
    h: number,
    overrides: Record<string, unknown>,
  ) =>
    editor.createShape({
      id: createShapeId(),
      type: 'geo',
      x,
      y,
      props: {
        geo: 'rectangle',
        w,
        h,
        color: 'grey',
        fill: 'none',
        dash: 'solid',
        size: 's',
        font: 'mono',
        align: 'middle',
        verticalAlign: 'middle',
        ...overrides,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)

  editor.run(() => {
    // Title.
    newGeo(0, TITLE_Y, fieldW, TITLE_H, {
      color: 'black',
      size: 'l',
      richText: toRichText('DFT explorer · v0'),
    })

    // Subtitle.
    const subtitle =
      `Input · COO memo cadence · ${firstSample.date} → ${lastSample.date}` +
      ` · ${ss.totalMemos} memos · ${ss.windowDays} days · DC ${ss.dc.toFixed(2)}/day`
    newGeo(0, SUBTITLE_Y, fieldW, SUBTITLE_H, {
      richText: toRichText(subtitle),
    })

    // Input bars (memos per day) + per-bar date label.
    for (let i = 0; i < ss.signal.length; i++) {
      const s = ss.signal[i]!
      const h = Math.max(8, (s.value / inputMaxValue) * INPUT_MAX_H)
      const x = inputStartX + i * (INPUT_BAR_W + INPUT_BAR_GAP)
      const y = INPUT_BASELINE_Y - h
      const isWeekend = isWeekendISO(s.date)
      newGeo(x, y, INPUT_BAR_W, h, {
        color: s.value === 0 ? 'grey' : isWeekend ? 'light-blue' : 'blue',
        fill: s.value === 0 ? 'none' : 'solid',
        richText: toRichText(s.value > 0 ? String(s.value) : ''),
      })
      newGeo(x, DAY_LABEL_Y, INPUT_BAR_W, DAY_LABEL_H, {
        richText: toRichText(dayLabel(s.date)),
      })
    }

    // Time-domain axis caption.
    newGeo(inputStartX, INPUT_AXIS_Y, inputTotalW, INPUT_AXIS_H, {
      dash: 'dashed',
      richText: toRichText(
        `time domain · count of memos per day · max ${inputMaxValue}/day`,
      ),
    })

    // Spectrum bars (DFT magnitudes for k = 0..N/2) + per-bar period.
    for (let i = 0; i < ss.spectrum.length; i++) {
      const b = ss.spectrum[i]!
      const h = Math.max(10, (b.magnitude / spectrumMaxMag) * SPECTRUM_MAX_H)
      const x = spectrumStartX + i * (SPECTRUM_BAR_W + SPECTRUM_BAR_GAP)
      const y = SPECTRUM_BASELINE_Y - h
      const isDc = b.k === 0
      newGeo(x, y, SPECTRUM_BAR_W, h, {
        color: isDc ? 'orange' : 'violet',
        fill: 'solid',
        richText: toRichText(b.magnitude.toFixed(1)),
      })
      newGeo(x, PERIOD_LABEL_Y, SPECTRUM_BAR_W, PERIOD_LABEL_H, {
        richText: toRichText(periodLabel(b.periodDays)),
      })
    }

    // Frequency-domain axis caption.
    newGeo(spectrumStartX, SPECTRUM_AXIS_Y, spectrumTotalW, SPECTRUM_AXIS_H, {
      dash: 'dashed',
      richText: toRichText(
        `frequency domain · k = 0..${ss.spectrum.length - 1} · period = ${ss.windowDays}/k days · DC=mean`,
      ),
    })
  })

  editor.zoomToFit({ animation: { duration: 240 } })

  return {
    inputBars: ss.signal.length,
    spectrumBars: ss.spectrum.length,
  }
}
