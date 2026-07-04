import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  console.log("Hello Hono!")
  return c.text('Hello Hono!')
})

export default app
