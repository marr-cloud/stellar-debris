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
