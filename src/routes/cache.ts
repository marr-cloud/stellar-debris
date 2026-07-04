import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const cache = new Hono<Env>()
const STATIC_ETAG = '"stellar-debris-v1"'

cache.get('/cache', async (c) => {
  const inm = c.req.header('if-none-match')
  const ims = c.req.header('if-modified-since')
  if (inm === STATIC_ETAG || ims) return c.body(null, 304)
  c.header('ETag', STATIC_ETAG)
  c.header('Last-Modified', new Date(0).toUTCString())
  return c.json(await buildReflection(c))
})

cache.get('/cache/:n', async (c) => {
  const n = Math.max(0, Number.parseInt(c.req.param('n'), 10) || 0)
  c.header('Cache-Control', `public, max-age=${n}`)
  return c.json(await buildReflection(c))
})

cache.get('/etag/:etag', (c) => {
  const etag = `"${c.req.param('etag')}"`
  const inm = c.req.header('if-none-match')
  if (inm === etag) return c.body(null, 304, { ETag: etag })
  return c.json({ etag: c.req.param('etag') }, 200, { ETag: etag })
})

cache.all('/response-headers', (c) => {
  const q = c.req.query()
  for (const [k, v] of Object.entries(q)) c.header(k, v)
  return c.json(q)
})

export default cache
