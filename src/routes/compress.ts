import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const compress = new Hono<Env>()

function compressed(json: unknown, format: 'gzip' | 'deflate'): Response {
  const body = new TextEncoder().encode(JSON.stringify(json))
  const stream = new Response(body).body!.pipeThrough(new CompressionStream(format))
  return new Response(stream, {
    headers: { 'content-type': 'application/json', 'content-encoding': format },
  })
}

compress.get('/gzip', async (c) => {
  const r = await buildReflection(c)
  return compressed({ ...r, gzipped: true }, 'gzip')
})

compress.get('/deflate', async (c) => {
  const r = await buildReflection(c)
  return compressed({ ...r, deflated: true }, 'deflate')
})

export default compress
