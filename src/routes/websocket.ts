import { Hono } from 'hono'
import type { Env } from '../index'

const ws = new Hono<Env>()

ws.get('/websocket/echo', (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') {
    return c.text('Expected WebSocket upgrade. Try: websocat wss://<host>/websocket/echo', 426)
  }
  const pair = new WebSocketPair()
  const client = pair[0]
  const server = pair[1]
  server.accept()
  server.addEventListener('message', (event) => {
    server.send(event.data)
  })
  server.addEventListener('close', () => server.close())
  return new Response(null, { status: 101, webSocket: client })
})

export default ws
