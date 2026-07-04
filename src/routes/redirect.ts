import { Hono } from 'hono'
import type { Env } from '../index'

const redirect = new Hono<Env>()

redirect.all('/redirect/:n', (c) => {
  const n = Math.max(0, Number.parseInt(c.req.param('n'), 10) || 0)
  const location = n <= 1 ? '/get' : `/redirect/${n - 1}`
  return c.redirect(location, 302)
})

redirect.all('/relative-redirect/:n', (c) => {
  const n = Math.max(1, Number.parseInt(c.req.param('n'), 10) || 1)
  const location = n <= 1 ? '/get' : `/relative-redirect/${n - 1}`
  return c.redirect(location, 302)
})

redirect.all('/absolute-redirect/:n', (c) => {
  const n = Math.max(1, Number.parseInt(c.req.param('n'), 10) || 1)
  const origin = new URL(c.req.url).origin
  const location = n <= 1 ? `${origin}/get` : `${origin}/absolute-redirect/${n - 1}`
  return c.redirect(location, 302)
})

redirect.all('/redirect-to', (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'missing url query param' }, 400)
  const code = Number.parseInt(c.req.query('status_code') ?? '302', 10)
  const status = code >= 300 && code <= 399 ? code : 302
  return c.redirect(url, status as 301 | 302 | 303 | 307 | 308)
})

export default redirect
