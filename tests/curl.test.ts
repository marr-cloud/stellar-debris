import { describe, it, expect } from 'vitest'
import { cfInfo } from '../src/lib/curl'
import app from '../src/index'

describe('curl/cf', () => {
  it('cfInfo maps real cf fields', () => {
    const info = cfInfo({ httpProtocol: 'HTTP/3', tlsVersion: 'TLSv1.3', tlsCipher: 'AEAD-AES128-GCM-SHA256' } as any)
    expect(info.http_protocol).toBe('HTTP/3')
    expect(info.tls_version).toBe('TLSv1.3')
    expect(info.cipher).toBe('AEAD-AES128-GCM-SHA256')
  })
  it('cfInfo falls back locally', () => {
    const info = cfInfo(undefined)
    expect(info.http_protocol).toContain('local')
  })
  it('/version responds', async () => {
    const res = await app.request('/version')
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body).toHaveProperty('http_protocol')
  })
  it('/compression reflects accept-encoding', async () => {
    const res = await app.request('/compression', { headers: { 'accept-encoding': 'gzip, br, zstd' } })
    const body = await res.json() as any
    expect(body.accept_encoding).toBe('gzip, br, zstd')
  })
})
