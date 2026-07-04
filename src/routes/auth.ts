import { Hono } from 'hono'
import type { Env } from '../index'
import { digestChallenge, verifyDigest } from '../lib/digest'

const auth = new Hono<Env>()

function decodeBasic(header: string | undefined): { user: string; pass: string } | null {
  if (!header || !header.startsWith('Basic ')) return null
  try {
    const [user, pass] = atob(header.slice('Basic '.length)).split(':')
    return { user, pass: pass ?? '' }
  } catch { return null }
}

auth.get('/basic-auth/:user/:pass', (c) => {
  const creds = decodeBasic(c.req.header('authorization'))
  const { user, pass } = c.req.param()
  if (!creds || creds.user !== user || creds.pass !== pass) {
    return c.body(null, 401, { 'WWW-Authenticate': 'Basic realm="Fake Realm"' })
  }
  return c.json({ authenticated: true, user })
})

auth.get('/hidden-basic-auth/:user/:pass', (c) => {
  const creds = decodeBasic(c.req.header('authorization'))
  const { user, pass } = c.req.param()
  if (!creds || creds.user !== user || creds.pass !== pass) {
    return c.json({ error: 'not found' }, 404)
  }
  return c.json({ authenticated: true, user })
})

auth.get('/bearer', (c) => {
  const h = c.req.header('authorization')
  if (!h || !h.startsWith('Bearer ')) {
    return c.body(null, 401, { 'WWW-Authenticate': 'Bearer' })
  }
  return c.json({ authenticated: true, token: h.slice('Bearer '.length) })
})

auth.get('/digest-auth/:qop/:user/:pass', async (c) => {
  const { user, pass } = c.req.param()
  const realm = 'stellar-debris'
  const ok = await verifyDigest(c.req.header('authorization'), 'GET', user, pass, realm)
  if (!ok) {
    const nonce = crypto.randomUUID().replace(/-/g, '')
    const opaque = crypto.randomUUID().replace(/-/g, '')
    return c.body(null, 401, { 'WWW-Authenticate': digestChallenge(realm, nonce, opaque) })
  }
  return c.json({ authenticated: true, user })
})

export default auth
