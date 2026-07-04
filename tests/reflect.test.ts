import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('reflect', () => {
  it('GET /get echoes args, headers, url', async () => {
    const res = await app.request('/get?a=1&b=2', { headers: { 'x-test': 'yes' } })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.args).toEqual({ a: '1', b: '2' })
    expect(body.headers['x-test']).toBe('yes')
    expect(body.url).toContain('/get')
  })

  it('POST /post reflects json body', async () => {
    const res = await app.request('/post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    })
    const body = await res.json() as any
    expect(body.json).toEqual({ hello: 'world' })
    expect(body.data).toBe('{"hello":"world"}')
  })

  it('/anything includes method', async () => {
    const res = await app.request('/anything/x', { method: 'PUT' })
    const body = await res.json() as any
    expect(body.method).toBe('PUT')
  })

  it('/headers returns only headers', async () => {
    const res = await app.request('/headers', { headers: { 'x-a': 'b' } })
    const body = await res.json() as any
    expect(body.headers['x-a']).toBe('b')
    expect(body.args).toBeUndefined()
  })
})
