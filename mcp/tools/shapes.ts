import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CanvasBridge } from '../ws-server.js'
import { makeId } from '../protocol.js'

export function registerShapeTools(server: McpServer, bridge: CanvasBridge) {
  server.registerTool('createShape', {
    description: 'Create a shape on the canvas. Types: geo, text, draw, arrow, vade-code, vade-data, and all tldraw built-ins.',
    inputSchema: {
      type: z.string().describe('Shape type (e.g. geo, text, vade-code, vade-data)'),
      x: z.number().optional().describe('X position (default: center of viewport)'),
      y: z.number().optional().describe('Y position (default: center of viewport)'),
      props: z.record(z.string(), z.unknown()).optional().describe('Shape-specific properties'),
    },
  }, async ({ type, x, y, props }) => {
    const result = await bridge.send({
      type: 'createShapes',
      id: makeId(),
      shapes: [{ type, x, y, props }],
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  })

  server.registerTool('updateShape', {
    description: 'Update an existing shape by ID. Only specify the properties you want to change.',
    inputSchema: {
      id: z.string().describe('Shape ID (e.g. shape:abc123)'),
      type: z.string().describe('Shape type (must match existing shape)'),
      x: z.number().optional(),
      y: z.number().optional(),
      props: z.record(z.string(), z.unknown()).optional(),
    },
  }, async ({ id, type, x, y, props }) => {
    const result = await bridge.send({
      type: 'updateShapes',
      id: makeId(),
      shapes: [{ id, type, x, y, props }],
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  })

  server.registerTool('deleteShapes', {
    description: 'Delete shapes from the canvas by their IDs.',
    inputSchema: {
      ids: z.array(z.string()).describe('Array of shape IDs to delete'),
    },
  }, async ({ ids }) => {
    const result = await bridge.send({
      type: 'deleteShapes',
      id: makeId(),
      ids,
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  })

  server.registerTool('queryShapes', {
    description: 'List all shapes on the current canvas page, optionally filtered by type.',
    inputSchema: {
      type: z.string().optional().describe('Filter by shape type (e.g. vade-code, geo)'),
    },
  }, async ({ type }) => {
    const result = await bridge.send({
      type: 'queryShapes',
      id: makeId(),
      filter: type ? { type } : undefined,
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  })

  server.registerTool('getCanvasState', {
    description: 'Get a summary of the current canvas state: shape count, types, page info.',
  }, async () => {
    const result = await bridge.send({
      type: 'getSnapshot',
      id: makeId(),
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  })
}
