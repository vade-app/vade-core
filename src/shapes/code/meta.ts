import type { ShapeMeta } from '../_types'
import { CodeShapeUtil } from './util'
import { defaultProps, paramSchema } from './params'

export const meta: ShapeMeta = {
  id: 'vade-code',
  name: 'Code',
  description: 'Syntax-highlighted code block with optional output.',
  category: 'computation',
  defaultProps,
  paramSchema,
  util: CodeShapeUtil,
}
