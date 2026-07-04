import { Hono } from 'hono'
import type { Env } from '../index'

const status = new Hono<Env>()

function pickCode(spec: string): number {
  const parts = spec.split(',').map((s) => s.trim()).filter(Boolean)
  const raw = parts[Math.floor(Math.random() * parts.length)] ?? '200'
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n >= 100 && n <= 599 ? n : 400
}

status.all('/status/:codes', (c) => {
  const code = pickCode(c.req.param('codes'))
  const headers: Record<string, string> = {}
  if (code === 401) headers['WWW-Authenticate'] = 'Basic realm="Fake Realm"'
  if (code === 407) headers['Proxy-Authenticate'] = 'Basic realm="Fake Realm"'
  return c.body(`${code} ${statusText(code)}`, code as any, headers)
})

function statusText(code: number): string {
  const map: Record<number, string> = {
    200: 'OK', 201: 'Created', 204: 'No Content', 301: 'Moved Permanently',
    302: 'Found', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
    404: 'Not Found', 418: "I'm a teapot", 500: 'Internal Server Error',
    502: 'Bad Gateway', 503: 'Service Unavailable',
  }
  return map[code] ?? ''
}

export default status
