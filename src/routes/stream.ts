import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const stream = new Hono<Env>()
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// deterministic byte generator (value = index % 256)
function seqBytes(n: number, start = 0): Uint8Array<ArrayBuffer> {
  const b = new Uint8Array(n)
  for (let i = 0; i < n; i++) b[i] = (start + i) % 256
  return b as Uint8Array<ArrayBuffer>
}

stream.all('/delay/:n', async (c) => {
  const secs = clamp(Number.parseFloat(c.req.param('n')) || 0, 0, 10)
  await new Promise((r) => setTimeout(r, secs * 1000))
  return c.json(await buildReflection(c))
})

stream.get('/bytes/:n', (c) => {
  const n = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 102400)
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return c.body(buf, 200, { 'content-type': 'application/octet-stream' })
})

stream.get('/range/:n', (c) => {
  const total = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 102400)
  const full = seqBytes(total)
  const range = c.req.header('range')
  const headers: Record<string, string> = {
    'accept-ranges': 'bytes',
    'content-type': 'application/octet-stream',
  }
  const m = range?.match(/bytes=(\d*)-(\d*)/)
  if (m) {
    const startS = m[1]
    const endS = m[2]
    const start = startS === '' ? total - Number.parseInt(endS, 10) : Number.parseInt(startS, 10)
    const end = startS === '' ? total - 1 : (endS === '' ? total - 1 : Number.parseInt(endS, 10))
    const s = clamp(start, 0, total - 1)
    const e = clamp(end, s, total - 1)
    headers['content-range'] = `bytes ${s}-${e}/${total}`
    const data = new Uint8Array(e - s + 1)
    data.set(full.subarray(s, e + 1))
    return c.body(data, 206, headers)
  }
  return c.body(full, 200, headers)
})

stream.get('/stream/:n', (c) => {
  const n = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 100)
  const enc = new TextEncoder()
  const rs = new ReadableStream({
    start(controller) {
      for (let i = 0; i < n; i++) {
        controller.enqueue(enc.encode(JSON.stringify({ id: i, url: c.req.url }) + '\n'))
      }
      controller.close()
    },
  })
  return c.body(rs, 200, { 'content-type': 'application/x-ndjson' })
})

stream.get('/stream-bytes/:n', (c) => {
  const total = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 102400)
  const rs = new ReadableStream({
    start(controller) {
      let sent = 0
      while (sent < total) {
        const size = Math.min(1024, total - sent)
        const chunk = new Uint8Array(size)
        crypto.getRandomValues(chunk)
        controller.enqueue(chunk)
        sent += size
      }
      controller.close()
    },
  })
  return c.body(rs, 200, { 'content-type': 'application/octet-stream' })
})

stream.get('/drip', async (c) => {
  const duration = clamp(Number.parseFloat(c.req.query('duration') ?? '2'), 0, 10)
  const numbytes = clamp(Number.parseInt(c.req.query('numbytes') ?? '10', 10), 1, 10240)
  const code = Number.parseInt(c.req.query('code') ?? '200', 10)
  const delay = (duration * 1000) / numbytes
  const rs = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < numbytes; i++) {
        controller.enqueue(new Uint8Array([0x2a])) // '*'
        if (delay > 0) await new Promise((r) => setTimeout(r, delay))
      }
      controller.close()
    },
  })
  return c.body(rs, (code >= 100 && code <= 599 ? code : 200) as any, {
    'content-type': 'application/octet-stream',
  })
})

export default stream
