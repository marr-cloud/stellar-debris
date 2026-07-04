import { Hono } from 'hono'
import type { Env } from '../index'
import { cfInfo } from '../lib/curl'

const curl = new Hono<Env>()

curl.get('/cf', (c) => c.json({ cf: c.req.raw.cf ?? null }))

curl.get('/tls', (c) => {
  const info = cfInfo(c.req.raw.cf as IncomingRequestCfProperties | undefined)
  return c.json({ tls_version: info.tls_version, cipher: info.cipher })
})

curl.get('/version', (c) => {
  const info = cfInfo(c.req.raw.cf as IncomingRequestCfProperties | undefined)
  return c.json({ http_protocol: info.http_protocol, host: c.req.header('host') ?? '' })
})

curl.get('/compression', (c) =>
  c.json({
    accept_encoding: c.req.header('accept-encoding') ?? '',
    negotiated_content_encoding: c.res.headers.get('content-encoding') ?? '(none in-Worker)',
    note: 'Workers runtime generates only gzip/deflate. br/zstd are negotiated by the Cloudflare edge in production based on your Accept-Encoding.',
  }))

export default curl
