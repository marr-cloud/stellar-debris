import { describe, it, expect } from 'vitest'
import app from '../src/index'

const basic = (u: string, p: string) => 'Basic ' + btoa(`${u}:${p}`)

describe('auth', () => {
  it('/basic-auth 401 without creds', async () => {
    const res = await app.request('/basic-auth/user/pass')
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('Basic')
  })
  it('/basic-auth 200 with correct creds', async () => {
    const res = await app.request('/basic-auth/user/pass', { headers: { authorization: basic('user', 'pass') } })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toEqual({ authenticated: true, user: 'user' })
  })
  it('/hidden-basic-auth 404 without creds', async () => {
    const res = await app.request('/hidden-basic-auth/user/pass')
    expect(res.status).toBe(404)
  })
  it('/bearer 401 without token', async () => {
    const res = await app.request('/bearer')
    expect(res.status).toBe(401)
  })
  it('/bearer 200 with token', async () => {
    const res = await app.request('/bearer', { headers: { authorization: 'Bearer xyz' } })
    const body = await res.json() as any
    expect(body).toEqual({ authenticated: true, token: 'xyz' })
  })
  it('/digest-auth 401 challenge advertises SHA-256', async () => {
    const res = await app.request('/digest-auth/auth/user/pass')
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('SHA-256')
  })
})
