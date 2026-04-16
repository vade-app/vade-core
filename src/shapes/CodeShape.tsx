import {
  BaseBoxShapeUtil,
  HTMLContainer,
  T,
  type TLBaseBoxShape,
} from '@tldraw/editor'

export type CodeShape = TLBaseBoxShape & {
  type: 'vade-code'
  props: TLBaseBoxShape['props'] & {
    code: string
    language: string
    output: string
  }
}

export class CodeShapeUtil extends BaseBoxShapeUtil<CodeShape> {
  static override type = 'vade-code' as const
  static override props = {
    w: T.nonZeroNumber,
    h: T.nonZeroNumber,
    code: T.string,
    language: T.string,
    output: T.string,
  }

  getDefaultProps(): CodeShape['props'] {
    return {
      w: 320,
      h: 200,
      code: '',
      language: 'typescript',
      output: '',
    }
  }

  component(shape: CodeShape) {
    const { code, language, output } = shape.props

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
            color: '#7f849c',
            fontSize: 11,
            borderBottom: '1px solid #313244',
            flexShrink: 0,
          }}
        >
          {language}
        </div>
        <pre
          style={{
            margin: 0,
            padding: 10,
            flex: 1,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <code>{code}</code>
        </pre>
        {output && (
          <div
            style={{
              padding: '6px 10px',
              background: '#11111b',
              borderTop: '1px solid #313244',
              color: '#a6e3a1',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              maxHeight: '30%',
              overflow: 'auto',
              flexShrink: 0,
            }}
          >
            {output}
          </div>
        )}
      </HTMLContainer>
    )
  }

  indicator(shape: CodeShape) {
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
