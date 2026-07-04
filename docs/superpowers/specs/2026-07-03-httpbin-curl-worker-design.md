# Diseño: `stellar-debris` — httpbin + playground de static-curl (Cloudflare Worker)

- **Fecha:** 2026-07-03
- **Estado:** Aprobado (diseño), pendiente plan de implementación
- **Autor:** Mauricio + Claude

## 1. Propósito

Un Cloudflare Worker que combina un clon del comportamiento de [httpbin.io](https://httpbin.io/) con un
conjunto de endpoints pensados para **ejercitar las capacidades de [stunnel/static-curl](https://github.com/stunnel/static-curl)**
(curl compilado estáticamente con HTTP/2, HTTP/3, brotli, zstd, TLS 1.3, etc.).

Es una **herramienta personal de pruebas**: el flujo principal es correr `curl` real desde la terminal
contra el Worker. La página web es documentación estática (no hace llamadas en vivo) con estética
Cloudflare y ejemplos `curl` copiables.

### Criterios de éxito

1. `pnpm dev` levanta el Worker y todos los endpoints responden.
2. La raíz `/` sirve una página de docs con estética Cloudflare que lista **todos** los endpoints por
   categoría, cada uno con un ejemplo `curl` copiable cuyo host se autocompleta con el host actual.
3. `/spec` devuelve el catálogo de endpoints en JSON (misma fuente que la página de docs).
4. Los endpoints de reflexión devuelven JSON con la forma de httpbin (`args`, `headers`, `origin`, `url`, `data`, `json`, `method`).
5. Los endpoints "curl" (`/cf`, `/tls`, `/version`, `/compression`) reflejan datos reales de `request.cf`.
6. Tests con Vitest (`app.request()` de Hono) verdes: status, forma JSON, redirecciones, 206 en `/range`, `Content-Encoding: gzip`.
7. `pnpm exec tsc --noEmit` sin errores de tipos.

## 2. Alcance

**Dentro:** ~50 endpoints (ver §5), página de docs, `/spec` JSON, `/websocket/echo`, tests ligeros.

**Fuera (YAGNI):** panel "try it" interactivo en el navegador, DNS-over-HTTPS, streaming server-sent
events avanzado, generación real de brotli/zstd (imposible en runtime — ver §6), paridad 100% con httpbin.

## 3. Stack (ya presente)

- Cloudflare Worker + **Hono** 4.12, TypeScript, `wrangler` 4.107, `compatibility_date` 2026-05-26.
- `hono/jsx` ya configurado en `tsconfig.json` → la página de docs se renderiza con JSX, **sin dependencias extra**.
- Gestor de paquetes: **pnpm**.
- Sin dependencias nuevas de runtime. Dev: añadir `vitest`.

## 4. Arquitectura y archivos

`catalog.ts` es la **fuente única de verdad**: de él se generan tanto la página de docs como `/spec`.
Cada router es pequeño y enfocado (una responsabilidad, testeable en aislamiento).

```
src/
  index.ts             # crea app Hono<{Bindings}>, monta routers, sirve "/" (docs) y "/spec"
  lib/
    reflect.ts         # buildReflection(c): arma el JSON estilo httpbin
    curl.ts            # cfInfo(request): request.cf -> {tlsVersion, tlsCipher, httpProtocol, colo, country, ...}
    digest.ts          # helpers digest-auth (challenge, verificación RFC 2617/7616)
  assets/
    images.ts          # PNG/JPEG/WEBP de muestra como constantes base64 (pequeñas)
  routes/
    reflect.ts         # /get /post /put /patch /delete /anything(/*) /headers /ip /user-agent
    status.ts          # /status/:codes
    redirect.ts        # /redirect/:n /redirect-to /relative-redirect/:n /absolute-redirect/:n
    cookies.ts         # /cookies /cookies/set /cookies/set/:name/:value /cookies/delete
    auth.ts            # /basic-auth/:u/:p /hidden-basic-auth/:u/:p /bearer /digest-auth/:qop/:u/:p
    stream.ts          # /delay/:n /drip /stream/:n /stream-bytes/:n /bytes/:n /range/:n
    format.ts          # /json /html /xml /uuid /base64/:val /encoding/utf8 /robots.txt /deny
    compress.ts        # /gzip /deflate  (Content-Encoding real vía CompressionStream)
    image.ts           # /image /image/png /image/jpeg /image/webp /image/svg
    cache.ts           # /cache /cache/:n /etag/:etag /response-headers
    forms.ts           # /forms/post (GET devuelve form HTML; POST refleja como /post)
    websocket.ts       # /websocket/echo (WebSocketPair)
    curl.ts            # /cf /tls /version /compression   <-- ángulo static-curl
  docs/
    catalog.ts         # array de {method, path, category, description, curlExample(host)} — fuente única
    page.tsx           # componente JSX de la página de docs
tests/
  reflect.test.ts, status.test.ts, redirect.test.ts, range.test.ts, compress.test.ts, curl.test.ts
docs/superpowers/specs/2026-07-03-httpbin-curl-worker-design.md   # este documento
```

### Forma de reflexión (compat httpbin)

`buildReflection(c)` devuelve:

```jsonc
{
  "args":    { /* query params */ },
  "headers": { /* headers de la petición */ },
  "origin":  "<CF-Connecting-IP>",
  "url":     "<url absoluta>",
  "method":  "GET",           // presente en /anything
  "data":    "<body crudo>",  // en POST/PUT/PATCH/DELETE
  "form":    { /* si content-type es form-urlencoded/multipart */ },
  "files":   { /* multipart */ },
  "json":    null             // body parseado si es JSON, si no null
}
```

## 5. Catálogo de endpoints (~50)

| Categoría | Endpoints | Flag(s) curl que ejercita |
|---|---|---|
| Reflexión | `/get` `/post` `/put` `/patch` `/delete` `/anything(/*)` `/headers` `/ip` `/user-agent` | `-X` `-H` `-d` `-F` |
| Estado | `/status/:codes` (soporta lista y rangos aleatorios, p.ej. `200,500` o `random`) | `--retry` `-w '%{http_code}'` |
| Redirección | `/redirect/:n` `/redirect-to?url=&status_code=` `/relative-redirect/:n` `/absolute-redirect/:n` | `-L` `--max-redirs` |
| Cookies | `/cookies` `/cookies/set?k=v` `/cookies/set/:name/:value` `/cookies/delete?k=` | `-b` `-c` |
| Auth | `/basic-auth/:u/:p` `/hidden-basic-auth/:u/:p` `/bearer` `/digest-auth/:qop/:u/:p` | `-u` `--digest` `--oauth2-bearer` |
| Streaming/tiempo | `/delay/:n` `/drip?duration=&numbytes=&code=` `/stream/:n` `/stream-bytes/:n` `/bytes/:n` `/range/:n` | `--max-time` `--limit-rate` `-r`/`--range` |
| Formato | `/json` `/html` `/xml` `/uuid` `/base64/:val` `/encoding/utf8` `/robots.txt` `/deny` | — |
| Compresión | `/gzip` `/deflate` | `--compressed` |
| Imágenes | `/image` (según `Accept`) `/image/png` `/image/jpeg` `/image/webp` `/image/svg` | `-H 'Accept: image/*'` |
| Cache | `/cache` (304 si `If-Modified-Since`/`If-None-Match`) `/cache/:n` (max-age) `/etag/:etag` `/response-headers?k=v` | `-z` `-H 'If-None-Match'` |
| Forms | `/forms/post` | `-F` |
| WebSocket | `/websocket/echo` | curl ws (`--include ws://…` / soporte ws de static-curl) |
| **curl/CF** | `/cf` `/tls` `/version` `/compression` | `--http2` `--http3` `--tlsv1.3` `--ciphers` `--compressed` |
| Meta | `/` (docs) `/spec` (catálogo JSON) | — |

### Detalles de endpoints no triviales

- **`/status/:codes`**: acepta un código, lista separada por comas (elige aleatorio), o `random`. Para 3xx no sigue; para 401/407 añade cabeceras `WWW-Authenticate`/`Proxy-Authenticate` como httpbin.
- **`/range/:n`**: soporta cabecera `Range: bytes=a-b` → responde **206** con `Content-Range` y `Accept-Ranges: bytes`; sin `Range` responde 200 con `n` bytes deterministas.
- **`/gzip`, `/deflate`**: comprimen el JSON de reflexión con `CompressionStream('gzip'|'deflate')` y ponen `Content-Encoding` correcto. `curl --compressed` debe descomprimir transparentemente.
- **`/digest-auth/:qop/:u/:p`**: implementa el reto/respuesta Digest (MD5, qop=auth). Primer request → 401 con `WWW-Authenticate: Digest …`; con credenciales válidas → 200.
- **`/cf`**: vuelca `request.cf` completo (útil para ver todo lo que Cloudflare expone).
- **`/tls`**: `{ tls_version, cipher, sni, client_random?, verified }` desde `request.cf`.
- **`/version`**: `{ http_protocol }` (HTTP/1.1, HTTP/2, HTTP/3) + eco del `Host`/`:authority`.
- **`/compression`**: `{ accept_encoding, negotiated_content_encoding, note }` — refleja lo que static-curl ofreció y lo que el edge negoció; explica el límite brotli/zstd.
- **`/websocket/echo`**: si hay header `Upgrade: websocket`, crea `WebSocketPair` y hace echo de cada mensaje; si no, 426 con instrucciones.

## 6. Límites de la plataforma (documentados en la UI, sin humo)

- **brotli / zstd:** `CompressionStream` del runtime solo soporta `gzip`/`deflate`/`deflate-raw`. **No** se implementan `/brotli` ni `/zstd` con encoding real. `/compression` refleja el `Accept-Encoding` de static-curl y el `Content-Encoding` que negocie el edge de Cloudflare (que sí soporta br/zstd en producción). Se marca claramente.
- **`request.cf` (TLS/HTTP reales):** valores completos y verídicos **solo desplegado**. En `wrangler dev` local son parciales/mock y `httpProtocol` será `HTTP/1.1`. La UI muestra un aviso dev/prod según el host.
- **HTTP/3:** no se puede forzar desde el Worker; lo negocia el edge cuando haces `curl --http3` contra la URL `*.workers.dev`. `/version` lo refleja.
- **`/websocket/echo`:** el upgrade WS funciona desplegado o en `wrangler dev --remote`; en dev puramente local el comportamiento puede variar. Se indica en docs.
- **Imágenes png/jpeg/webp:** no se generan en runtime; se sirven muestras pequeñas incrustadas en base64 (`assets/images.ts`). `/image/svg` sí se genera inline.

## 7. Página de docs (estética Cloudflare)

- Renderizada con `hono/jsx` en `docs/page.tsx`, alimentada por `docs/catalog.ts`.
- **Estética:** fondo limpio con soporte claro/oscuro (`prefers-color-scheme`), acento naranja Cloudflare `#F6821F`, tipografía system-ui/Inter. Header con título del proyecto + badge de entorno (dev/prod detectado por host).
- **Layout:** endpoints agrupados por categoría en tarjetas. Cada tarjeta: badge de método (color por verbo), path monoespaciado, descripción, y un bloque de código `curl` con **botón "Copiar"**.
- **JS:** mínimo, inline (solo copy-to-clipboard). Sin frameworks, sin CDNs externos.
- Los ejemplos `curl` se construyen con `new URL(c.req.url).origin`, así que el host es correcto en dev y prod automáticamente.
- Incluye una sección introductoria con la **tabla flag static-curl → endpoint** (§5).

## 8. Estrategia de pruebas

- **Vitest** con `app.request()` de Hono (sin red, sin `@cloudflare/vitest-pool-workers`).
- Casos:
  - `/get` devuelve args/headers/origin/url correctos.
  - `/post` con JSON refleja `json` y `data`.
  - `/status/418` → 418.
  - `/redirect/3` → 302 con `Location` correcto.
  - `/range/1024` con `Range: bytes=0-99` → 206 + `Content-Range`.
  - `/gzip` → header `Content-Encoding: gzip` y cuerpo descomprimible.
  - `/cf` con `cf` mockeado → refleja los campos.
- Objetivo: verde en `pnpm test`; no cobertura exhaustiva (herramienta personal).

## 9. Plan de implementación (resumen para writing-plans)

Orden sugerido, cada paso verificable:
1. Infra: instalar `vitest`, scripts, `lib/reflect.ts`, `lib/curl.ts`, montar routers vacíos → `tsc` ok.
2. Reflexión + status + redirect + su tests.
3. Cookies + auth (basic/bearer/hidden) + digest + tests.
4. Streaming (`delay/drip/stream/bytes/range`) + tests de 206.
5. Formato + compresión (gzip/deflate) + tests.
6. Imágenes + cache/etag + forms.
7. WebSocket echo.
8. Router curl (`/cf /tls /version /compression`) + tests con mock cf.
9. `catalog.ts` + `/spec` + `docs/page.tsx` (docs con estética Cloudflare).
10. README actualizado + verificación end-to-end con `curl` real (`pnpm dev`).
