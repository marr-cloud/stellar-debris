import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('smoke', () => {
  it('healthz returns ok', async () => {
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })

  it('/ serves the docs page', async () => {
    const res = await app.request('/')
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('stellar')
  })

  it('/spec lists endpoints', async () => {
    const res = await app.request('/spec')
    const body = await res.json() as any
    expect(Array.isArray(body.endpoints)).toBe(true)
    expect(body.endpoints.length).toBeGreaterThan(30)
  })
})
