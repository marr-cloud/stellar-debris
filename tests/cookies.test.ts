import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('cookies', () => {
  it('/cookies/set sets a cookie and redirects to /cookies', async () => {
    const res = await app.request('/cookies/set?token=abc')
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toContain('token=abc')
  })
  it('/cookies reflects request cookies', async () => {
    const res = await app.request('/cookies', { headers: { cookie: 'a=1; b=2' } })
    const body = await res.json() as any
    expect(body.cookies).toEqual({ a: '1', b: '2' })
  })
})
