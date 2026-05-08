import { T } from '@tldraw/editor'
import { z } from 'zod'

// Zod schema drives ParamForm + defaultProps. tldraw `T.*` validators
// drive the editor's record schema. Both live here so the duplication
// stays scoped to one file per shape (architecture decision #2).

export const paramSchema = z.object({
  w: z.number().positive().default(320),
  h: z.number().positive().default(200),
  code: z.string().default(''),
  language: z.string().default('typescript'),
  output: z.string().default(''),
})

export type CodeShapeProps = z.infer<typeof paramSchema>

export const tldrawProps = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  code: T.string,
  language: T.string,
  output: T.string,
}

export const defaultProps: CodeShapeProps = {
  w: 320,
  h: 200,
  code: '',
  language: 'typescript',
  output: '',
}
