import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('stream/time', () => {
  it('/range/1024 without Range returns 200 with 1024 bytes', async () => {
    const res = await app.request('/range/1024')
    expect(res.status).toBe(200)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(1024)
  })
  it('/range/1024 with Range returns 206 and Content-Range', async () => {
    const res = await app.request('/range/1024', { headers: { Range: 'bytes=0-99' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 0-99/1024')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(100)
  })
  it('/bytes/16 returns 16 bytes', async () => {
    const res = await app.request('/bytes/16')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(16)
  })
  it('/stream/3 streams 3 ndjson lines', async () => {
    const res = await app.request('/stream/3')
    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines.length).toBe(3)
    expect(JSON.parse(lines[0]).id).toBe(0)
  })
})
