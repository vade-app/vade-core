import type { ReactNode } from 'react'
import type { TLAnyShapeUtilConstructor } from '@tldraw/editor'
import type { z } from 'zod'

export interface ShapeMeta {
  id: string
  name: string
  description?: string
  category?: string
  defaultProps: Record<string, unknown>
  paramSchema: z.ZodObject<z.ZodRawShape>
  util: TLAnyShapeUtilConstructor
  icon?: ReactNode
}
