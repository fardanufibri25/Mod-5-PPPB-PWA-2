import axios from 'axios'

// ---------------------------------------------------------------------------
// Base URL & Supabase Key Configuration
// Read from environment variables (.env)
// ---------------------------------------------------------------------------
const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''
const SUPABASE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  ''

const IS_SUPABASE = BASE_URL.includes('supabase.co') || Boolean(SUPABASE_KEY)

if (!BASE_URL) {
  console.warn(
    '[api] VITE_API_BASE_URL is not set. API requests will use relative paths.',
  )
}

const headers = {
  'Content-Type': 'application/json',
}
if (SUPABASE_KEY) {
  headers.apikey = SUPABASE_KEY
  headers.Authorization = `Bearer ${SUPABASE_KEY}`
}

// Normal client — response interceptor unwraps `response.data`.
const apiClient = axios.create({ baseURL: BASE_URL, headers, timeout: 10000 })

// Raw client — returns the full Axios response so callers can read headers
// such as `Content-Range` for pagination totals.
const apiClientRaw = axios.create({ baseURL: BASE_URL, headers, timeout: 10000 })

apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    let message = 'An unexpected error occurred'
    let status = null

    if (error.response) {
      status = error.response.status
      message =
        error.response.data?.message ||
        error.response.data?.msg ||
        error.response.data?.error ||
        error.response.data?.error_description ||
        `Server error (${status})`
    } else if (error.request) {
      message =
        'Unable to reach the server. Check your connection and try again.'
    } else {
      message = error.message || message
    }

    return Promise.reject({
      message,
      status,
      code: error.response?.data?.code,
      raw: error.response?.data,
    })
  },
)

apiClientRaw.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
)

export { apiClient, apiClientRaw, BASE_URL, SUPABASE_KEY, IS_SUPABASE }
