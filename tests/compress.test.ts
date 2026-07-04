import { describe, it, expect } from 'vitest'
import app from '../src/index'

async function decompress(res: Response, format: 'gzip' | 'deflate'): Promise<string> {
  const ds = res.body!.pipeThrough(new DecompressionStream(format))
  return await new Response(ds).text()
}

describe('compression', () => {
  it('/gzip sets Content-Encoding and body decompresses', async () => {
    const res = await app.request('/gzip')
    expect(res.headers.get('content-encoding')).toBe('gzip')
    const body = JSON.parse(await decompress(res, 'gzip'))
    expect(body.gzipped).toBe(true)
  })
  it('/deflate sets Content-Encoding deflate', async () => {
    const res = await app.request('/deflate')
    expect(res.headers.get('content-encoding')).toBe('deflate')
    const body = JSON.parse(await decompress(res, 'deflate'))
    expect(body.deflated).toBe(true)
  })
})
