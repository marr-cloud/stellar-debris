import { Hono } from 'hono'
import reflect from './routes/reflect'
import status from './routes/status'

export type Env = { Bindings: CloudflareBindings }

const app = new Hono<Env>()

app.onError((err, c) => {
  console.error(JSON.stringify({ level: 'error', msg: String(err), path: c.req.path }))
  return c.json({ error: 'internal_error', message: String(err) }, 500)
})

app.route('/', reflect)
app.route('/', status)

app.get('/healthz', (c) => c.json({ ok: true }))

export default app
