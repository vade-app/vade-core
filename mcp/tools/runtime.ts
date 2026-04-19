import { z } from 'zod'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CanvasBridge } from '../ws-server.js'
import { makeId } from '../protocol.js'

const REQUESTS_PATH = join(
  process.env['VADE_LIBRARY_PATH'] ?? join(homedir(), '.vade'),
  'agent-requests.jsonl'
)

export function registerRuntimeTools(server: McpServer, bridge: CanvasBridge) {
  server.registerTool('requestCodeChange', {
    description: [
      'Escalate a change that requires codebase modification (new shape type, new feature, bug fix).',
      'This places a visible sticky note on the canvas explaining the request and ETA,',
      'and logs the request to ~/.vade/agent-requests.jsonl for Claude Code to pick up.',
      'Use this when you cannot accomplish something via the existing MCP tools alone.',
    ].join(' '),
    inputSchema: {
      summary: z.string().describe('Short description of what needs to change'),
      details: z.string().optional().describe('Longer explanation, file paths, approach'),
      eta: z.string().optional().describe('Estimated time (e.g. "5 minutes", "next session")'),
      priority: z.enum(['low', 'medium', 'high']).optional().describe('Urgency'),
    },
  }, async ({ summary, details, eta, priority }) => {
    const request = {
      id: makeId(),
      timestamp: new Date().toISOString(),
      summary,
      details: details ?? '',
      eta: eta ?? 'unknown',
      priority: priority ?? 'medium',
      status: 'pending',
    }

    mkdirSync(join(homedir(), '.vade'), { recursive: true })
    appendFileSync(REQUESTS_PATH, JSON.stringify(request) + '\n')

    const noteText = [
      `🔧 Code change requested`,
      ``,
      summary,
      details ? `\n${details}` : '',
      ``,
      `ETA: ${request.eta}`,
      `Priority: ${request.priority}`,
      `Logged: ${request.timestamp}`,
    ].filter(Boolean).join('\n')

    try {
      await bridge.send({
        type: 'createShapes',
        id: makeId(),
        shapes: [{
          type: 'note',
          x: 50,
          y: 50,
          props: {
            size: 'l',
            text: noteText,
            color: priority === 'high' ? 'red' : priority === 'medium' ? 'yellow' : 'blue',
          },
        }],
      })
    } catch {
      // canvas may not be connected — that's OK, the request is still logged
    }

    return {
      content: [{
        type: 'text' as const,
        text: `Request logged to ${REQUESTS_PATH}\n${JSON.stringify(request, null, 2)}`,
      }],
    }
  })

  server.registerTool('createBatch', {
    description: 'Create multiple shapes in a single batch operation (one undo step).',
    inputSchema: {
      shapes: z.array(z.object({
        type: z.string(),
        x: z.number().optional(),
        y: z.number().optional(),
        props: z.record(z.string(), z.unknown()).optional(),
      })).describe('Array of shapes to create'),
    },
  }, async ({ shapes }) => {
    const result = await bridge.send({
      type: 'createShapes',
      id: makeId(),
      shapes,
    })
    return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] }
  })
}
