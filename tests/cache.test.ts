import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('cache', () => {
  it('/cache returns 200 with ETag by default', async () => {
    const res = await app.request('/cache')
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBeTruthy()
  })
  it('/cache returns 304 when If-None-Match matches', async () => {
    const first = await app.request('/cache')
    const etag = first.headers.get('etag')!
    const res = await app.request('/cache', { headers: { 'if-none-match': etag } })
    expect(res.status).toBe(304)
  })
  it('/cache/60 sets Cache-Control max-age=60', async () => {
    const res = await app.request('/cache/60')
    expect(res.headers.get('cache-control')).toContain('max-age=60')
  })
  it('/response-headers echoes query into headers', async () => {
    const res = await app.request('/response-headers?X-Foo=bar')
    expect(res.headers.get('x-foo')).toBe('bar')
  })
})
