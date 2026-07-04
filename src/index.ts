import { Hono } from 'hono'
import reflect from './routes/reflect'
import status from './routes/status'
import redirect from './routes/redirect'
import cookies from './routes/cookies'
import auth from './routes/auth'
import stream from './routes/stream'
import format from './routes/format'

export type Env = { Bindings: CloudflareBindings }

const app = new Hono<Env>()

app.onError((err, c) => {
  console.error(JSON.stringify({ level: 'error', msg: String(err), path: c.req.path }))
  return c.json({ error: 'internal_error', message: String(err) }, 500)
})

app.route('/', reflect)
app.route('/', status)
app.route('/', redirect)
app.route('/', cookies)
app.route('/', auth)
app.route('/', stream)
app.route('/', format)

app.get('/healthz', (c) => c.json({ ok: true }))

export default app
