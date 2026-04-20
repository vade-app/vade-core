import type { Editor } from '@tldraw/editor'
import type { ServerMessage, ClientMessage } from './protocol'

const WS_URL =
  (import.meta.env.VITE_BRIDGE_URL as string | undefined) ??
  `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.hostname}:7600`

const CLIENT_SUBPROTOCOL = 'vade-canvas'
const TOKEN_SUBPROTOCOL_PREFIX = 'vade-auth.'

const isLocalHostname = (hostname: string): boolean => {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true
  if (hostname.endsWith('.local')) return true
  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname)) return true
  return false
}

const shouldAttemptBridge = (): boolean => {
  if (import.meta.env.VITE_BRIDGE_URL) return true
  if (import.meta.env.DEV) return true
  return isLocalHostname(window.location.hostname)
}

export type BridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'no-bridge' | 'unauthorized'
type StatusListener = (status: BridgeStatus) => void

export class VadeBridge {
  private ws: WebSocket | null = null
  private editor: Editor | null = null
  private status: BridgeStatus = 'disconnected'
  private listeners: StatusListener[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000
  private token: string | null

  constructor(token: string | null = null) {
    this.token = token && token.trim() ? token.trim() : null
  }

  connect(editor: Editor) {
    this.editor = editor
    if (!shouldAttemptBridge()) {
      this.setStatus('no-bridge')
      return
    }
    this.tryConnect()
  }

  onStatusChange(listener: StatusListener): () => void {
    this.listeners.push(listener)
    listener(this.status)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  private setStatus(s: BridgeStatus) {
    this.status = s
    for (const l of this.listeners) l(s)
  }

  private tryConnect() {
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
    }

    this.setStatus('connecting')
    const protocols = this.token
      ? [CLIENT_SUBPROTOCOL, `${TOKEN_SUBPROTOCOL_PREFIX}${this.token}`]
      : undefined
    const ws = protocols ? new WebSocket(WS_URL, protocols) : new WebSocket(WS_URL)
    let didOpen = false

    ws.onopen = () => {
      didOpen = true
      this.ws = ws
      this.reconnectDelay = 1000
      this.setStatus('connected')

      const pageId = this.editor?.getCurrentPageId() ?? 'unknown'
      this.send({ type: 'connected', pageId })
    }

    ws.onmessage = (event) => {
      try {
        const msg: ServerMessage = JSON.parse(event.data as string)
        this.handleMessage(msg)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onclose = (event) => {
      this.ws = null
      // Happy path: the server accepts the WS upgrade and then closes
      // with 4401 on auth failure. Fallback: if the handshake itself
      // never completed (didOpen === false) but we had a token and
      // the browser is online, treat code 1006 as auth failure too —
      // a dropped/proxied upgrade can leave us without the 4401 frame.
      const failedHandshakeWithToken =
        !!this.token && !didOpen && event.code === 1006 && navigator.onLine
      if (event.code === 4401 || event.code === 1008 || failedHandshakeWithToken) {
        this.setStatus('unauthorized')
        return
      }
      this.setStatus('disconnected')
      this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      this.tryConnect()
    }, this.reconnectDelay)
    this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 10_000)
  }

  private send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg))
    }
  }

  private reply(id: string, success: boolean, data?: unknown, error?: string) {
    this.send({ type: 'result', id, success, data, error })
  }

  private handleMessage(msg: ServerMessage) {
    const editor = this.editor
    if (!editor) {
      this.reply(msg.id, false, undefined, 'Editor not ready')
      return
    }

    try {
      switch (msg.type) {
        case 'createShapes': {
          const beforeIds = new Set(editor.getCurrentPageShapes().map(s => s.id))
          editor.run(() => {
            for (const s of msg.shapes) {
              const partial: Record<string, unknown> = { type: s.type }
              if (s.x !== undefined) partial['x'] = s.x
              if (s.y !== undefined) partial['y'] = s.y
              if (s.rotation !== undefined) partial['rotation'] = s.rotation
              if (s.props) partial['props'] = s.props
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.createShape(partial as any)
            }
          })
          for (const s of msg.shapes) {
            const partial: Record<string, unknown> = { type: s.type }
            if (s.x !== undefined) partial['x'] = s.x
            if (s.y !== undefined) partial['y'] = s.y
            if (s.rotation !== undefined) partial['rotation'] = s.rotation
            if (s.props) partial['props'] = s.props
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.createShape(partial as any)
          }
          const created = editor.getCurrentPageShapes()
            .filter(s => !beforeIds.has(s.id))
            .map(s => s.id)
          this.reply(msg.id, true, created)
          break
        }

        case 'updateShapes': {
          editor.run(() => {
            for (const s of msg.shapes) {
              const update: Record<string, unknown> = { id: s.id, type: s.type }
              if (s.x !== undefined) update['x'] = s.x
              if (s.y !== undefined) update['y'] = s.y
              if (s.props) update['props'] = s.props
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              editor.updateShape(update as any)
            }
          })
          for (const s of msg.shapes) {
            const update: Record<string, unknown> = { id: s.id, type: s.type }
            if (s.x !== undefined) update['x'] = s.x
            if (s.y !== undefined) update['y'] = s.y
            if (s.props) update['props'] = s.props
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            editor.updateShape(update as any)
          }
          this.reply(msg.id, true)
          break
        }

        case 'deleteShapes': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.run(() => editor.deleteShapes(msg.ids as any))
          editor.deleteShapes(msg.ids as any)
          this.reply(msg.id, true)
          break
        }

        case 'createBindings': {
          const beforeIds = new Set(
            editor.store.allRecords()
              .filter(r => r.typeName === 'binding')
              .map(r => r.id)
          )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.createBindings(msg.bindings as any)
          const created = editor.store.allRecords()
            .filter(r => r.typeName === 'binding' && !beforeIds.has(r.id))
            .map(r => r.id)
          this.reply(msg.id, true, created)
          break
        }

        case 'queryShapes': {
          let shapes = editor.getCurrentPageShapes()
          if (msg.filter?.type) {
            shapes = shapes.filter(s => s.type === msg.filter!.type)
          }
          const summary = shapes.map(s => ({
            id: s.id,
            type: s.type,
            x: s.x,
            y: s.y,
            props: s.props,
          }))
          this.reply(msg.id, true, summary)
          break
        }

        case 'getSnapshot': {
          const store = editor.store
          const snapshot = store.getStoreSnapshot()
          const shapes = editor.getCurrentPageShapes()
          const summary = {
            shapeCount: shapes.length,
            types: [...new Set(shapes.map(s => s.type))],
            pageId: editor.getCurrentPageId(),
            snapshot,
          }
          this.reply(msg.id, true, summary)
          break
        }

        case 'loadSnapshot': {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          editor.store.loadStoreSnapshot(msg.snapshot as any)
          this.reply(msg.id, true)
          break
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      this.reply(msg.id, false, undefined, message)
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
    }
    this.setStatus('disconnected')
  }
}
