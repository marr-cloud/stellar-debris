import { Hono } from 'hono'
import reflect from './routes/reflect'
import status from './routes/status'
import redirect from './routes/redirect'
import cookies from './routes/cookies'
import auth from './routes/auth'
import stream from './routes/stream'
import format from './routes/format'
import compress from './routes/compress'
import image from './routes/image'
import cache from './routes/cache'
import forms from './routes/forms'
import ws from './routes/websocket'
import curl from './routes/curl'
import { DocsPage } from './docs/page'
import { CATALOG, renderExample } from './docs/catalog'

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
app.route('/', compress)
app.route('/', image)
app.route('/', cache)
app.route('/', forms)
app.route('/', ws)
app.route('/', curl)

app.get('/healthz', (c) => c.json({ ok: true }))

app.get('/', (c) => {
  const host = new URL(c.req.url).origin
  const env = host.includes('localhost') || host.includes('127.0.0.1') ? 'dev' : 'prod'
  return c.html(<DocsPage host={host} env={env} />)
})

app.get('/spec', (c) => {
  const host = new URL(c.req.url).origin
  return c.json({
    host,
    endpoints: CATALOG.map((e) => ({ ...e, example: renderExample(e.example, host) })),
  })
})

export default app
