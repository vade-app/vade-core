import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'
import { customShapeUtils } from './shapes'

export default function App() {
  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <Tldraw
        persistenceKey="vade-main"
        shapeUtils={customShapeUtils}
      />
    </div>
  )
}
