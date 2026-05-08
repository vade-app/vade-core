import type { ShapeMeta } from '../_types'
import { DataShapeUtil } from './util'
import { defaultProps, paramSchema } from './params'

export const meta: ShapeMeta = {
  id: 'vade-data',
  name: 'Data',
  description: 'Structured JSON data viewer with type-aware rendering.',
  category: 'computation',
  defaultProps,
  paramSchema,
  util: DataShapeUtil,
}
