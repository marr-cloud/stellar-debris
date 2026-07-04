import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../index'

const cookies = new Hono<Env>()

cookies.get('/cookies', (c) => c.json({ cookies: getCookie(c) }))

cookies.get('/cookies/set/:name/:value', (c) => {
  setCookie(c, c.req.param('name'), c.req.param('value'), { path: '/' })
  return c.redirect('/cookies', 302)
})

cookies.get('/cookies/set', (c) => {
  const q = c.req.query()
  for (const [k, v] of Object.entries(q)) setCookie(c, k, v, { path: '/' })
  return c.redirect('/cookies', 302)
})

cookies.get('/cookies/delete', (c) => {
  for (const k of Object.keys(c.req.query())) deleteCookie(c, k, { path: '/' })
  return c.redirect('/cookies', 302)
})

export default cookies
