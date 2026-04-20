import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import { CanvasBridge, DEFAULT_WS_PORT } from './ws-server.js'
import { registerShapeTools } from './tools/shapes.js'
import { registerCanvasTools } from './tools/canvas.js'
import { registerRuntimeTools } from './tools/runtime.js'

function buildServer(bridge: CanvasBridge): McpServer {
  const server = new McpServer({ name: 'vade-canvas', version: '0.1.0' })
  registerShapeTools(server, bridge)
  registerCanvasTools(server, bridge)
  registerRuntimeTools(server, bridge)
  return server
}

async function runStdio() {
  const bridge = new CanvasBridge({ mode: 'standalone', port: DEFAULT_WS_PORT, host: '0.0.0.0' })
  const server = buildServer(bridge)
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[vade-canvas] MCP server running on stdio, WebSocket bridge on :${DEFAULT_WS_PORT}`)
}

async function runSse() {
  const port = Number(process.env['VADE_MCP_HTTP_PORT'] ?? 8080)
  const messagesPath = '/messages'
  const ssePath = '/sse'
  const canvasPath = '/canvas'

  // On Fly.io, sessions live in per-machine memory. Advertise a
  // machine-scoped endpoint so the client's POST can be replayed to
  // the instance holding the SSE connection via `fly-replay`.
  const machineId = process.env['FLY_MACHINE_ID'] ?? ''
  const scopedMessagesPath = machineId ? `${messagesPath}/${machineId}` : messagesPath

  type Session = { server: McpServer; transport: SSEServerTransport }
  const sessions = new Map<string, Session>()

  const setCors = (res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Mcp-Session-Id')
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id')
  }

  const httpServer = createServer()
  const bridge = new CanvasBridge({ mode: 'attached', server: httpServer, path: canvasPath })

  httpServer.on('request', async (req: IncomingMessage, res: ServerResponse) => {
    setCors(res)

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (req.method === 'GET' && url.pathname === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('ok')
      return
    }

    if (req.method === 'GET' && url.pathname === ssePath) {
      const transport = new SSEServerTransport(scopedMessagesPath, res)
      const server = buildServer(bridge)

      const sessionId = transport.sessionId
      sessions.set(sessionId, { server, transport })
      console.error(
        `[vade-canvas] SSE session open ${sessionId} on ${machineId || 'local'} (total=${sessions.size})`,
      )

      // Fly-proxy closes idle HTTP connections at 60s. Send an SSE
      // comment frame periodically so the stream has traffic and the
      // edge keeps it alive.
      const heartbeat = setInterval(() => {
        if (res.writableEnded) return
        res.write(':\n\n')
      }, 25_000)

      const cleanup = () => {
        if (!sessions.has(sessionId)) return
        sessions.delete(sessionId)
        clearInterval(heartbeat)
        console.error(`[vade-canvas] SSE session close ${sessionId} (total=${sessions.size})`)
        void server.close().catch(() => {})
      }
      transport.onclose = cleanup
      res.on('close', cleanup)

      try {
        await server.connect(transport)
      } catch (err) {
        console.error('[vade-canvas] Failed to start SSE session:', err)
        cleanup()
      }
      return
    }

    if (req.method === 'POST' && url.pathname.startsWith(messagesPath)) {
      // Path shape: `/messages` or `/messages/<machineId>`. If the
      // client's target machine isn't us, hand off to Fly's proxy —
      // it will replay the request (body included) to that instance.
      const tail = url.pathname.slice(messagesPath.length)
      const targetMachineId = tail.startsWith('/') ? tail.slice(1) : ''
      if (targetMachineId && targetMachineId !== machineId) {
        res.setHeader('fly-replay', `instance=${targetMachineId}`)
        res.writeHead(204)
        res.end()
        return
      }

      const sid = url.searchParams.get('sessionId')
      const session = sid ? sessions.get(sid) : undefined
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Unknown sessionId')
        return
      }
      try {
        await session.transport.handlePostMessage(req, res)
      } catch (err) {
        console.error('[vade-canvas] handlePostMessage error:', err)
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'text/plain' })
          res.end('Internal error')
        }
      }
      return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('Not found')
  })

  await new Promise<void>((resolve) => {
    httpServer.listen(port, '0.0.0.0', () => resolve())
  })
  console.error(`[vade-canvas] SSE + WSS on :${port} (sse=${ssePath}, canvas=${canvasPath})`)

  const shutdown = async () => {
    console.error('[vade-canvas] Shutting down…')
    for (const [id, s] of sessions) {
      sessions.delete(id)
      await s.server.close().catch(() => {})
    }
    await bridge.close()
    httpServer.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

const mode = process.env['VADE_MCP_TRANSPORT'] ?? 'stdio'
if (mode === 'stdio') {
  await runStdio()
} else if (mode === 'sse') {
  await runSse()
} else {
  console.error(`[vade-canvas] Unknown VADE_MCP_TRANSPORT=${mode}; expected 'stdio' or 'sse'`)
  process.exit(1)
}
