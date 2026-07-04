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
