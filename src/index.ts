import 'dotenv/config'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import type { Context } from 'hono'
import health from './routes/health.js'
import exhibition from './routes/exhibition.js'
import { AppError } from './errors/app-error.js'

const app = new Hono()

// Global error handler
app.onError((err, c: Context) => {
  console.error('Error:', err)

  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: err.message,
        code: err.code,
      },
      err.statusCode as 400 | 404 | 500 | 502,
    )
  }

  // Unknown errors
  return c.json(
    {
      success: false,
      error: 'Internal server error',
      message: err.message,
    },
    500 as const,
  )
})

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
