import { useState, useEffect, useCallback } from 'react'
import favoriteService from '../services/favoriteService'
import { getUserIdentifier } from '../services/userService'

// ---------------------------------------------------------------------------
// localStorage fallback — used when the backend is unavailable so that
// favourites are still fully functional offline.
// ---------------------------------------------------------------------------

const LOCAL_KEY = 'bore_barrel_favorites'

const readLocalFavs = () => {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

const writeLocalFavs = (ids) => {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(ids))
  } catch {
    /* quota exceeded — silently fail */
  }
}

// One shared request/cache for every FavoriteButton on the page.
// Without this each card fires its own /favorites request (9 cards = 9 calls).
// shortcut: single browser user; key by userIdentifier if multi-user matters.
let favCache = null
let favPromise = null

const loadFavorites = (userIdentifier, force = false) => {
  if (!force && favCache) return Promise.resolve(favCache)
  if (!force && favPromise) return favPromise

  favPromise = favoriteService
    .getFavorites(userIdentifier)
    .then((response) => {
      if (!response.success) throw new Error(response.message)
      favCache = { data: response.data || [], isLocal: false }
      return favCache
    })
    .catch(() => {
      favCache = { data: readLocalFavs(), isLocal: true }
      return favCache
    })
    .finally(() => {
      favPromise = null
    })

  return favPromise
}

// ---------------------------------------------------------------------------
// useFavorites — list all favourited product IDs.
//
// First attempts the server; on failure uses localStorage.
// ---------------------------------------------------------------------------

export function useFavorites() {
  const [favorites, setFavorites] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isLocal, setIsLocal] = useState(false)
  const userIdentifier = getUserIdentifier()

  const fetchFavorites = useCallback(
    async (force = false) => {
      try {
        setLoading(true)
        setError(null)

        const { data, isLocal: local } = await loadFavorites(
          userIdentifier,
          force,
        )
        setFavorites(data)
        setIsLocal(local)
      } catch (err) {
        setError(err)
        setFavorites(readLocalFavs())
        setIsLocal(true)
      } finally {
        setLoading(false)
      }
    },
    [userIdentifier],
  )

  useEffect(() => {
    fetchFavorites()
  }, [fetchFavorites])

  return {
    favorites,
    loading,
    error,
    isLocal,
    refetch: () => fetchFavorites(true),
  }
}

// ---------------------------------------------------------------------------
// useToggleFavorite — toggle a product in/out of favourites.
// ---------------------------------------------------------------------------

export function useToggleFavorite() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const userIdentifier = getUserIdentifier()

  const toggleFavorite = async (gunId) => {
    try {
      setLoading(true)
      setError(null)

      const response = await favoriteService.toggleFavorite({
        recipe_id: gunId,
        user_identifier: userIdentifier,
      })

      if (response.success) {
        return response.data
      }
      throw new Error(response.message)
    } catch {
      // Fallback: toggle in localStorage
      const current = readLocalFavs()
      const idx = current.findIndex((id) => String(id) === String(gunId))
      let isFavorited

      if (idx === -1) {
        current.push(gunId)
        isFavorited = true
      } else {
        current.splice(idx, 1)
        isFavorited = false
      }
      writeLocalFavs(current)
      return { is_favorited: isFavorited }
    } finally {
      setLoading(false)
    }
  }

  return { toggleFavorite, loading, error }
}

// ---------------------------------------------------------------------------
// useIsFavorited — convenience wrapper for a single product.
// ---------------------------------------------------------------------------

export function useIsFavorited(gunId) {
  const { favorites, loading: fetchLoading, refetch } = useFavorites()
  const { toggleFavorite: toggle, loading: toggleLoading } = useToggleFavorite()

  // Check both server-format (objects with .id) and local-format (plain ids)
  const isFavorited = favorites.some((fav) => {
    const favId = typeof fav === 'object' && fav !== null ? (fav.id ?? fav.product_id ?? fav.recipe_id) : fav
    return String(favId) === String(gunId)
  })

  const toggleFavorite = async () => {
    const result = await toggle(gunId)
    if (result) await refetch()
    return result
  }

  return {
    isFavorited,
    loading: fetchLoading || toggleLoading,
    toggleFavorite,
  }
}

export { getUserIdentifier }
