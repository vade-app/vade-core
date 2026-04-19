import type { Editor } from '@tldraw/editor'
import type { ServerMessage, ClientMessage } from './protocol'

const WS_URL = `ws://${window.location.hostname}:7600`

export type BridgeStatus = 'disconnected' | 'connecting' | 'connected'
type StatusListener = (status: BridgeStatus) => void

export class VadeBridge {
  private ws: WebSocket | null = null
  private editor: Editor | null = null
  private status: BridgeStatus = 'disconnected'
  private listeners: StatusListener[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private reconnectDelay = 1000

  connect(editor: Editor) {
    this.editor = editor
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
    const ws = new WebSocket(WS_URL)

    ws.onopen = () => {
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

    ws.onclose = () => {
      this.ws = null
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
          editor.deleteShapes(msg.ids as any)
          this.reply(msg.id, true)
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
