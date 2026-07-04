import { Hono } from 'hono'
import type { Env } from '../index'
import { pngBytes, svgSample } from '../assets/images'

const image = new Hono<Env>()

const png = (c: import('hono').Context<Env>) =>
  c.body(pngBytes() as any, 200, { 'content-type': 'image/png' })
const svg = (c: import('hono').Context<Env>) =>
  c.body(svgSample(), 200, { 'content-type': 'image/svg+xml' })

image.get('/image/png', png)
image.get('/image/svg', svg)
image.get('/image', (c) => {
  const accept = c.req.header('accept') ?? ''
  return accept.includes('image/svg') ? svg(c) : png(c)
})

export default image
