import { hc } from 'hono/client'
import type { AppType } from 'api'

export const apiClient = hc<AppType>(import.meta.env.VITE_API_URL)
