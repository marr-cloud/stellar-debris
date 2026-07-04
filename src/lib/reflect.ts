import type { Context } from 'hono'
import type { Env } from '../index'

export function headersToObject(h: Headers): Record<string, string> {
  const o: Record<string, string> = {}
  h.forEach((v, k) => { o[k] = v })
  return o
}

const BODY_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

export async function buildReflection(
  c: Context<Env>,
  extra: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const req = c.req.raw
  const url = new URL(req.url)
  const args: Record<string, string> = {}
  url.searchParams.forEach((v, k) => { args[k] = v })

  const out: Record<string, unknown> = {
    args,
    headers: headersToObject(req.headers),
    origin: req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? '',
    url: req.url,
    ...extra,
  }

  if (BODY_METHODS.has(req.method)) {
    const ct = req.headers.get('content-type') ?? ''
    out.form = {}
    out.files = {}
    out.json = null
    if (ct.includes('multipart/form-data')) {
      const fd = await req.formData()
      const form: Record<string, string> = {}
      const files: Record<string, string> = {}
      for (const [k, v] of fd.entries()) {
        if (typeof v === 'string') form[k] = v
        else files[k] = await v.text()
      }
      out.form = form
      out.files = files
      out.data = ''
    } else {
      const raw = await req.text() // request body is client-controlled and bounded for a test tool
      out.data = raw
      if (ct.includes('application/json')) {
        try { out.json = JSON.parse(raw) } catch { out.json = null }
      } else if (ct.includes('application/x-www-form-urlencoded')) {
        const form: Record<string, string> = {}
        new URLSearchParams(raw).forEach((v, k) => { form[k] = v })
        out.form = form
        out.data = ''
      }
    }
  }
  return out
}
