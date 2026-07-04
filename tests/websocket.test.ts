import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('websocket', () => {
  it('returns 426 without Upgrade header', async () => {
    const res = await app.request('/websocket/echo')
    expect(res.status).toBe(426)
  })
})
