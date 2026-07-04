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
