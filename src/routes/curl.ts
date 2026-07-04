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

curl.get('/compression', (c) => {
  // Served as identity (encodeBody: 'manual' + no-transform) so this info stays
  // readable even without `curl --compressed`. Without it the Cloudflare edge would
  // compress this JSON with br/zstd based on your Accept-Encoding, printing binary.
  const body = JSON.stringify(
    {
      accept_encoding: c.req.header('accept-encoding') ?? '',
      edge_supports: ['gzip', 'deflate', 'br', 'zstd'],
      worker_generated: ['gzip', 'deflate'],
      note: 'This response is intentionally uncompressed so it prints as text. Other JSON endpoints ARE compressed by the Cloudflare edge based on your Accept-Encoding — pass `curl --compressed` to decompress them.',
      try: 'curl --compressed https://curl.infraforge.cc/gzip',
    },
    null,
    2,
  )
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-transform',
    },
    encodeBody: 'manual',
  })
})

export default curl
