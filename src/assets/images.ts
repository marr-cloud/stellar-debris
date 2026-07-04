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
