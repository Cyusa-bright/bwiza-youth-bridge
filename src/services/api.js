import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  timeout: 10000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let csrfToken = null
let csrfRefreshInProgress = null

api.interceptors.request.use(async (config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method) && !config.url?.endsWith('/auth/csrf')) {
    if (!csrfToken) {
      csrfRefreshInProgress ||= api.get('/auth/csrf').then((response) => {
        csrfToken = response.data.csrfToken
        return csrfToken
      }).finally(() => { csrfRefreshInProgress = null })
      await csrfRefreshInProgress
    }
    config.headers['X-CSRF-Token'] = csrfToken
  }
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    config.headers.delete('Content-Type')
  }
  return config
})

api.interceptors.response.use((response) => {
  if (response.data?.csrfToken) csrfToken = response.data.csrfToken
  return response
})

api.interceptors.response.use(undefined, async (error) => {
  const request = error.config
  if (error.response?.status === 401 &&
      !/\/auth\/(login|register)$/.test(request?.url || '') &&
      typeof window !== 'undefined') {
    window.dispatchEvent(new Event('byb:session-expired'))
  }
  if (error.response?.status === 403 &&
      error.response.data?.error?.code === 'CSRF_INVALID' &&
      request && !request._csrfRetried) {
    csrfToken = null
    request._csrfRetried = true
    return api(request)
  }
  return Promise.reject(error)
})

export function clearCsrfToken() {
  csrfToken = null
}

export async function getResource(path, config) {
  const response = await api.get(path, config)
  return response.data
}
