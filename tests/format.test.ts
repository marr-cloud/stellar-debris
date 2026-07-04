import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('format', () => {
  it('/uuid returns a uuid', async () => {
    const res = await app.request('/uuid')
    const body = await res.json() as any
    expect(body.uuid).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('/base64/:val decodes', async () => {
    const res = await app.request('/base64/' + btoa('hola'))
    expect(await res.text()).toBe('hola')
  })
  it('/json returns application/json', async () => {
    const res = await app.request('/json')
    expect(res.headers.get('content-type')).toContain('application/json')
  })
  it('/robots.txt disallows /deny', async () => {
    const res = await app.request('/robots.txt')
    expect(await res.text()).toContain('/deny')
  })
})
