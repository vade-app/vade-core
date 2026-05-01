import { useEffect, useMemo, useRef, useState } from 'react'
import { Tldraw, type TLUiComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { customShapeUtils } from './shapes'
import { VadeBridge, type BridgeStatus } from './bridge/ws-client'
import { TopRightSlot } from './components/TopRightSlot'
import { createVadeAssetStore } from './assets/vade-asset-store'

// Inject TopRightSlot into tldraw's top-right SharePanel slot so the
// chips render inside tldraw's chrome and can't collide with Main Menu
// popovers or the style panel. TopRightSlot composes CanvasSwitcher
// + LineageButton.
const tldrawComponents: TLUiComponents = {
  SharePanel: TopRightSlot,
}

const TOKEN_STORAGE_KEY = 'vade-auth-token'

const requiresAuth = !import.meta.env.DEV

function readStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(TOKEN_STORAGE_KEY)
    return v && v.trim() ? v.trim() : null
  } catch {
    return null
  }
}

const COMMIT_SHA = import.meta.env.VITE_COMMIT_SHA

function ConnectionIndicator({ bridge, onClearToken }: { bridge: VadeBridge; onClearToken: () => void }) {
  const [status, setStatus] = useState<BridgeStatus>('disconnected')

  useEffect(() => {
    return bridge.onStatusChange(setStatus)
  }, [bridge])

  const colors: Record<BridgeStatus, string> = {
    connected: '#a6e3a1',
    connecting: '#f9e2af',
    disconnected: '#f38ba8',
    'no-bridge': '#6c7086',
    unauthorized: '#f38ba8',
  }

  const labels: Record<BridgeStatus, string> = {
    connected: 'MCP',
    connecting: 'connecting...',
    disconnected: 'offline',
    'no-bridge': 'no bridge',
    unauthorized: 'bad token',
  }

  const interactive = status === 'unauthorized'

  return (
    <div
      onClick={interactive ? onClearToken : undefined}
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
        pointerEvents: interactive ? 'auto' : 'none',
        cursor: interactive ? 'pointer' : 'default',
        backdropFilter: 'blur(8px)',
      }}
      title={interactive ? 'Click to re-enter token' : undefined}
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
      {COMMIT_SHA && COMMIT_SHA !== 'dev' && (
        <span style={{ color: '#6c7086' }}>· {COMMIT_SHA}</span>
      )}
    </div>
  )
}

function TokenGate({ onSubmit }: { onSubmit: (token: string) => void }) {
  const [value, setValue] = useState('')
  const trimmed = value.trim()

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#1e1e2e',
        color: '#cdd6f4',
        fontFamily: 'ui-monospace, monospace',
        padding: 24,
      }}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (trimmed) onSubmit(trimmed)
        }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: '100%',
          maxWidth: 420,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600 }}>VADE</div>
        <label htmlFor="vade-token" style={{ fontSize: 12, color: '#a6adc8' }}>
          Paste your operator token to continue
        </label>
        <input
          id="vade-token"
          type="password"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: '1px solid #45475a',
            background: '#181825',
            color: '#cdd6f4',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 13,
          }}
        />
        <button
          type="submit"
          disabled={!trimmed}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: trimmed ? '#89b4fa' : '#45475a',
            color: '#11111b',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 600,
            cursor: trimmed ? 'pointer' : 'not-allowed',
          }}
        >
          Connect
        </button>
      </form>
    </div>
  )
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => (requiresAuth ? readStoredToken() : null))

  const bridge = useMemo(() => new VadeBridge(token), [token])
  const bridgeRef = useRef(bridge)
  bridgeRef.current = bridge

  // Asset store is per-mount: image bytes go through /library/assets and
  // are addressed by sha256 in the snapshot, so canvases round-trip across
  // devices instead of dangling at the source device's local IndexedDB.
  const assetStore = useMemo(() => createVadeAssetStore(), [])

  if (requiresAuth && !token) {
    return (
      <TokenGate
        onSubmit={(t) => {
          try {
            window.localStorage.setItem(TOKEN_STORAGE_KEY, t)
          } catch {
            // ignore — session-only use still works
          }
          setToken(t)
        }}
      />
    )
  }

  const clearToken = () => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // ignore
    }
    bridge.disconnect()
    setToken(null)
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        persistenceKey="vade-main"
        shapeUtils={customShapeUtils}
        components={tldrawComponents}
        assets={assetStore}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
        onMount={(editor) => {
          bridgeRef.current.connect(editor)
        }}
      />
      <ConnectionIndicator bridge={bridge} onClearToken={clearToken} />
    </div>
  )
}
