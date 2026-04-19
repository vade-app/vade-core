import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CanvasBridge } from './ws-server.js'
import { registerShapeTools } from './tools/shapes.js'
import { registerCanvasTools } from './tools/canvas.js'
import { registerRuntimeTools } from './tools/runtime.js'

const server = new McpServer({
  name: 'vade-canvas',
  version: '0.1.0',
})

const bridge = new CanvasBridge()

registerShapeTools(server, bridge)
registerCanvasTools(server, bridge)
registerRuntimeTools(server, bridge)

const transport = new StdioServerTransport()
await server.connect(transport)

console.error('[vade-canvas] MCP server running on stdio, WebSocket bridge on :7600')
