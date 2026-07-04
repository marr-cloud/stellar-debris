# httpbin + static-curl Worker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Cloudflare Worker (Hono) that clones httpbin.io's core behavior and adds endpoints for exercising `stunnel/static-curl` features, with a clean Cloudflare-styled static docs page.

**Architecture:** One Hono app in `src/index.ts` mounts ~12 small routers (one file per category, single responsibility). Shared helpers in `src/lib/`. A single `src/docs/catalog.ts` is the source of truth for both the JSX docs page and the `/spec` JSON. Curl-specific endpoints reflect real values from `request.cf`. No new runtime dependencies (uses Hono + Web platform APIs already available in Workers: `CompressionStream`, `WebSocketPair`, `crypto.subtle`).

**Tech Stack:** Cloudflare Workers, Hono 4.12, TypeScript, `hono/jsx`, Wrangler 4.107, Vitest (tests via Hono `app.request()`), pnpm.

## Global Constraints

- Runtime deps: **only `hono`**. No new runtime dependencies. Dev dep added: `vitest`.
- Package manager: **pnpm**. Use `pnpm` / `pnpm exec`, never `npm`.
- All routers: `new Hono<Env>()` where `type Env = { Bindings: CloudflareBindings }` (import nothing for `CloudflareBindings` — it is global from `worker-configuration.d.ts`).
- **No MD5** (unavailable in Workers `crypto.subtle`): digest-auth uses `algorithm=SHA-256`.
- Randomness for bytes/ids/nonces: **`crypto.randomUUID()` / `crypto.getRandomValues()`**, never `Math.random()`.
- No module-level mutable request state. No floating promises (every promise `await`ed/`return`ed). No `ctx.passThroughOnException()`; errors go through Hono `app.onError` returning structured JSON.
- Curl examples in docs/catalog use the literal token `{{HOST}}`, replaced with the request origin at render time.
- Caps to avoid abuse/memory: `/delay` ≤ 10s, `/bytes` & `/stream-bytes` ≤ 102400, `/stream` ≤ 100 lines, `/drip` ≤ 10s.
- Response shape for reflection endpoints (httpbin-compatible): `{ args, headers, origin, url }` plus, for body methods, `{ data, form, files, json }`, plus `method` for `/anything`.

---

## File Structure

```
src/
  index.ts                # app, onError, mounts routers, "/" docs, "/spec"
  lib/reflect.ts          # buildReflection(c, extra?) + headersToObject(h)
  lib/curl.ts             # cfInfo(cf) pure function
  lib/digest.ts           # sha256Hex, digestChallenge, verifyDigest, parseAuth
  assets/images.ts        # PNG_1x1_BASE64 constant + svgSample()
  routes/reflect.ts       # /get /post /put /patch /delete /anything(/*) /headers /ip /user-agent
  routes/status.ts        # /status/:codes
  routes/redirect.ts      # /redirect/:n /redirect-to /relative-redirect/:n /absolute-redirect/:n
  routes/cookies.ts       # /cookies /cookies/set /cookies/set/:name/:value /cookies/delete
  routes/auth.ts          # /basic-auth /hidden-basic-auth /bearer /digest-auth
  routes/stream.ts        # /delay /drip /stream /stream-bytes /bytes /range
  routes/format.ts        # /json /html /xml /uuid /base64 /encoding/utf8 /robots.txt /deny
  routes/compress.ts      # /gzip /deflate
  routes/image.ts         # /image /image/png /image/svg
  routes/cache.ts         # /cache /cache/:n /etag/:etag /response-headers
  routes/forms.ts         # /forms/post
  routes/websocket.ts     # /websocket/echo
  routes/curl.ts          # /cf /tls /version /compression
  docs/catalog.ts         # EndpointDoc[] + CATEGORIES (source of truth)
  docs/page.tsx           # <DocsPage host env /> JSX
tests/
  reflect.test.ts status.test.ts redirect.test.ts auth.test.ts
  stream.test.ts compress.test.ts curl.test.ts format.test.ts
```

**Note on scope deviation (images):** `/image/jpeg` and `/image/webp` are **deferred**. We cannot generate valid JPEG/WEBP bytes in-runtime without a dependency, and shipping hand-written base64 risks invalid images. `/image/png` (a verified 1×1 PNG) + `/image/svg` (generated) fully cover `Accept`-negotiation testing. Adding jpeg/webp later is a drop-in of real sample assets.

---

### Task 1: Tooling, config, and app skeleton

**Files:**
- Modify: `package.json` (add vitest dep + scripts)
- Create: `vitest.config.ts`
- Modify: `wrangler.jsonc` (bump compatibility_date, add observability)
- Modify: `src/index.ts` (app skeleton with onError + a smoke route)
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Produces: `type Env = { Bindings: CloudflareBindings }` exported from `src/index.ts`; the default-exported Hono `app`.

- [ ] **Step 1: Add vitest and scripts to `package.json`**

```jsonc
{
  "name": "stellar-debris",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy --minify",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "cf-typegen": "wrangler types --env-interface CloudflareBindings"
  },
  "dependencies": {
    "hono": "^4.12.27"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "wrangler": "^4.107.0"
  }
}
```

Run: `pnpm install`

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 3: Update `wrangler.jsonc`** — bump date, enable observability. Replace file contents with:

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "stellar-debris",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-03",
  "observability": {
    "enabled": true,
    "head_sampling_rate": 1
  }
}
```

- [ ] **Step 4: Write `src/index.ts` skeleton**

```ts
import { Hono } from 'hono'

export type Env = { Bindings: CloudflareBindings }

const app = new Hono<Env>()

app.onError((err, c) => {
  console.error(JSON.stringify({ level: 'error', msg: String(err), path: c.req.path }))
  return c.json({ error: 'internal_error', message: String(err) }, 500)
})

app.get('/healthz', (c) => c.json({ ok: true }))

export default app
```

- [ ] **Step 5: Write `tests/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('smoke', () => {
  it('healthz returns ok', async () => {
    const res = await app.request('/healthz')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
  })
})
```

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: 1 passing test; no TS errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: tooling, wrangler config, app skeleton"
```

---

### Task 2: Shared reflection lib + reflect router

**Files:**
- Create: `src/lib/reflect.ts`
- Create: `src/routes/reflect.ts`
- Modify: `src/index.ts` (mount reflect router)
- Create: `tests/reflect.test.ts`

**Interfaces:**
- Produces: `headersToObject(h: Headers): Record<string,string>`; `buildReflection(c: Context<Env>, extra?: Record<string, unknown>): Promise<Record<string, unknown>>`; default Hono router.
- Consumes: `Env` from `src/index.ts`.

- [ ] **Step 1: Write failing test `tests/reflect.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('reflect', () => {
  it('GET /get echoes args, headers, url', async () => {
    const res = await app.request('/get?a=1&b=2', { headers: { 'x-test': 'yes' } })
    expect(res.status).toBe(200)
    const body = await res.json() as any
    expect(body.args).toEqual({ a: '1', b: '2' })
    expect(body.headers['x-test']).toBe('yes')
    expect(body.url).toContain('/get')
  })

  it('POST /post reflects json body', async () => {
    const res = await app.request('/post', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hello: 'world' }),
    })
    const body = await res.json() as any
    expect(body.json).toEqual({ hello: 'world' })
    expect(body.data).toBe('{"hello":"world"}')
  })

  it('/anything includes method', async () => {
    const res = await app.request('/anything/x', { method: 'PUT' })
    const body = await res.json() as any
    expect(body.method).toBe('PUT')
  })

  it('/headers returns only headers', async () => {
    const res = await app.request('/headers', { headers: { 'x-a': 'b' } })
    const body = await res.json() as any
    expect(body.headers['x-a']).toBe('b')
    expect(body.args).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test → fail**

Run: `pnpm vitest run tests/reflect.test.ts`
Expected: FAIL (routes 404 / not defined).

- [ ] **Step 3: Write `src/lib/reflect.ts`**

```ts
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
```

- [ ] **Step 4: Write `src/routes/reflect.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection, headersToObject } from '../lib/reflect'

const reflect = new Hono<Env>()

const reflectHandler = async (c: import('hono').Context<Env>) =>
  c.json(await buildReflection(c))

reflect.get('/get', reflectHandler)
reflect.post('/post', reflectHandler)
reflect.put('/put', reflectHandler)
reflect.patch('/patch', reflectHandler)
reflect.delete('/delete', reflectHandler)

reflect.all('/anything', async (c) => c.json(await buildReflection(c, { method: c.req.method })))
reflect.all('/anything/*', async (c) => c.json(await buildReflection(c, { method: c.req.method })))

reflect.get('/headers', (c) => c.json({ headers: headersToObject(c.req.raw.headers) }))
reflect.get('/ip', (c) => c.json({
  origin: c.req.raw.headers.get('cf-connecting-ip') ?? c.req.raw.headers.get('x-forwarded-for') ?? '',
}))
reflect.get('/user-agent', (c) => c.json({ 'user-agent': c.req.header('user-agent') ?? '' }))

export default reflect
```

- [ ] **Step 5: Mount in `src/index.ts`** — add import and `app.route` after `onError`:

```ts
import reflect from './routes/reflect'
// ...after app.onError(...)
app.route('/', reflect)
```

- [ ] **Step 6: Run test → pass**

Run: `pnpm vitest run tests/reflect.test.ts && pnpm typecheck`
Expected: PASS, no TS errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: reflection endpoints (get/post/anything/headers/ip/user-agent)"
```

---

### Task 3: Status router

**Files:**
- Create: `src/routes/status.ts`
- Modify: `src/index.ts` (mount)
- Create: `tests/status.test.ts`

**Interfaces:**
- Produces: default Hono router handling `/status/:codes`.

- [ ] **Step 1: Write failing test `tests/status.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test → fail**

Run: `pnpm vitest run tests/status.test.ts`
Expected: FAIL (404).

- [ ] **Step 3: Write `src/routes/status.ts`**

```ts
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
```

- [ ] **Step 4: Mount in `src/index.ts`**

```ts
import status from './routes/status'
app.route('/', status)
```

- [ ] **Step 5: Run test → pass**

Run: `pnpm vitest run tests/status.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "feat: /status/:codes endpoint"
```

---

### Task 4: Redirect router

**Files:**
- Create: `src/routes/redirect.ts`
- Modify: `src/index.ts`
- Create: `tests/redirect.test.ts`

- [ ] **Step 1: Write failing test `tests/redirect.test.ts`**

```ts
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
```

- [ ] **Step 2: Run → fail** — `pnpm vitest run tests/redirect.test.ts` → FAIL.

- [ ] **Step 3: Write `src/routes/redirect.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'

const redirect = new Hono<Env>()

redirect.all('/redirect/:n', (c) => {
  const n = Math.max(0, Number.parseInt(c.req.param('n'), 10) || 0)
  const location = n <= 1 ? '/get' : `/redirect/${n - 1}`
  return c.redirect(location, 302)
})

redirect.all('/relative-redirect/:n', (c) => {
  const n = Math.max(1, Number.parseInt(c.req.param('n'), 10) || 1)
  const location = n <= 1 ? '/get' : `/relative-redirect/${n - 1}`
  return c.redirect(location, 302)
})

redirect.all('/absolute-redirect/:n', (c) => {
  const n = Math.max(1, Number.parseInt(c.req.param('n'), 10) || 1)
  const origin = new URL(c.req.url).origin
  const location = n <= 1 ? `${origin}/get` : `${origin}/absolute-redirect/${n - 1}`
  return c.redirect(location, 302)
})

redirect.all('/redirect-to', (c) => {
  const url = c.req.query('url')
  if (!url) return c.json({ error: 'missing url query param' }, 400)
  const code = Number.parseInt(c.req.query('status_code') ?? '302', 10)
  const status = code >= 300 && code <= 399 ? code : 302
  return c.redirect(url, status as 301 | 302 | 303 | 307 | 308)
})

export default redirect
```

- [ ] **Step 4: Mount** — `import redirect from './routes/redirect'; app.route('/', redirect)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/redirect.test.ts && pnpm typecheck` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: redirect endpoints"`

---

### Task 5: Cookies router

**Files:**
- Create: `src/routes/cookies.ts`
- Modify: `src/index.ts`
- Test folded into this task (assert Set-Cookie + reflect).

- [ ] **Step 1: Write failing test `tests/cookies.test.ts`**

```ts
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/cookies.ts`**

```ts
import { Hono } from 'hono'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'
import type { Env } from '../index'

const cookies = new Hono<Env>()

cookies.get('/cookies', (c) => c.json({ cookies: getCookie(c) }))

cookies.get('/cookies/set/:name/:value', (c) => {
  setCookie(c, c.req.param('name'), c.req.param('value'), { path: '/' })
  return c.redirect('/cookies', 302)
})

cookies.get('/cookies/set', (c) => {
  const q = c.req.query()
  for (const [k, v] of Object.entries(q)) setCookie(c, k, v, { path: '/' })
  return c.redirect('/cookies', 302)
})

cookies.get('/cookies/delete', (c) => {
  for (const k of Object.keys(c.req.query())) deleteCookie(c, k, { path: '/' })
  return c.redirect('/cookies', 302)
})

export default cookies
```

- [ ] **Step 4: Mount** — `import cookies from './routes/cookies'; app.route('/', cookies)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/cookies.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: cookies endpoints"`

---

### Task 6: Auth router (basic, hidden-basic, bearer, digest)

**Files:**
- Create: `src/lib/digest.ts`
- Create: `src/routes/auth.ts`
- Modify: `src/index.ts`
- Create: `tests/auth.test.ts`

**Interfaces:**
- Produces (`digest.ts`): `sha256Hex(s: string): Promise<string>`; `digestChallenge(realm: string, nonce: string, opaque: string): string`; `verifyDigest(header: string | undefined, method: string, user: string, pass: string, realm: string): Promise<boolean>`.

- [ ] **Step 1: Write failing test `tests/auth.test.ts`**

```ts
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/lib/digest.ts`**

```ts
export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function digestChallenge(realm: string, nonce: string, opaque: string): string {
  return `Digest realm="${realm}", qop="auth", algorithm=SHA-256, nonce="${nonce}", opaque="${opaque}"`
}

function parseAuth(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(header)) !== null) out[m[1]] = m[2] ?? m[3] ?? ''
  return out
}

export async function verifyDigest(
  header: string | undefined,
  method: string,
  user: string,
  pass: string,
  realm: string,
): Promise<boolean> {
  if (!header || !header.startsWith('Digest ')) return false
  const p = parseAuth(header.slice('Digest '.length))
  if (p.username !== user || !p.uri || !p.nonce || !p.response) return false
  const ha1 = await sha256Hex(`${user}:${realm}:${pass}`)
  const ha2 = await sha256Hex(`${method}:${p.uri}`)
  const expected = p.qop
    ? await sha256Hex(`${ha1}:${p.nonce}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`)
    : await sha256Hex(`${ha1}:${p.nonce}:${ha2}`)
  return expected === p.response
}
```

- [ ] **Step 4: Write `src/routes/auth.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { digestChallenge, verifyDigest } from '../lib/digest'

const auth = new Hono<Env>()

function decodeBasic(header: string | undefined): { user: string; pass: string } | null {
  if (!header || !header.startsWith('Basic ')) return null
  try {
    const [user, pass] = atob(header.slice('Basic '.length)).split(':')
    return { user, pass: pass ?? '' }
  } catch { return null }
}

auth.get('/basic-auth/:user/:pass', (c) => {
  const creds = decodeBasic(c.req.header('authorization'))
  const { user, pass } = c.req.param()
  if (!creds || creds.user !== user || creds.pass !== pass) {
    return c.body(null, 401, { 'WWW-Authenticate': 'Basic realm="Fake Realm"' })
  }
  return c.json({ authenticated: true, user })
})

auth.get('/hidden-basic-auth/:user/:pass', (c) => {
  const creds = decodeBasic(c.req.header('authorization'))
  const { user, pass } = c.req.param()
  if (!creds || creds.user !== user || creds.pass !== pass) {
    return c.json({ error: 'not found' }, 404)
  }
  return c.json({ authenticated: true, user })
})

auth.get('/bearer', (c) => {
  const h = c.req.header('authorization')
  if (!h || !h.startsWith('Bearer ')) {
    return c.body(null, 401, { 'WWW-Authenticate': 'Bearer' })
  }
  return c.json({ authenticated: true, token: h.slice('Bearer '.length) })
})

auth.get('/digest-auth/:qop/:user/:pass', async (c) => {
  const { user, pass } = c.req.param()
  const realm = 'stellar-debris'
  const ok = await verifyDigest(c.req.header('authorization'), 'GET', user, pass, realm)
  if (!ok) {
    const nonce = crypto.randomUUID().replace(/-/g, '')
    const opaque = crypto.randomUUID().replace(/-/g, '')
    return c.body(null, 401, { 'WWW-Authenticate': digestChallenge(realm, nonce, opaque) })
  }
  return c.json({ authenticated: true, user })
})

export default auth
```

- [ ] **Step 5: Mount** — `import auth from './routes/auth'; app.route('/', auth)`

- [ ] **Step 6: Run → pass** — `pnpm vitest run tests/auth.test.ts && pnpm typecheck`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: auth endpoints (basic/hidden/bearer/digest SHA-256)"`

---

### Task 7: Stream/time router (delay, drip, stream, stream-bytes, bytes, range)

**Files:**
- Create: `src/routes/stream.ts`
- Modify: `src/index.ts`
- Create: `tests/stream.test.ts`

- [ ] **Step 1: Write failing test `tests/stream.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('stream/time', () => {
  it('/range/1024 without Range returns 200 with 1024 bytes', async () => {
    const res = await app.request('/range/1024')
    expect(res.status).toBe(200)
    expect(res.headers.get('accept-ranges')).toBe('bytes')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(1024)
  })
  it('/range/1024 with Range returns 206 and Content-Range', async () => {
    const res = await app.request('/range/1024', { headers: { Range: 'bytes=0-99' } })
    expect(res.status).toBe(206)
    expect(res.headers.get('content-range')).toBe('bytes 0-99/1024')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(100)
  })
  it('/bytes/16 returns 16 bytes', async () => {
    const res = await app.request('/bytes/16')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBe(16)
  })
  it('/stream/3 streams 3 ndjson lines', async () => {
    const res = await app.request('/stream/3')
    const text = await res.text()
    const lines = text.trim().split('\n')
    expect(lines.length).toBe(3)
    expect(JSON.parse(lines[0]).id).toBe(0)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/stream.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const stream = new Hono<Env>()
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

// deterministic byte generator (value = index % 256)
function seqBytes(n: number, start = 0): Uint8Array {
  const b = new Uint8Array(n)
  for (let i = 0; i < n; i++) b[i] = (start + i) % 256
  return b
}

stream.all('/delay/:n', async (c) => {
  const secs = clamp(Number.parseFloat(c.req.param('n')) || 0, 0, 10)
  await new Promise((r) => setTimeout(r, secs * 1000))
  return c.json(await buildReflection(c))
})

stream.get('/bytes/:n', (c) => {
  const n = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 102400)
  const buf = new Uint8Array(n)
  crypto.getRandomValues(buf)
  return c.body(buf, 200, { 'content-type': 'application/octet-stream' })
})

stream.get('/range/:n', (c) => {
  const total = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 102400)
  const full = seqBytes(total)
  const range = c.req.header('range')
  const headers: Record<string, string> = {
    'accept-ranges': 'bytes',
    'content-type': 'application/octet-stream',
  }
  const m = range?.match(/bytes=(\d*)-(\d*)/)
  if (m) {
    const startS = m[1]
    const endS = m[2]
    const start = startS === '' ? total - Number.parseInt(endS, 10) : Number.parseInt(startS, 10)
    const end = startS === '' ? total - 1 : (endS === '' ? total - 1 : Number.parseInt(endS, 10))
    const s = clamp(start, 0, total - 1)
    const e = clamp(end, s, total - 1)
    headers['content-range'] = `bytes ${s}-${e}/${total}`
    return c.body(full.slice(s, e + 1), 206, headers)
  }
  return c.body(full, 200, headers)
})

stream.get('/stream/:n', (c) => {
  const n = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 100)
  const enc = new TextEncoder()
  const rs = new ReadableStream({
    start(controller) {
      for (let i = 0; i < n; i++) {
        controller.enqueue(enc.encode(JSON.stringify({ id: i, url: c.req.url }) + '\n'))
      }
      controller.close()
    },
  })
  return c.body(rs, 200, { 'content-type': 'application/x-ndjson' })
})

stream.get('/stream-bytes/:n', (c) => {
  const total = clamp(Number.parseInt(c.req.param('n'), 10) || 0, 0, 102400)
  const rs = new ReadableStream({
    start(controller) {
      let sent = 0
      while (sent < total) {
        const size = Math.min(1024, total - sent)
        const chunk = new Uint8Array(size)
        crypto.getRandomValues(chunk)
        controller.enqueue(chunk)
        sent += size
      }
      controller.close()
    },
  })
  return c.body(rs, 200, { 'content-type': 'application/octet-stream' })
})

stream.get('/drip', async (c) => {
  const duration = clamp(Number.parseFloat(c.req.query('duration') ?? '2'), 0, 10)
  const numbytes = clamp(Number.parseInt(c.req.query('numbytes') ?? '10', 10), 1, 10240)
  const code = Number.parseInt(c.req.query('code') ?? '200', 10)
  const delay = (duration * 1000) / numbytes
  const rs = new ReadableStream({
    async start(controller) {
      for (let i = 0; i < numbytes; i++) {
        controller.enqueue(new Uint8Array([0x2a])) // '*'
        if (delay > 0) await new Promise((r) => setTimeout(r, delay))
      }
      controller.close()
    },
  })
  return c.body(rs, (code >= 100 && code <= 599 ? code : 200) as any, {
    'content-type': 'application/octet-stream',
  })
})

export default stream
```

- [ ] **Step 4: Mount** — `import stream from './routes/stream'; app.route('/', stream)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/stream.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: streaming/time endpoints (delay/drip/stream/bytes/range)"`

---

### Task 8: Format router (json, html, xml, uuid, base64, encoding/utf8, robots.txt, deny)

**Files:**
- Create: `src/routes/format.ts`
- Modify: `src/index.ts`
- Create: `tests/format.test.ts`

- [ ] **Step 1: Write failing test `tests/format.test.ts`**

```ts
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/format.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'

const format = new Hono<Env>()

format.get('/uuid', (c) => c.json({ uuid: crypto.randomUUID() }))

format.get('/base64/:val', (c) => {
  try {
    const val = c.req.param('val').replace(/-/g, '+').replace(/_/g, '/')
    return c.text(atob(val))
  } catch {
    return c.text('Incorrect Base64 data', 400)
  }
})

format.get('/json', (c) =>
  c.json({
    slideshow: {
      title: 'Sample Slide Show',
      author: 'stellar-debris',
      slides: [{ title: 'Wake up', type: 'all' }, { title: 'Overview', type: 'all' }],
    },
  }))

format.get('/html', (c) =>
  c.html('<!doctype html><html><body><h1>Herman Melville - Moby-Dick</h1></body></html>'))

format.get('/xml', (c) =>
  c.body('<?xml version="1.0"?><slideshow title="Sample"><slide>one</slide></slideshow>', 200, {
    'content-type': 'application/xml',
  }))

format.get('/encoding/utf8', (c) =>
  c.html('<!doctype html><html><body><p>∮ E⋅da = Q, ñ, 你好, Σ</p></body></html>'))

format.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /deny\n'))

format.get('/deny', (c) =>
  c.text('YOU SHOULD NOT BE HERE\n(this is what /robots.txt disallows)\n'))

export default format
```

- [ ] **Step 4: Mount** — `import format from './routes/format'; app.route('/', format)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/format.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: format endpoints (json/html/xml/uuid/base64/robots/deny)"`

---

### Task 9: Compression router (gzip, deflate)

**Files:**
- Create: `src/routes/compress.ts`
- Modify: `src/index.ts`
- Create: `tests/compress.test.ts`

- [ ] **Step 1: Write failing test `tests/compress.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

async function decompress(res: Response, format: 'gzip' | 'deflate'): Promise<string> {
  const ds = res.body!.pipeThrough(new DecompressionStream(format))
  return await new Response(ds).text()
}

describe('compression', () => {
  it('/gzip sets Content-Encoding and body decompresses', async () => {
    const res = await app.request('/gzip')
    expect(res.headers.get('content-encoding')).toBe('gzip')
    const body = JSON.parse(await decompress(res, 'gzip'))
    expect(body.gzipped).toBe(true)
  })
  it('/deflate sets Content-Encoding deflate', async () => {
    const res = await app.request('/deflate')
    expect(res.headers.get('content-encoding')).toBe('deflate')
    const body = JSON.parse(await decompress(res, 'deflate'))
    expect(body.deflated).toBe(true)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/compress.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const compress = new Hono<Env>()

function compressed(json: unknown, format: 'gzip' | 'deflate'): Response {
  const body = new TextEncoder().encode(JSON.stringify(json))
  const stream = new Response(body).body!.pipeThrough(new CompressionStream(format))
  return new Response(stream, {
    headers: { 'content-type': 'application/json', 'content-encoding': format },
  })
}

compress.get('/gzip', async (c) => {
  const r = await buildReflection(c)
  return compressed({ ...r, gzipped: true }, 'gzip')
})

compress.get('/deflate', async (c) => {
  const r = await buildReflection(c)
  return compressed({ ...r, deflated: true }, 'deflate')
})

export default compress
```

- [ ] **Step 4: Mount** — `import compress from './routes/compress'; app.route('/', compress)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/compress.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: gzip/deflate endpoints with real Content-Encoding"`

---

### Task 10: Image router (png, svg) + assets

**Files:**
- Create: `src/assets/images.ts`
- Create: `src/routes/image.ts`
- Modify: `src/index.ts`
- Test folded in (content-type checks).

- [ ] **Step 1: Write failing test `tests/image.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('image', () => {
  it('/image/png returns image/png', async () => {
    const res = await app.request('/image/png')
    expect(res.headers.get('content-type')).toBe('image/png')
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf[0]).toBe(0x89) // PNG signature
  })
  it('/image/svg returns svg', async () => {
    const res = await app.request('/image/svg')
    expect(res.headers.get('content-type')).toContain('image/svg+xml')
  })
  it('/image negotiates svg via Accept', async () => {
    const res = await app.request('/image', { headers: { accept: 'image/svg+xml' } })
    expect(res.headers.get('content-type')).toContain('image/svg+xml')
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/assets/images.ts`**

```ts
// 1x1 transparent PNG (verified valid)
export const PNG_1x1_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function pngBytes(): Uint8Array {
  const bin = atob(PNG_1x1_BASE64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function svgSample(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120" viewBox="0 0 200 120">
  <rect width="200" height="120" fill="#0b0b0d"/>
  <circle cx="100" cy="60" r="34" fill="#F6821F"/>
  <text x="100" y="105" fill="#e6e6e6" font-family="monospace" font-size="12" text-anchor="middle">stellar-debris</text>
</svg>`
}
```

- [ ] **Step 4: Write `src/routes/image.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { pngBytes, svgSample } from '../assets/images'

const image = new Hono<Env>()

const png = (c: import('hono').Context<Env>) =>
  c.body(pngBytes(), 200, { 'content-type': 'image/png' })
const svg = (c: import('hono').Context<Env>) =>
  c.body(svgSample(), 200, { 'content-type': 'image/svg+xml' })

image.get('/image/png', png)
image.get('/image/svg', svg)
image.get('/image', (c) => {
  const accept = c.req.header('accept') ?? ''
  return accept.includes('image/svg') ? svg(c) : png(c)
})

export default image
```

- [ ] **Step 5: Mount** — `import image from './routes/image'; app.route('/', image)`

- [ ] **Step 6: Run → pass** — `pnpm vitest run tests/image.test.ts && pnpm typecheck`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: image endpoints (png/svg + Accept negotiation)"`

---

### Task 11: Cache router (cache, cache/:n, etag, response-headers)

**Files:**
- Create: `src/routes/cache.ts`
- Modify: `src/index.ts`
- Test folded in.

- [ ] **Step 1: Write failing test `tests/cache.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('cache', () => {
  it('/cache returns 200 with ETag by default', async () => {
    const res = await app.request('/cache')
    expect(res.status).toBe(200)
    expect(res.headers.get('etag')).toBeTruthy()
  })
  it('/cache returns 304 when If-None-Match matches', async () => {
    const first = await app.request('/cache')
    const etag = first.headers.get('etag')!
    const res = await app.request('/cache', { headers: { 'if-none-match': etag } })
    expect(res.status).toBe(304)
  })
  it('/cache/60 sets Cache-Control max-age=60', async () => {
    const res = await app.request('/cache/60')
    expect(res.headers.get('cache-control')).toContain('max-age=60')
  })
  it('/response-headers echoes query into headers', async () => {
    const res = await app.request('/response-headers?X-Foo=bar')
    expect(res.headers.get('x-foo')).toBe('bar')
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/cache.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const cache = new Hono<Env>()
const STATIC_ETAG = '"stellar-debris-v1"'

cache.get('/cache', async (c) => {
  const inm = c.req.header('if-none-match')
  const ims = c.req.header('if-modified-since')
  if (inm === STATIC_ETAG || ims) return c.body(null, 304)
  c.header('ETag', STATIC_ETAG)
  c.header('Last-Modified', new Date(0).toUTCString())
  return c.json(await buildReflection(c))
})

cache.get('/cache/:n', async (c) => {
  const n = Math.max(0, Number.parseInt(c.req.param('n'), 10) || 0)
  c.header('Cache-Control', `public, max-age=${n}`)
  return c.json(await buildReflection(c))
})

cache.get('/etag/:etag', (c) => {
  const etag = `"${c.req.param('etag')}"`
  const inm = c.req.header('if-none-match')
  if (inm === etag) return c.body(null, 304, { ETag: etag })
  return c.json({ etag: c.req.param('etag') }, 200, { ETag: etag })
})

cache.all('/response-headers', (c) => {
  const q = c.req.query()
  for (const [k, v] of Object.entries(q)) c.header(k, v)
  return c.json(q)
})

export default cache
```

- [ ] **Step 4: Mount** — `import cache from './routes/cache'; app.route('/', cache)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/cache.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: cache/etag/response-headers endpoints"`

---

### Task 12: Forms router (/forms/post)

**Files:**
- Create: `src/routes/forms.ts`
- Modify: `src/index.ts`
- Test folded in.

- [ ] **Step 1: Write failing test `tests/forms.test.ts`**

```ts
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/forms.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection } from '../lib/reflect'

const forms = new Hono<Env>()

forms.get('/forms/post', (c) =>
  c.html(`<!doctype html><html><body>
<form method="post" action="/forms/post">
  <input name="custname" placeholder="name">
  <input name="size" value="large">
  <button type="submit">Submit</button>
</form>
</body></html>`))

forms.post('/forms/post', async (c) => c.json(await buildReflection(c)))

export default forms
```

- [ ] **Step 4: Mount** — `import forms from './routes/forms'; app.route('/', forms)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/forms.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: /forms/post endpoint"`

---

### Task 13: WebSocket router (/websocket/echo)

**Files:**
- Create: `src/routes/websocket.ts`
- Modify: `src/index.ts`
- Test folded in (426 without upgrade).

**Note:** The WS upgrade path only works when deployed or under `wrangler dev --remote`. The automated test only asserts the non-upgrade 426 branch.

- [ ] **Step 1: Write failing test `tests/websocket.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import app from '../src/index'

describe('websocket', () => {
  it('returns 426 without Upgrade header', async () => {
    const res = await app.request('/websocket/echo')
    expect(res.status).toBe(426)
  })
})
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/routes/websocket.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'

const ws = new Hono<Env>()

ws.get('/websocket/echo', (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade. Try: websocat wss://<host>/websocket/echo', 426)
  }
  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()
  server.addEventListener('message', (event) => {
    server.send(typeof event.data === 'string' ? event.data : event.data)
  })
  server.addEventListener('close', () => server.close())
  return new Response(null, { status: 101, webSocket: client })
})

export default ws
```

- [ ] **Step 4: Mount** — `import ws from './routes/websocket'; app.route('/', ws)`

- [ ] **Step 5: Run → pass** — `pnpm vitest run tests/websocket.test.ts && pnpm typecheck`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: /websocket/echo endpoint"`

---

### Task 14: Curl/CF router (/cf, /tls, /version, /compression)

**Files:**
- Create: `src/lib/curl.ts`
- Create: `src/routes/curl.ts`
- Modify: `src/index.ts`
- Create: `tests/curl.test.ts`

**Interfaces:**
- Produces (`curl.ts`): `cfInfo(cf: IncomingRequestCfProperties | undefined): { http_protocol, tls_version, cipher, colo, country, as_organization }` (each string-or-fallback).

- [ ] **Step 1: Write failing test `tests/curl.test.ts`**

```ts
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
```

- [ ] **Step 2: Run → fail.**

- [ ] **Step 3: Write `src/lib/curl.ts`**

```ts
const LOCAL = 'unknown (local dev — deploy to see real value)'

export function cfInfo(cf: IncomingRequestCfProperties | undefined) {
  return {
    http_protocol: cf?.httpProtocol ?? LOCAL,
    tls_version: cf?.tlsVersion ?? LOCAL,
    cipher: cf?.tlsCipher ?? LOCAL,
    colo: cf?.colo ?? null,
    country: cf?.country ?? null,
    as_organization: cf?.asOrganization ?? null,
  }
}
```

- [ ] **Step 4: Write `src/routes/curl.ts`**

```ts
import { Hono } from 'hono'
import type { Env } from '../index'
import { cfInfo } from '../lib/curl'

const curl = new Hono<Env>()

curl.get('/cf', (c) => c.json({ cf: c.req.raw.cf ?? null }))

curl.get('/tls', (c) => {
  const info = cfInfo(c.req.raw.cf)
  return c.json({ tls_version: info.tls_version, cipher: info.cipher })
})

curl.get('/version', (c) => {
  const info = cfInfo(c.req.raw.cf)
  return c.json({ http_protocol: info.http_protocol, host: c.req.header('host') ?? '' })
})

curl.get('/compression', (c) =>
  c.json({
    accept_encoding: c.req.header('accept-encoding') ?? '',
    negotiated_content_encoding: c.res.headers.get('content-encoding') ?? '(none in-Worker)',
    note: 'Workers runtime generates only gzip/deflate. br/zstd are negotiated by the Cloudflare edge in production based on your Accept-Encoding.',
  }))

export default curl
```

- [ ] **Step 5: Mount** — `import curl from './routes/curl'; app.route('/', curl)`

- [ ] **Step 6: Run → pass** — `pnpm vitest run tests/curl.test.ts && pnpm typecheck`.

- [ ] **Step 7: Commit** — `git add -A && git commit -m "feat: curl/cf endpoints (/cf /tls /version /compression)"`

---

### Task 15: Docs catalog, /spec, docs page, README, end-to-end verify

**Files:**
- Create: `src/docs/catalog.ts`
- Create: `src/docs/page.tsx`
- Modify: `src/index.ts` (serve `/` and `/spec`)
- Modify: `README.md`

**Interfaces:**
- Produces (`catalog.ts`): `interface EndpointDoc { method: string; path: string; category: string; description: string; example: string }`; `CATALOG: EndpointDoc[]`; `CATEGORIES: string[]`; `renderExample(tpl: string, host: string): string`.
- Consumes (`page.tsx`): `CATALOG`, `CATEGORIES`, `renderExample`.

- [ ] **Step 1: Write `src/docs/catalog.ts`** (source of truth; `{{HOST}}` replaced at render)

```ts
export interface EndpointDoc {
  method: string
  path: string
  category: string
  description: string
  example: string
}

export function renderExample(tpl: string, host: string): string {
  return tpl.replaceAll('{{HOST}}', host)
}

export const CATEGORIES = [
  'Reflection', 'Status', 'Redirect', 'Cookies', 'Auth',
  'Streaming/Time', 'Format', 'Compression', 'Images', 'Cache',
  'Forms', 'WebSocket', 'curl / Cloudflare',
]

export const CATALOG: EndpointDoc[] = [
  { method: 'GET', path: '/get', category: 'Reflection', description: 'Echo query args, headers, origin, url.', example: 'curl {{HOST}}/get?a=1' },
  { method: 'POST', path: '/post', category: 'Reflection', description: 'Echo request body (data/form/json).', example: `curl -X POST {{HOST}}/post -d name=alice` },
  { method: 'PUT', path: '/put', category: 'Reflection', description: 'Echo a PUT request.', example: 'curl -X PUT {{HOST}}/put -d x=1' },
  { method: 'PATCH', path: '/patch', category: 'Reflection', description: 'Echo a PATCH request.', example: 'curl -X PATCH {{HOST}}/patch -d x=1' },
  { method: 'DELETE', path: '/delete', category: 'Reflection', description: 'Echo a DELETE request.', example: 'curl -X DELETE {{HOST}}/delete' },
  { method: 'ANY', path: '/anything', category: 'Reflection', description: 'Echo anything, including the method.', example: `curl -X FOO {{HOST}}/anything` },
  { method: 'GET', path: '/headers', category: 'Reflection', description: 'Return only request headers.', example: `curl -H 'X-Test: 1' {{HOST}}/headers` },
  { method: 'GET', path: '/ip', category: 'Reflection', description: 'Return the client IP (CF-Connecting-IP).', example: 'curl {{HOST}}/ip' },
  { method: 'GET', path: '/user-agent', category: 'Reflection', description: 'Return the User-Agent.', example: 'curl {{HOST}}/user-agent' },

  { method: 'ANY', path: '/status/:codes', category: 'Status', description: 'Return the given status (comma list = random). Test --retry / -w.', example: `curl -w '%{http_code}\\n' {{HOST}}/status/500` },

  { method: 'ANY', path: '/redirect/:n', category: 'Redirect', description: 'Redirect n times to /get. Test -L.', example: 'curl -L {{HOST}}/redirect/3' },
  { method: 'ANY', path: '/redirect-to', category: 'Redirect', description: 'Redirect to ?url= with ?status_code=.', example: `curl -L '{{HOST}}/redirect-to?url=/get&status_code=307'` },
  { method: 'ANY', path: '/relative-redirect/:n', category: 'Redirect', description: 'Relative Location redirects.', example: 'curl -L {{HOST}}/relative-redirect/2' },
  { method: 'ANY', path: '/absolute-redirect/:n', category: 'Redirect', description: 'Absolute Location redirects.', example: 'curl -L {{HOST}}/absolute-redirect/2' },

  { method: 'GET', path: '/cookies', category: 'Cookies', description: 'Reflect request cookies. Test -b.', example: `curl -b 'a=1' {{HOST}}/cookies` },
  { method: 'GET', path: '/cookies/set', category: 'Cookies', description: 'Set cookies from query, then redirect. Test -c.', example: `curl -c jar.txt -L '{{HOST}}/cookies/set?token=abc'` },
  { method: 'GET', path: '/cookies/delete', category: 'Cookies', description: 'Delete named cookies, then redirect.', example: `curl -b jar.txt -L '{{HOST}}/cookies/delete?token='` },

  { method: 'GET', path: '/basic-auth/:user/:pass', category: 'Auth', description: 'HTTP Basic auth. Test -u.', example: 'curl -u user:pass {{HOST}}/basic-auth/user/pass' },
  { method: 'GET', path: '/hidden-basic-auth/:user/:pass', category: 'Auth', description: 'Basic auth that 404s when unauthorized.', example: 'curl -u user:pass {{HOST}}/hidden-basic-auth/user/pass' },
  { method: 'GET', path: '/bearer', category: 'Auth', description: 'Bearer token auth. Test --oauth2-bearer.', example: 'curl --oauth2-bearer xyz {{HOST}}/bearer' },
  { method: 'GET', path: '/digest-auth/:qop/:user/:pass', category: 'Auth', description: 'Digest auth (SHA-256). Test --digest.', example: 'curl --digest -u user:pass {{HOST}}/digest-auth/auth/user/pass' },

  { method: 'ANY', path: '/delay/:n', category: 'Streaming/Time', description: 'Wait n seconds (≤10). Test --max-time.', example: 'curl --max-time 5 {{HOST}}/delay/3' },
  { method: 'GET', path: '/drip', category: 'Streaming/Time', description: 'Drip bytes over ?duration=&numbytes=. Test --limit-rate.', example: `curl '{{HOST}}/drip?duration=3&numbytes=30'` },
  { method: 'GET', path: '/stream/:n', category: 'Streaming/Time', description: 'Stream n ndjson lines.', example: 'curl {{HOST}}/stream/5' },
  { method: 'GET', path: '/stream-bytes/:n', category: 'Streaming/Time', description: 'Stream n random bytes chunked.', example: 'curl {{HOST}}/stream-bytes/2048 -o out.bin' },
  { method: 'GET', path: '/bytes/:n', category: 'Streaming/Time', description: 'Return n random bytes.', example: 'curl {{HOST}}/bytes/64 -o out.bin' },
  { method: 'GET', path: '/range/:n', category: 'Streaming/Time', description: 'Range-enabled n bytes (206). Test -r/--range.', example: `curl -r 0-99 {{HOST}}/range/1024 -o part.bin` },

  { method: 'GET', path: '/json', category: 'Format', description: 'Sample JSON document.', example: 'curl {{HOST}}/json' },
  { method: 'GET', path: '/html', category: 'Format', description: 'Sample HTML document.', example: 'curl {{HOST}}/html' },
  { method: 'GET', path: '/xml', category: 'Format', description: 'Sample XML document.', example: 'curl {{HOST}}/xml' },
  { method: 'GET', path: '/uuid', category: 'Format', description: 'Return a random UUID v4.', example: 'curl {{HOST}}/uuid' },
  { method: 'GET', path: '/base64/:val', category: 'Format', description: 'Decode a base64 value.', example: 'curl {{HOST}}/base64/aG9sYQ==' },
  { method: 'GET', path: '/encoding/utf8', category: 'Format', description: 'UTF-8 sample page.', example: 'curl {{HOST}}/encoding/utf8' },
  { method: 'GET', path: '/robots.txt', category: 'Format', description: 'robots.txt disallowing /deny.', example: 'curl {{HOST}}/robots.txt' },
  { method: 'GET', path: '/deny', category: 'Format', description: 'Page disallowed by robots.txt.', example: 'curl {{HOST}}/deny' },

  { method: 'GET', path: '/gzip', category: 'Compression', description: 'gzip-encoded response. Test --compressed.', example: 'curl --compressed {{HOST}}/gzip' },
  { method: 'GET', path: '/deflate', category: 'Compression', description: 'deflate-encoded response. Test --compressed.', example: 'curl --compressed {{HOST}}/deflate' },

  { method: 'GET', path: '/image', category: 'Images', description: 'Image negotiated via Accept (png or svg).', example: `curl -H 'Accept: image/svg+xml' {{HOST}}/image -o img.svg` },
  { method: 'GET', path: '/image/png', category: 'Images', description: 'PNG image.', example: 'curl {{HOST}}/image/png -o img.png' },
  { method: 'GET', path: '/image/svg', category: 'Images', description: 'SVG image.', example: 'curl {{HOST}}/image/svg -o img.svg' },

  { method: 'GET', path: '/cache', category: 'Cache', description: 'ETag/Last-Modified; 304 on conditional GET. Test -z.', example: `curl -H 'If-None-Match: "stellar-debris-v1"' {{HOST}}/cache` },
  { method: 'GET', path: '/cache/:n', category: 'Cache', description: 'Set Cache-Control max-age=n.', example: 'curl -i {{HOST}}/cache/60' },
  { method: 'GET', path: '/etag/:etag', category: 'Cache', description: 'Serve a specific ETag; 304 on match.', example: `curl -H 'If-None-Match: "abc"' {{HOST}}/etag/abc` },
  { method: 'ANY', path: '/response-headers', category: 'Cache', description: 'Echo query params into response headers.', example: `curl -i '{{HOST}}/response-headers?X-Foo=bar'` },

  { method: 'GET', path: '/forms/post', category: 'Forms', description: 'HTML form; POST reflects fields. Test -F.', example: `curl -F custname=alice {{HOST}}/forms/post` },

  { method: 'GET', path: '/websocket/echo', category: 'WebSocket', description: 'WebSocket echo (deployed / --remote only).', example: 'websocat wss://<host>/websocket/echo' },

  { method: 'GET', path: '/cf', category: 'curl / Cloudflare', description: 'Full request.cf dump.', example: 'curl {{HOST}}/cf' },
  { method: 'GET', path: '/tls', category: 'curl / Cloudflare', description: 'Negotiated TLS version + cipher. Test --tlsv1.3.', example: 'curl --tlsv1.3 {{HOST}}/tls' },
  { method: 'GET', path: '/version', category: 'curl / Cloudflare', description: 'Negotiated HTTP protocol. Test --http2/--http3.', example: 'curl --http3 {{HOST}}/version' },
  { method: 'GET', path: '/compression', category: 'curl / Cloudflare', description: 'Reflect Accept-Encoding (br/zstd note).', example: `curl -H 'Accept-Encoding: zstd,br,gzip' {{HOST}}/compression` },
]
```

- [ ] **Step 2: Write `src/docs/page.tsx`** (Cloudflare-styled, inline CSS + inline copy JS)

```tsx
import type { FC } from 'hono/jsx'
import { CATALOG, CATEGORIES, renderExample, type EndpointDoc } from './catalog'

const METHOD_COLORS: Record<string, string> = {
  GET: '#3b82f6', POST: '#22c55e', PUT: '#f59e0b', PATCH: '#a855f7',
  DELETE: '#ef4444', ANY: '#64748b',
}

const Card: FC<{ ep: EndpointDoc; host: string }> = ({ ep, host }) => (
  <div class="card">
    <div class="row">
      <span class="method" style={`background:${METHOD_COLORS[ep.method] ?? '#64748b'}`}>{ep.method}</span>
      <code class="path">{ep.path}</code>
    </div>
    <p class="desc">{ep.description}</p>
    <div class="code">
      <button class="copy" type="button">Copy</button>
      <pre>{renderExample(ep.example, host)}</pre>
    </div>
  </div>
)

export const DocsPage: FC<{ host: string; env: 'dev' | 'prod' }> = ({ host, env }) => {
  const style = `
:root{color-scheme:light dark}
*{box-sizing:border-box}
body{margin:0;font-family:Inter,system-ui,-apple-system,sans-serif;background:#0b0b0d;color:#e6e6e6;line-height:1.5}
@media (prefers-color-scheme:light){body{background:#faf9f7;color:#1a1a1a}.card{background:#fff;border-color:#e5e2dc}.code pre{background:#f4f2ee}.path{color:#111}}
header{padding:40px 24px 20px;border-bottom:1px solid #26262b;max-width:960px;margin:0 auto}
h1{margin:0;font-size:26px}
.accent{color:#F6821F}
.sub{opacity:.7;margin:6px 0 0;font-size:14px}
.badge{display:inline-block;margin-top:12px;padding:3px 10px;border-radius:999px;font-size:12px;background:#F6821F22;color:#F6821F;border:1px solid #F6821F55}
main{max-width:960px;margin:0 auto;padding:24px}
h2{font-size:14px;text-transform:uppercase;letter-spacing:.08em;opacity:.6;margin:32px 0 12px}
.card{border:1px solid #26262b;border-radius:12px;padding:16px;margin:10px 0;background:#141418}
.row{display:flex;align-items:center;gap:10px}
.method{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;color:#fff}
.path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:14px}
.desc{margin:8px 0;opacity:.8;font-size:14px}
.code{position:relative}
.code pre{background:#1c1c22;padding:12px 14px;border-radius:8px;overflow-x:auto;font-size:13px;margin:0}
.copy{position:absolute;top:8px;right:8px;background:#F6821F;color:#111;border:0;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:600}
a{color:#F6821F}
`
  const script = `
document.querySelectorAll('.copy').forEach(function(b){
  b.addEventListener('click',function(){
    var t=b.parentElement.querySelector('pre').innerText;
    navigator.clipboard.writeText(t).then(function(){b.textContent='Copied';setTimeout(function(){b.textContent='Copy'},1200)});
  });
});
`
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>stellar-debris · httpbin + static-curl playground</title>
        <style dangerouslySetInnerHTML={{ __html: style }} />
      </head>
      <body>
        <header>
          <h1>stellar<span class="accent">-</span>debris</h1>
          <p class="sub">httpbin-compatible HTTP testing + a <span class="accent">static-curl</span> feature playground, on Cloudflare Workers.</p>
          <span class="badge">{env === 'dev' ? 'local dev — request.cf values are mocked' : 'production — real TLS/HTTP data'}</span>
        </header>
        <main>
          <p class="sub">Examples target <code>{host}</code>. See <a href="/spec">/spec</a> for JSON.</p>
          {CATEGORIES.map((cat) => (
            <section>
              <h2>{cat}</h2>
              {CATALOG.filter((e) => e.category === cat).map((ep) => (
                <Card ep={ep} host={host} />
              ))}
            </section>
          ))}
        </main>
        <script dangerouslySetInnerHTML={{ __html: script }} />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: Serve `/` and `/spec` in `src/index.ts`** — add imports at top and routes AFTER all other `app.route(...)` mounts (so specific paths win; `/` is exact-match so order is safe, but keep `/spec` before any catch-all — there is none):

```ts
import { DocsPage } from './docs/page'
import { CATALOG, renderExample } from './docs/catalog'

// ...after all app.route('/', ...) mounts:
app.get('/', (c) => {
  const host = new URL(c.req.url).origin
  const env = host.includes('localhost') || host.includes('127.0.0.1') ? 'dev' : 'prod'
  return c.html(<DocsPage host={host} env={env} />)
})

app.get('/spec', (c) => {
  const host = new URL(c.req.url).origin
  return c.json({
    host,
    endpoints: CATALOG.map((e) => ({ ...e, example: renderExample(e.example, host) })),
  })
})
```

- [ ] **Step 4: Add docs smoke test to `tests/smoke.test.ts`**

```ts
  it('/ serves the docs page', async () => {
    const res = await app.request('/')
    expect(res.headers.get('content-type')).toContain('text/html')
    expect(await res.text()).toContain('stellar')
  })
  it('/spec lists endpoints', async () => {
    const res = await app.request('/spec')
    const body = await res.json() as any
    expect(Array.isArray(body.endpoints)).toBe(true)
    expect(body.endpoints.length).toBeGreaterThan(30)
  })
```

- [ ] **Step 5: Run full suite + typecheck**

Run: `pnpm test && pnpm typecheck`
Expected: all tests pass; no TS errors.

- [ ] **Step 6: Update `README.md`** — replace content with:

```md
# stellar-debris

An httpbin-compatible HTTP testing service + a `static-curl` feature playground, built on Cloudflare Workers (Hono).

## Develop

```txt
pnpm install
pnpm dev        # http://localhost:8787  — docs at /
pnpm test       # vitest
pnpm typecheck  # tsc --noEmit
```

## Deploy

```txt
pnpm deploy
```

Open `/` for the endpoint catalog with copy-paste `curl` examples, or `GET /spec` for JSON.
`request.cf`-backed endpoints (`/cf`, `/tls`, `/version`) show real TLS/HTTP data only once deployed.
```

- [ ] **Step 7: End-to-end manual verification**

Run: `pnpm dev` (background), then in another shell:
```bash
curl -s http://localhost:8787/get?a=1 | head
curl -s -X POST http://localhost:8787/post -d hello=world | head
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8787/status/418
curl -s -r 0-99 http://localhost:8787/range/1024 -o /dev/null -w '%{size_download}\n'   # expect 100
curl -s --compressed http://localhost:8787/gzip | head
curl -s http://localhost:8787/version
curl -s http://localhost:8787/spec | head
```
Expected: reflection JSON, 418, 100-byte range body, decompressed gzip JSON, version JSON, spec JSON. Stop the dev server afterward.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: docs page, /spec catalog, README, end-to-end wiring"
```

---

## Self-Review

**Spec coverage:** Every spec §5 category maps to a task (reflect→T2, status→T3, redirect→T4, cookies→T5, auth+digest→T6, streaming/range→T7, format→T8, compression→T9, images→T10 [jpeg/webp deferred, documented], cache→T11, forms→T12, websocket→T13, curl/cf→T14, docs+/spec→T15). §6 platform limits are honored: gzip/deflate only (T9), request.cf fallbacks (T14), websocket note (T13), image scope note (T10). §7 docs aesthetic → T15. §8 tests → per-task Vitest via `app.request()`.

**Deviations from spec (intentional, flagged):**
1. digest-auth uses **SHA-256** not MD5 (Workers lack MD5). static-curl `--digest` negotiates SHA-256 fine.
2. `/image/jpeg` and `/image/webp` **deferred** (cannot generate valid bytes without a dep). png+svg cover Accept testing.

**Placeholder scan:** No TBD/TODO; all steps contain runnable code and exact commands.

**Type consistency:** `Env` defined once in `index.ts`, imported everywhere. `buildReflection(c, extra?)` signature consistent across T2/T7/T9/T11/T12. `cfInfo(cf)` consistent T14. `EndpointDoc`/`renderExample` consistent T15.
