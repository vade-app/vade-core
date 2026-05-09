import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type TLUiComponents } from 'tldraw'
import 'tldraw/tldraw.css'
import { VadeBridge, type BridgeStatus } from './bridge/ws-client'
import { MainMenu } from './components/MainMenu'
import { MenuPanel } from './components/MenuPanel'
import { createVadeAssetStore } from './assets/vade-asset-store'
import { AppShell } from './shell/AppShell'
import { AuthContext } from './shell/AuthContext'
import { fontMono, size } from './shell/typography'

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

// Status dot rendered into tldraw's SharePanel slot (top-right). Was
// previously a fixed-position pill at bottom-right that overlapped
// tldraw's StylePanel (canvas-ui skill landmine 6). Compresses to a
// 10px dot; the BridgeStatus label and commit SHA move to the title
// hover. Click-to-reauth is preserved when status is 'unauthorized'.
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
    connected: 'MCP connected',
    connecting: 'MCP connecting…',
    disconnected: 'MCP offline',
    'no-bridge': 'MCP: no bridge',
    unauthorized: 'MCP: bad token (click to re-enter)',
  }

  const interactive = status === 'unauthorized'
  const titleParts = [labels[status]]
  if (COMMIT_SHA && COMMIT_SHA !== 'dev') titleParts.push(COMMIT_SHA)

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        pointerEvents: 'all',
      }}
    >
      <button
        type="button"
        onClick={interactive ? onClearToken : undefined}
        aria-label={labels[status]}
        title={titleParts.join(' · ')}
        disabled={!interactive}
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: colors[status],
          border: 'none',
          padding: 0,
          cursor: interactive ? 'pointer' : 'default',
        }}
      />
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
        fontFamily: fontMono,
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
        <div style={{ fontSize: size.xl, fontWeight: 600 }}>VADE</div>
        <label htmlFor="vade-token" style={{ fontSize: size.md, color: '#a6adc8' }}>
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
            fontFamily: fontMono,
            fontSize: size.lg,
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
            fontSize: size.lg,
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

  const clearToken = useCallback(() => {
    try {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    } catch {
      // ignore
    }
    bridge.disconnect()
    setToken(null)
  }, [bridge])

  // Custom MenuPanel hosts tldraw's default top-left menu group plus
  // the Catalog and Canvas toggles (vade-core#182). MainMenu adds a
  // Sign-out item to tldraw's default menu (#186). SharePanel hosts
  // the connection-status dot in the top-right slot — moved off the
  // bottom-right floating-pill spot that overlapped tldraw's
  // StylePanel.
  const tldrawComponents = useMemo<TLUiComponents>(
    () => ({
      MenuPanel,
      MainMenu,
      SharePanel: () => <ConnectionIndicator bridge={bridge} onClearToken={clearToken} />,
    }),
    [bridge, clearToken],
  )

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

  return (
    <AuthContext.Provider value={{ signOut: clearToken }}>
      <AppShell
        assetStore={assetStore}
        licenseKey={import.meta.env.VITE_TLDRAW_LICENSE_KEY}
        components={tldrawComponents}
        onMount={(editor) => {
          bridgeRef.current.connect(editor)
        }}
      />
    </AuthContext.Provider>
  )
}
