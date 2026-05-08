import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CanvasBridge } from '../ws-server.js'
import { makeId } from '../protocol.js'
import { getStore } from '../library.js'

export function registerCanvasTools(server: McpServer, bridge: CanvasBridge) {
  server.registerTool('saveCanvas', {
    description: 'Save the current canvas state to the library with a name, tags, and description.',
    inputSchema: {
      name: z.string().describe('Name for this canvas'),
      tags: z.array(z.string()).optional().describe('Tags for search/categorization'),
      description: z.string().optional().describe('What this canvas contains'),
    },
  }, async ({ name, tags, description }) => {
    const summary = await bridge.send({ type: 'getSnapshot', id: makeId() }) as { snapshot: unknown }
    const store = await getStore()
    const meta = await store.saveCanvas(name, summary.snapshot, tags ?? [], description ?? '')
    return { content: [{ type: 'text' as const, text: `Saved canvas "${name}"\n${JSON.stringify(meta, null, 2)}` }] }
  })

  server.registerTool('loadCanvas', {
    description: 'Load a previously saved canvas from the library by name.',
    inputSchema: {
      name: z.string().describe('Name of the canvas to load'),
    },
  }, async ({ name }) => {
    const store = await getStore()
    const result = await store.loadCanvas(name)
    if (!result) {
      return { content: [{ type: 'text' as const, text: `Canvas "${name}" not found in library.` }] }
    }
    await bridge.send({ type: 'loadSnapshot', id: makeId(), snapshot: result.snapshot })
    return { content: [{ type: 'text' as const, text: `Loaded canvas "${name}"\n${JSON.stringify(result.meta, null, 2)}` }] }
  })

  server.registerTool('listCanvases', {
    description: 'List all saved canvases in the library.',
  }, async () => {
    const store = await getStore()
    const canvases = await store.listCanvases()
    if (canvases.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No canvases saved yet.' }] }
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(canvases, null, 2) }] }
  })

  server.registerTool('listEntities', {
    description: 'List all saved entities (reusable shape groups) in the library.',
  }, async () => {
    const store = await getStore()
    const entities = await store.listEntities()
    if (entities.length === 0) {
      return { content: [{ type: 'text' as const, text: 'No entities saved yet.' }] }
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(entities, null, 2) }] }
  })

  server.registerTool('saveSnapshot', {
    description: 'Capture the current head of a saved canvas as a named snapshot in its history.',
    inputSchema: {
      canvasName: z.string().describe('Name of the canvas to snapshot'),
      label: z.string().optional().describe('Optional label appended to the snapshot id'),
    },
  }, async ({ canvasName, label }) => {
    const store = await getStore()
    const meta = await store.saveSnapshot(canvasName, label)
    return { content: [{ type: 'text' as const, text: `Saved snapshot of "${canvasName}"\n${JSON.stringify(meta, null, 2)}` }] }
  })

  server.registerTool('listSnapshots', {
    description: 'List the named snapshots stored in a canvas\'s history, newest first.',
    inputSchema: {
      canvasName: z.string().describe('Name of the canvas'),
    },
  }, async ({ canvasName }) => {
    const store = await getStore()
    const snapshots = await store.listSnapshots(canvasName)
    if (snapshots.length === 0) {
      return { content: [{ type: 'text' as const, text: `No snapshots for canvas "${canvasName}".` }] }
    }
    return { content: [{ type: 'text' as const, text: JSON.stringify(snapshots, null, 2) }] }
  })

  server.registerTool('restoreSnapshot', {
    description: 'Restore a canvas to a previously named snapshot. Replaces the head; the live canvas re-loads.',
    inputSchema: {
      canvasName: z.string().describe('Name of the canvas to restore'),
      snapshotId: z.string().describe('Snapshot id from listSnapshots'),
    },
  }, async ({ canvasName, snapshotId }) => {
    const store = await getStore()
    const result = await store.restoreSnapshot(canvasName, snapshotId)
    if (!result) {
      return { content: [{ type: 'text' as const, text: `Snapshot "${snapshotId}" not found on "${canvasName}".` }] }
    }
    await bridge.send({ type: 'loadSnapshot', id: makeId(), snapshot: result.snapshot })
    return { content: [{ type: 'text' as const, text: `Restored "${canvasName}" to snapshot "${snapshotId}"\n${JSON.stringify(result.meta, null, 2)}` }] }
  })

  server.registerTool('branchCanvas', {
    description: 'Fork a canvas into a new canvas. Optionally branches from a named snapshot instead of the current head.',
    inputSchema: {
      parentName: z.string().describe('Name of the canvas to branch from'),
      newName: z.string().describe('Name for the new branched canvas'),
      fromSnapshot: z.string().optional().describe('Snapshot id to branch from (default: head)'),
    },
  }, async ({ parentName, newName, fromSnapshot }) => {
    const store = await getStore()
    const meta = await store.branchCanvas(parentName, newName, fromSnapshot)
    return { content: [{ type: 'text' as const, text: `Branched "${parentName}" → "${newName}"\n${JSON.stringify(meta, null, 2)}` }] }
  })

  server.registerTool('deleteCanvas', {
    description: 'Delete a saved canvas from the library by name.',
    inputSchema: {
      name: z.string().describe('Name of the canvas to delete'),
    },
  }, async ({ name }) => {
    const store = await getStore()
    const ok = await store.deleteCanvas(name)
    return {
      content: [{
        type: 'text' as const,
        text: ok ? `Deleted canvas "${name}".` : `Canvas "${name}" not found.`,
      }],
    }
  })

  server.registerTool('deleteEntity', {
    description: 'Delete a saved entity from the library by name.',
    inputSchema: {
      name: z.string().describe('Name of the entity to delete'),
    },
  }, async ({ name }) => {
    const store = await getStore()
    const ok = await store.deleteEntity(name)
    return {
      content: [{
        type: 'text' as const,
        text: ok ? `Deleted entity "${name}".` : `Entity "${name}" not found.`,
      }],
    }
  })

  server.registerTool('searchLibrary', {
    description: 'Search saved canvases and entities by name, tags, or description.',
    inputSchema: {
      query: z.string().describe('Search query'),
    },
  }, async ({ query }) => {
    const store = await getStore()
    const results = await store.searchLibrary(query)
    return { content: [{ type: 'text' as const, text: JSON.stringify(results, null, 2) }] }
  })

  server.registerTool('saveEntity', {
    description: 'Save a group of shapes as a reusable entity. Specify shape IDs to extract.',
    inputSchema: {
      name: z.string().describe('Name for this entity'),
      shapeIds: z.array(z.string()).describe('Shape IDs to save as an entity group'),
      tags: z.array(z.string()).optional(),
      description: z.string().optional(),
    },
  }, async ({ name, shapeIds, tags, description }) => {
    const allShapes = await bridge.send({
      type: 'queryShapes',
      id: makeId(),
    }) as Array<{ id: string; type: string; x: number; y: number; props: Record<string, unknown> }>

    const selected = allShapes.filter(s => shapeIds.includes(s.id))
    if (selected.length === 0) {
      return { content: [{ type: 'text' as const, text: `No matching shapes found for the given IDs.` }] }
    }

    const minX = Math.min(...selected.map(s => s.x))
    const minY = Math.min(...selected.map(s => s.y))
    const normalized = selected.map(s => ({
      ...s,
      x: s.x - minX,
      y: s.y - minY,
      id: undefined,
    }))

    const store = await getStore()
    const meta = await store.saveEntity(name, normalized, tags ?? [], description ?? '')
    return { content: [{ type: 'text' as const, text: `Saved entity "${name}" (${selected.length} shapes)\n${JSON.stringify(meta, null, 2)}` }] }
  })

  server.registerTool('loadEntity', {
    description: 'Insert a saved entity onto the canvas at a given position.',
    inputSchema: {
      name: z.string().describe('Name of the entity to load'),
      x: z.number().optional().describe('X position to place entity (default: 0)'),
      y: z.number().optional().describe('Y position to place entity (default: 0)'),
    },
  }, async ({ name, x, y }) => {
    const store = await getStore()
    const result = await store.loadEntity(name)
    if (!result) {
      return { content: [{ type: 'text' as const, text: `Entity "${name}" not found.` }] }
    }
    const offsetX = x ?? 0
    const offsetY = y ?? 0
    const createResult = await bridge.send({
      type: 'createShapes',
      id: makeId(),
      shapes: result.shapes.map((s: unknown) => {
        const shape = s as Record<string, unknown>
        return {
          type: shape['type'] as string,
          x: ((shape['x'] as number) ?? 0) + offsetX,
          y: ((shape['y'] as number) ?? 0) + offsetY,
          props: shape['props'] as Record<string, unknown>,
        }
      }),
    })
    return { content: [{ type: 'text' as const, text: `Loaded entity "${name}" at (${offsetX}, ${offsetY})\n${JSON.stringify(createResult)}` }] }
  })
}
