import { Hono } from 'hono'
import type { Env } from '../index'
import { buildReflection, headersToObject } from '../lib/reflect'

const reflect = new Hono<Env>()

const reflectHandler = async (c: import('hono').Context<Env>) =>
  c.json(await buildReflection(c))

reflect.get('/get', reflectHandler)
reflect.post('/post', reflectHandler)
reflect.put('/put', reflectHandler)
reflect.patch('/patch', reflectHandler)
reflect.delete('/delete', reflectHandler)

reflect.all('/anything', async (c) => c.json(await buildReflection(c, { method: c.req.method })))
reflect.all('/anything/*', async (c) => c.json(await buildReflection(c, { method: c.req.method })))

reflect.get('/headers', (c) => c.json({ headers: headersToObject(c.req.raw.headers) }))
reflect.get('/ip', (c) => c.json({
  origin: c.req.raw.headers.get('cf-connecting-ip') ?? c.req.raw.headers.get('x-forwarded-for') ?? '',
}))
reflect.get('/user-agent', (c) => c.json({ 'user-agent': c.req.header('user-agent') ?? '' }))

export default reflect
