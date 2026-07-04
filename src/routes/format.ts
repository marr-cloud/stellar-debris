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
