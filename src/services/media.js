export function imageUrl(value) {
  if (typeof value !== 'string' || !value.startsWith('/api/v1/uploads/')) return value || ''
  const apiBase = import.meta.env.VITE_API_BASE_URL
  if (!apiBase) return value
  return `${apiBase.replace(/\/$/, '')}${value.slice('/api/v1'.length)}`
}
