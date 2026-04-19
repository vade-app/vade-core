export type ServerMessage =
  | { type: 'createShapes'; id: string; shapes: ShapePartial[] }
  | { type: 'updateShapes'; id: string; shapes: ShapeUpdate[] }
  | { type: 'deleteShapes'; id: string; ids: string[] }
  | { type: 'queryShapes'; id: string; filter?: { type?: string } }
  | { type: 'createBindings'; id: string; bindings: BindingPartial[] }
  | { type: 'getSnapshot'; id: string }
  | { type: 'loadSnapshot'; id: string; snapshot: unknown }

export type ClientMessage =
  | { type: 'result'; id: string; success: boolean; data?: unknown; error?: string }
  | { type: 'connected'; pageId: string }

export interface ShapePartial {
  id?: string
  type: string
  x?: number
  y?: number
  rotation?: number
  props?: Record<string, unknown>
}

export interface ShapeUpdate {
  id: string
  type: string
  x?: number
  y?: number
  props?: Record<string, unknown>
}

export interface BindingPartial {
  type: string
  fromId: string
  toId: string
  props?: Record<string, unknown>
  meta?: Record<string, unknown>
}

let counter = 0
export function makeId(): string {
  return `msg_${Date.now()}_${counter++}`
}
