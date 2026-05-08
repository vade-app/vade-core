import type { CSSProperties } from 'react'
import { z } from 'zod'
import { fontMono, size } from '../shell/typography'

interface ParamFormProps {
  schema: z.ZodObject<z.ZodRawShape>
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

// Renders form controls auto-generated from a zod paramSchema. Dispatch
// is primarily on runtime value type (number → number input, boolean →
// checkbox, string → text input); a schema sniff catches ZodEnum (inc.
// wrapped via .default()/.optional()) and renders <select>. Skips
// arrays / objects / nulls — not enough fidelity in the schema to
// generate a useful editor for those.
export function ParamForm({ schema, value, onChange }: ParamFormProps) {
  const fields = Object.entries(schema.shape)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {fields.map(([key, fieldSchema]) => {
        const current = value[key]
        const enumValues = sniffEnumValues(fieldSchema)
        if (enumValues) {
          return (
            <Row key={key} label={key}>
              <select
                value={String(current ?? '')}
                onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                style={controlStyle}
              >
                {enumValues.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Row>
          )
        }

        if (typeof current === 'number') {
          const range = sniffNumberRange(fieldSchema)
          return (
            <Row key={key} label={key}>
              <input
                type="number"
                value={current}
                min={range?.min}
                max={range?.max}
                onChange={(e) => {
                  const n = e.target.value === '' ? 0 : Number(e.target.value)
                  if (Number.isFinite(n)) onChange({ ...value, [key]: n })
                }}
                style={controlStyle}
              />
            </Row>
          )
        }

        if (typeof current === 'boolean') {
          return (
            <Row key={key} label={key}>
              <input
                type="checkbox"
                checked={current}
                onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
                style={{ ...controlStyle, width: 16, height: 16 }}
              />
            </Row>
          )
        }

        if (typeof current === 'string') {
          // Multi-line for any string longer than 60 chars or
          // containing a newline; simple heuristic that maps cleanly
          // onto CodeShape `code` (long) vs `language` (short).
          const multiline = current.length > 60 || current.includes('\n')
          return (
            <Row key={key} label={key} stack={multiline}>
              {multiline ? (
                <textarea
                  value={current}
                  onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                  rows={Math.min(8, Math.max(3, current.split('\n').length + 1))}
                  style={{ ...controlStyle, fontFamily: fontMono, resize: 'vertical' }}
                />
              ) : (
                <input
                  type="text"
                  value={current}
                  onChange={(e) => onChange({ ...value, [key]: e.target.value })}
                  style={controlStyle}
                />
              )}
            </Row>
          )
        }

        // Skip arrays/objects/null — no good universal editor.
        return null
      })}
    </div>
  )
}

function Row({
  label,
  children,
  stack = false,
}: {
  label: string
  children: React.ReactNode
  stack?: boolean
}) {
  return (
    <label
      style={{
        display: 'flex',
        flexDirection: stack ? 'column' : 'row',
        alignItems: stack ? 'stretch' : 'center',
        gap: stack ? 4 : 8,
        fontSize: size.md,
        color: 'var(--tl-color-text)',
      }}
    >
      <span style={{ minWidth: stack ? 0 : 70, color: 'var(--tl-color-text-3)', fontSize: size.sm }}>
        {label}
      </span>
      {children}
    </label>
  )
}

const controlStyle: CSSProperties = {
  flex: 1,
  padding: '4px 6px',
  background: 'var(--tl-color-background)',
  border: '1px solid var(--tl-color-divider)',
  color: 'var(--tl-color-text)',
  borderRadius: 4,
  fontSize: size.md,
  boxSizing: 'border-box',
  minWidth: 0,
}

// zod v4 schemas wrap inner types via `.default()`, `.optional()`,
// `.nullable()`. We unwrap to find the underlying type for enum
// detection and number-range extraction. Best-effort with a
// generous `unknown` cast — the property isn't part of zod's public
// type surface but the runtime shape is stable across v4 patches.
//
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap(schema: any): any {
  let s = schema
  for (let i = 0; i < 8 && s; i++) {
    const def = s?._def ?? s?.def
    if (!def) return s
    if (def.type === 'default' || def.type === 'optional' || def.type === 'nullable' || def.type === 'readonly') {
      s = def.innerType ?? def.schema ?? s
      continue
    }
    return s
  }
  return s
}

function sniffEnumValues(schema: unknown): string[] | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = unwrap(schema as any)
  const def = inner?._def ?? inner?.def
  if (def?.type !== 'enum') return null
  const entries = def.entries
  if (!entries || typeof entries !== 'object') return null
  return Object.values(entries as Record<string, unknown>)
    .filter((v): v is string => typeof v === 'string')
}

function sniffNumberRange(schema: unknown): { min?: number; max?: number } | null {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inner = unwrap(schema as any)
  const def = inner?._def ?? inner?.def
  if (def?.type !== 'number') return null
  const checks = (def.checks as Array<Record<string, unknown>> | undefined) ?? []
  let min: number | undefined
  let max: number | undefined
  for (const c of checks) {
    const cdef = (c as { _zod?: { def?: { check?: string; value?: number } } })._zod?.def
    if (cdef?.check === 'greater_than' || cdef?.check === 'min_length') {
      if (typeof cdef.value === 'number') min = cdef.value
    } else if (cdef?.check === 'less_than' || cdef?.check === 'max_length') {
      if (typeof cdef.value === 'number') max = cdef.value
    }
  }
  return { min, max }
}
