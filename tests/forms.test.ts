import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('forms', () => {
  it('GET /forms/post returns an HTML form', async () => {
    const res = await app.request('/forms/post')
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('<form')
  })
  it('POST /forms/post reflects form fields', async () => {
    const res = await app.request('/forms/post', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'custname=alice&size=large',
    })
    const body = await res.json() as any
    expect(body.form).toEqual({ custname: 'alice', size: 'large' })
  })
})
