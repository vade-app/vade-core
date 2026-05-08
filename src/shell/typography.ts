// Typography scale for the VADE shell. System-stack only — no
// webfont download. tldraw 4.5.10's UI uses font-family: inherit
// from the host document, so its chrome stays visually consistent
// with whatever fontSans we pick. Mono stack matches what already
// shipped in ParamForm + code/data shape utilities.
//
// Outliers: 16/18px display sizes in FullPage and LibraryPanel are
// kept as inline literals with a `/* display */` comment rather
// than added to the scale. See #184.

export const fontSans = 'system-ui, -apple-system, sans-serif'

export const fontMono = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

// Renamed `size` (not `fontSize`) to avoid shadowing the CSS
// property name when used inline as `fontSize: size.sm`.
export const size = {
  xs: 10,
  sm: 11,
  md: 12,
  lg: 13,
  xl: 14,
} as const
