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
