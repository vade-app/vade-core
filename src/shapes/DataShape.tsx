import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
} from '@tldraw/editor'

type DataShapeProps = {
  w: number
  h: number
  data: string
  label: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DataShape = any

export type { DataShape }

function renderValue(value: unknown, depth: number): JSX.Element {
  if (value === null || value === undefined) {
    return <span style={{ color: '#7f849c' }}>{String(value)}</span>
  }
  if (typeof value === 'number') {
    return <span style={{ color: '#fab387' }}>{value}</span>
  }
  if (typeof value === 'boolean') {
    return <span style={{ color: '#f38ba8' }}>{String(value)}</span>
  }
  if (typeof value === 'string') {
    return <span style={{ color: '#a6e3a1' }}>"{value}"</span>
  }
  if (Array.isArray(value)) {
    if (depth > 2) return <span>[...]</span>
    return (
      <span>
        {'['}
        {value.map((item, i) => (
          <span key={i}>
            {i > 0 && ', '}
            {renderValue(item, depth + 1)}
          </span>
        ))}
        {']'}
      </span>
    )
  }
  if (typeof value === 'object') {
    if (depth > 2) return <span>{'{...}'}</span>
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <div style={{ paddingLeft: depth > 0 ? 12 : 0 }}>
        {entries.map(([k, v]) => (
          <div key={k} style={{ lineHeight: 1.6 }}>
            <span style={{ color: '#89b4fa' }}>{k}</span>
            <span style={{ color: '#7f849c' }}>: </span>
            {renderValue(v, depth + 1)}
          </div>
        ))}
      </div>
    )
  }
  return <span>{String(value)}</span>
}

export class DataShapeUtil extends BaseBoxShapeUtil<DataShape> {
  static override type = 'vade-data' as const
  static override props = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    data: T.string,
    label: T.string,
  }

  getDefaultProps(): DataShapeProps {
    return {
      w: 280,
      h: 180,
      data: '{}',
      label: 'Data',
    }
  }

  component(shape: { props: DataShapeProps }) {
    const { data, label } = shape.props

    let parsed: unknown
    try {
      parsed = JSON.parse(data)
    } catch {
      parsed = data
    }

    return (
      <HTMLContainer
        style={{
          display: 'flex',
          flexDirection: 'column',
          background: '#1e1e2e',
          color: '#cdd6f4',
          borderRadius: 8,
          overflow: 'hidden',
          fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
          fontSize: 13,
          pointerEvents: 'all',
        }}
      >
        <div
          style={{
            padding: '6px 10px',
            background: '#181825',
            color: '#89b4fa',
            fontSize: 12,
            fontWeight: 600,
            borderBottom: '1px solid #313244',
            flexShrink: 0,
          }}
        >
          {label}
        </div>
        <div
          style={{
            padding: 10,
            flex: 1,
            overflow: 'auto',
          }}
        >
          {renderValue(parsed, 0)}
        </div>
      </HTMLContainer>
    )
  }

  indicator(shape: { props: { w: number; h: number } }) {
    return (
      <rect
        width={shape.props.w}
        height={shape.props.h}
        rx={8}
        ry={8}
      />
    )
  }
}
