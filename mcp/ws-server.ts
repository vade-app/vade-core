import type { IncomingMessage, Server as HttpServer } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, WebSocket } from 'ws'
import type { ServerMessage, ClientMessage } from './protocol.js'

export const DEFAULT_WS_PORT = 7600

export type CanvasBridgeOptions =
  | { mode: 'standalone'; port?: number; host?: string }
  | { mode: 'attached'; server: HttpServer; path: string }

type PendingRequest = {
  resolve: (data: unknown) => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class CanvasBridge {
  private wss: WebSocketServer
  private mode: CanvasBridgeOptions['mode']
  private canvas: WebSocket | null = null
  private pending = new Map<string, PendingRequest>()
  private upgradeHandler?: (req: IncomingMessage, socket: Duplex, head: Buffer) => void
  private attachedServer?: HttpServer

  constructor(options: CanvasBridgeOptions = { mode: 'standalone' }) {
    this.mode = options.mode

    if (options.mode === 'standalone') {
      const port = options.port ?? DEFAULT_WS_PORT
      const host = options.host ?? '0.0.0.0'
      this.wss = new WebSocketServer({ port, host })
      console.error(`[bridge] WebSocket server listening on ${host}:${port}`)
    } else {
      this.wss = new WebSocketServer({ noServer: true })
      this.attachedServer = options.server
      const path = options.path
      this.upgradeHandler = (req, socket, head) => {
        if (!req.url) {
          socket.destroy()
          return
        }
        const url = new URL(req.url, 'http://localhost')
        if (url.pathname !== path) return
        this.wss.handleUpgrade(req, socket, head, (ws) => {
          this.wss.emit('connection', ws, req)
        })
      }
      options.server.on('upgrade', this.upgradeHandler)
      console.error(`[bridge] WebSocket upgrade handler attached on path ${path}`)
    }

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
    if (this.mode === 'attached' && this.attachedServer && this.upgradeHandler) {
      this.attachedServer.off('upgrade', this.upgradeHandler)
    }
    this.wss.close()
  }
}
