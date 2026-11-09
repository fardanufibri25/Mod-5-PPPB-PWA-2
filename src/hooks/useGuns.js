import { useState, useEffect, useCallback } from 'react'
import gunService from '../services/gunService'

// ---------------------------------------------------------------------------
// Query cache — in-memory Map with a 60s TTL.
//
// Concept: re-opening the catalog within the TTL reuses the cached page
// instead of hitting the API again (no duplicate request, instant render).
// `refetch()` bypasses/clears the cache for a fresh read.
// ---------------------------------------------------------------------------
const cache = new Map()
const STALE_TIME = 60_000 // 1 minute
const GC_TIME = 5 * 60_000 // entries older than this are dropped

const readCache = (key) => {
  const entry = cache.get(key)
  if (!entry) return null
  if (Date.now() - entry.timestamp > GC_TIME) {
    cache.delete(key)
    return null
  }
  return entry
}

// Call after create/edit/delete so the catalog does not serve stale pages.
export const clearGunsCache = () => cache.clear()

export function useGuns(params = {}) {
  const key = JSON.stringify(params)

  const [guns, setGuns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState(null)

  const fetchGuns = useCallback(
    async (force = false) => {
      const cached = readCache(key)
      if (!force && cached && Date.now() - cached.timestamp < STALE_TIME) {
        setGuns(cached.data.guns)
        setPagination(cached.data.pagination)
        setError(null)
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const response = await gunService.getGuns(JSON.parse(key))

        if (response.success) {
          const data = {
            guns: response.data || [],
            pagination: response.pagination || null,
          }
          cache.set(key, { data, timestamp: Date.now() })
          setGuns(data.guns)
          setPagination(data.pagination)
        } else {
          throw new Error(response.message || 'Failed to fetch products.')
        }
      } catch (err) {
        setError(err.message || 'An error occurred while fetching products.')
        setGuns([])
        setPagination(null)
      } finally {
        setLoading(false)
      }
    },
    [key],
  )

  useEffect(() => {
    fetchGuns()
  }, [fetchGuns])

  const refetch = useCallback(() => {
    cache.delete(key)
    return fetchGuns(true)
  }, [key, fetchGuns])

  return { guns, loading, error, pagination, refetch }
}
