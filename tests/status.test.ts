import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('status', () => {
  it('returns the requested status', async () => {
    const res = await app.request('/status/418')
    expect(res.status).toBe(418)
  })
  it('adds WWW-Authenticate on 401', async () => {
    const res = await app.request('/status/401')
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toBeTruthy()
  })
  it('picks one of a comma list', async () => {
    const res = await app.request('/status/200,201')
    expect([200, 201]).toContain(res.status)
  })
})
