import { useEffect, useRef, useState } from 'react'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { customShapeUtils } from './shapes'
import { VadeBridge, type BridgeStatus } from './bridge/ws-client'

const bridge = new VadeBridge()

function ConnectionIndicator() {
  const [status, setStatus] = useState<BridgeStatus>('disconnected')

  useEffect(() => {
    return bridge.onStatusChange(setStatus)
  }, [])

  const colors: Record<BridgeStatus, string> = {
    connected: '#a6e3a1',
    connecting: '#f9e2af',
    disconnected: '#f38ba8',
    'no-bridge': '#6c7086',
  }

  const labels: Record<BridgeStatus, string> = {
    connected: 'MCP',
    connecting: 'connecting...',
    disconnected: 'offline',
    'no-bridge': 'no bridge',
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 12,
        background: 'rgba(30, 30, 46, 0.85)',
        color: colors[status],
        fontSize: 11,
        fontFamily: 'ui-monospace, monospace',
        pointerEvents: 'none',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: colors[status],
        }}
      />
      {labels[status]}
    </div>
  )
}

export default function App() {
  const bridgeRef = useRef(bridge)

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        persistenceKey="vade-main"
        shapeUtils={customShapeUtils}
        onMount={(editor) => {
          bridgeRef.current.connect(editor)
          if (editor.getCurrentPageShapes().length === 0) {
            editor.createShape({
              type: 'geo',
              x: -100,
              y: -100,
              props: { geo: 'triangle', w: 200, h: 200 },
            })
          }
        }}
      />
      <ConnectionIndicator />
    </div>
  )
}
