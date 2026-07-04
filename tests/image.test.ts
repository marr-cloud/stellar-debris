import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('image', () => {
  it('/image/png returns image/png', async () => {
    const res = await app.request('/image/png')
    expect(res.headers.get('content-type')).toBe('image/png')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf[0]).toBe(0x89) // PNG signature
  })
  it('/image/svg returns svg', async () => {
    const res = await app.request('/image/svg')
    expect(res.headers.get('content-type')).toContain('image/svg+xml')
  })
  it('/image negotiates svg via Accept', async () => {
    const res = await app.request('/image', { headers: { accept: 'image/svg+xml' } })
    expect(res.headers.get('content-type')).toContain('image/svg+xml')
  })
})
