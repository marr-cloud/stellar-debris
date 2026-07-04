# stellar-debris

An **httpbin-compatible** HTTP request/response testing service **plus a [`static-curl`](https://github.com/stunnel/static-curl) feature playground**, built on **Cloudflare Workers** (Hono + TypeScript).

Hit it from your terminal with `curl` to inspect exactly what your client sends, exercise HTTP features (redirects, auth, cookies, ranges, compression, streaming), and see the **real TLS version, cipher and HTTP protocol** your `curl` negotiated with Cloudflare's edge.

**Live:** https://curl.infraforge.cc · docs at [`/`](https://curl.infraforge.cc/) · JSON catalog at [`/spec`](https://curl.infraforge.cc/spec)

```bash
curl https://curl.infraforge.cc/get?hello=world
curl --http3 https://curl.infraforge.cc/version   # what protocol did curl negotiate?
curl --tlsv1.3 https://curl.infraforge.cc/tls      # real TLS version + cipher
```

---

## Quick start

```bash
pnpm install
pnpm dev          # http://localhost:8787  — open / for the docs
pnpm test         # vitest (49 tests)
pnpm typecheck    # tsc --noEmit
pnpm deploy       # publish to Cloudflare (custom domain curl.infraforge.cc)
```

- **`/`** — HTML docs (Cloudflare-styled) listing every endpoint with a copy-paste `curl` example whose host auto-fills from the URL you're viewing.
- **`/spec`** — the same catalog as JSON.

---

## Endpoint catalog

| Category | Endpoints |
|---|---|
| **Reflection** | `/get` `/post` `/put` `/patch` `/delete` `/anything(/*)` `/headers` `/ip` `/user-agent` |
| **Status** | `/status/:codes` (single, comma-list = random; `401`/`407` add auth headers) |
| **Redirect** | `/redirect/:n` `/redirect-to?url=&status_code=` `/relative-redirect/:n` `/absolute-redirect/:n` |
| **Cookies** | `/cookies` `/cookies/set?k=v` `/cookies/set/:name/:value` `/cookies/delete?k=` |
| **Auth** | `/basic-auth/:u/:p` `/hidden-basic-auth/:u/:p` `/bearer` `/digest-auth/:qop/:u/:p` (SHA-256) |
| **Streaming / time** | `/delay/:n` `/drip?duration=&numbytes=&code=` `/stream/:n` `/stream-bytes/:n` `/bytes/:n` `/range/:n` (206 + `Content-Range`) |
| **Format** | `/json` `/html` `/xml` `/uuid` `/base64/:val` `/encoding/utf8` `/robots.txt` `/deny` |
| **Compression** | `/gzip` `/deflate` (real `Content-Encoding`) |
| **Images** | `/image` (Accept-negotiated) `/image/png` `/image/svg` |
| **Cache** | `/cache` (304 on conditional GET) `/cache/:n` (max-age) `/etag/:etag` `/response-headers?k=v` |
| **Forms** | `/forms/post` |
| **WebSocket** | `/websocket/echo` |
| **curl / Cloudflare** | `/cf` `/tls` `/version` `/compression` |
| **Meta** | `/` (docs) `/spec` (JSON) `/healthz` |

Reflection endpoints return the httpbin shape: `{ args, headers, origin, url }`, plus `{ data, form, files, json }` for bodies, plus `method` on `/anything`.

---

## Testing `static-curl` features

`static-curl` is `curl` compiled statically with HTTP/2, HTTP/3, TLS 1.3, brotli, zstd, etc. Map its flags to endpoints:

| curl / static-curl flag | Endpoint that exercises it |
|---|---|
| `-X` method, `-H` header, `-d` / `-F` data | `/anything`, `/post`, `/headers` |
| `--retry`, `-w '%{http_code}'` | `/status/500`, `/status/200,500` |
| `-L` follow redirects, `--max-redirs` | `/redirect/3`, `/redirect-to` |
| `-u` basic, `--digest`, `--oauth2-bearer` | `/basic-auth`, `/digest-auth`, `/bearer` |
| `-b` / `-c` cookies | `/cookies/set`, `/cookies` |
| `-r` / `--range` | `/range/1024` → `206 Partial Content` |
| `--max-time`, `--limit-rate` | `/delay/3`, `/drip` |
| `--compressed` | `/gzip`, `/deflate` |
| `--http2` / `--http3` | `/version` → reflects `httpProtocol` |
| `--tlsv1.3`, `--ciphers` | `/tls` → reflects `tlsVersion` + `tlsCipher` |

```bash
BASE=https://curl.infraforge.cc
curl -r 0-99 "$BASE/range/1024" -o part.bin      # 100-byte partial (206)
curl --compressed "$BASE/gzip"                    # transparently decompressed JSON
curl --http3 "$BASE/version"                      # {"http_protocol":"HTTP/3", ...}
curl --digest -u user:pass "$BASE/digest-auth/auth/user/pass"
```

---

## Deploy

```bash
pnpm deploy        # wrangler deploy --minify
```

Served on the custom domain **`curl.infraforge.cc`**, configured in `wrangler.jsonc`:

```jsonc
"routes": [{ "pattern": "curl.infraforge.cc", "custom_domain": true }]
```

Cloudflare provisions the DNS record and edge certificate automatically (the zone must be on your Cloudflare account). To also keep the `*.workers.dev` URL, add `"workers_dev": true`.

---

## Notes & platform limits (honest)

- **`request.cf` data (`/cf`, `/tls`, `/version`) is real only when deployed.** Under `wrangler dev` the values are mocked and `httpProtocol` is `HTTP/1.1`. Deployed, `curl --tlsv1.3 …/tls` returns the genuine `{tls_version, cipher}` and `curl --http3 …/version` the negotiated protocol. (Your `curl` build must actually support the flag — some Windows/Schannel builds lack `--http2`/`--http3`; static-curl includes them.)
- **`/gzip` & `/deflate` set `Content-Encoding` via `encodeBody: 'manual'`** so the Cloudflare edge preserves the header instead of stripping/re-encoding it; `curl --compressed` decompresses correctly in both `wrangler dev` and production. (Verified against the deployed Worker.)
- **brotli / zstd:** the Workers runtime's `CompressionStream` only produces gzip/deflate, so those two are implemented natively. The Cloudflare edge additionally compresses regular JSON responses with **br/zstd** when your `Accept-Encoding` asks for it — so `curl -H 'Accept-Encoding: zstd' …/get` returns zstd bytes (add `--compressed` to decompress). `/compression` explains this and is itself served **uncompressed** (via `encodeBody: 'manual'` + `no-transform`) so it always prints as text.
- **`/websocket/echo`:** the WS upgrade works when deployed or under `wrangler dev --remote`; a plain `curl` on it returns `426`.
- **Images:** `/image/png` (a 1×1 PNG) and `/image/svg` (generated) cover `Accept`-negotiation testing; jpeg/webp are not generated in-runtime.
- **digest-auth** advertises `algorithm=SHA-256` (Workers `crypto.subtle` has no MD5); `curl --digest` negotiates it automatically.

---

## Stack

Cloudflare Workers · [Hono](https://hono.dev) 4 · TypeScript · `hono/jsx` for the docs page · Vitest (via Hono `app.request()`) · Wrangler · pnpm. Only runtime dependency: `hono`.
