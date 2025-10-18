import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import health from './health.js'
import exhibition from './exhibition.js'

const app = new Hono()

app.route('/health', health)
app.route('/exhibition', exhibition)

const port = process.env.PORT !== undefined ? parseInt(process.env.PORT) : 8080

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server started on ${info.address}:${info.port}`)
  },
)
