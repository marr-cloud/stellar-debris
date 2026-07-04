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
        <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Ctext y='.9em' font-size='90'%3E🛰️%3C/text%3E%3C/svg%3E" />
        <meta name="theme-color" content="#F6821F" />
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
