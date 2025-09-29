import { serve } from '@hono/node-server'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.post('/process-exhibition-data', async (c) => {
  const body = await c.req.json()
  console.log(body)
  return c.json({ message: 'Entry received', data: body })
})

const port = process.env.PORT !== undefined ? parseInt(process.env.PORT) : 8080
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`)
  },
)
