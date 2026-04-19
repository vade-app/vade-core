import { WebSocketServer, WebSocket } from 'ws'
import type { ServerMessage, ClientMessage } from './protocol.js'

const WS_PORT = 7600

type PendingRequest = {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class CanvasBridge {
  private wss: WebSocketServer
  private canvas: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()

  constructor() {
    this.wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' })
    this.wss.on('connection', (ws) => {
      this.canvas = ws
      console.error(`[bridge] Canvas connected`)

      ws.on('message', (raw) => {
        try {
          const msg: ClientMessage = JSON.parse(raw.toString())
          this.handleMessage(msg)
        } catch (e) {
          console.error('[bridge] Bad message:', e)
        }
      })

      ws.on('close', () => {
        console.error('[bridge] Canvas disconnected')
        if (this.canvas === ws) this.canvas = null
        for (const [id, req] of this.pending) {
          req.reject(new Error('Canvas disconnected'))
          clearTimeout(req.timer)
          this.pending.delete(id)
        }
      })
    })

    console.error(`[bridge] WebSocket server listening on :${WS_PORT}`)
  }

  get isConnected(): boolean {
    return this.canvas !== null && this.canvas.readyState === WebSocket.OPEN
  }

  send(msg: ServerMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected) {
        reject(new Error('Canvas not connected. Is the app running?'))
        return
      }

      const timer = setTimeout(() => {
        this.pending.delete(msg.id)
        reject(new Error('Canvas did not respond within 10 seconds'))
      }, 10_000)

      this.pending.set(msg.id, { resolve, reject, timer })
      this.canvas!.send(JSON.stringify(msg))
    })
  }

  private handleMessage(msg: ClientMessage) {
    if (msg.type === 'connected') {
      console.error(`[bridge] Canvas page: ${msg.pageId}`)
      return
    }

    if (msg.type === 'result') {
      const req = this.pending.get(msg.id)
      if (!req) return
      clearTimeout(req.timer)
      this.pending.delete(msg.id)

      if (msg.success) {
        req.resolve(msg.data)
      } else {
        req.reject(new Error(msg.error ?? 'Unknown canvas error'))
      }
    }
  }

  async close() {
    this.wss.close()
  }
}
