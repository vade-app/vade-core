import { T } from '@tldraw/editor'
import { z } from 'zod'

export const paramSchema = z.object({
  w: z.number().positive().default(280),
  h: z.number().positive().default(180),
  data: z.string().default('{}'),
  label: z.string().default('Data'),
})

export type DataShapeProps = z.infer<typeof paramSchema>

export const tldrawProps = {
  w: T.nonZeroNumber,
  h: T.nonZeroNumber,
  data: T.string,
  label: T.string,
}

export const defaultProps: DataShapeProps = {
  w: 280,
  h: 180,
  data: '{}',
  label: 'Data',
}
