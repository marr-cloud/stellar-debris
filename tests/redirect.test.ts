import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('redirect', () => {
  it('/redirect/3 sends Location to /redirect/2', async () => {
    const res = await app.request('/redirect/3')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/redirect/2')
  })
  it('/redirect/1 sends Location to /get', async () => {
    const res = await app.request('/redirect/1')
    expect(res.headers.get('location')).toBe('/get')
  })
  it('/redirect-to honors url + status_code', async () => {
    const res = await app.request('/redirect-to?url=https://example.com&status_code=307')
    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('https://example.com')
  })
})
