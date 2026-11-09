import { apiClient, apiClientRaw, IS_SUPABASE } from '../config/api'

// ---------------------------------------------------------------------------
// Normalizer — standardizes product shape whether received from Supabase
// (public.products) or from the university API (/api/v1/recipes).
// ---------------------------------------------------------------------------
export const normalizeProduct = (item) => {
  if (!item) return null

  // Resolve specifications from Supabase `specs` (text array) or API `ingredients`
  let specsList = []
  if (Array.isArray(item.specs)) {
    specsList = item.specs.map((s, idx) => {
      if (typeof s === 'string') {
        const colonIndex = s.indexOf(':')
        if (colonIndex > -1) {
          return {
            id: `spec-${idx}`,
            name: s.substring(0, colonIndex).trim(),
            quantity: s.substring(colonIndex + 1).trim(),
          }
        }
        return {
          id: `spec-${idx}`,
          name: 'Specification',
          quantity: s.trim(),
        }
      }
      return s
    })
  } else if (Array.isArray(item.ingredients)) {
    specsList = item.ingredients
  }

  // Resolve steps
  const stepsList =
    Array.isArray(item.steps) && item.steps.length > 0
      ? item.steps
      : ['Verify firearm is completely unloaded and point in safe direction.', 'Inspect receiver and mechanism for maintenance.']

  return {
    ...item,
    id: item.id,
    name: item.name || 'Hardware Piece',
    type: item.type || item.category || 'Hardware',
    category: item.type || item.category || 'Hardware',
    caliber: item.caliber || 'Standard',
    price: Number(item.price ?? item.cook_time ?? 0),
    description: item.description || '',
    image_url: item.image_url || item.image || '/guns/pistol.svg',
    image: item.image_url || item.image || '/guns/pistol.svg',
    ingredients: specsList,
    steps: stepsList,
  }
}

// ---------------------------------------------------------------------------
// GunService — wraps backend CRUD endpoints.
// Supports both Supabase PostgREST table (/rest/v1/products) and
// standard REST API (/api/v1/recipes).
// ---------------------------------------------------------------------------
class GunService {
  /**
   * Fetch a paginated, filterable list of products.
   * Supabase: server-side pagination via `limit` + `offset`, total from
   * `Content-Range` (requested with `Prefer: count=exact`).
   *
   * @param {Object} params { search, category, sort_by, order, page, limit }
   */
  async getGuns(params = {}) {
    const { search, category, sort_by, order, page = 1, limit = 9 } = params
    const offset = (page - 1) * limit

    if (IS_SUPABASE) {
      const query = new URLSearchParams()
      query.set('select', '*')
      if (search) query.set('name', `ilike.*${search}*`)
      if (category && category !== 'All') query.set('type', `eq.${category}`)
      query.set('order', `${sort_by || 'created_at'}.${order === 'desc' ? 'desc' : 'asc'}`)
      query.set('limit', String(limit))
      query.set('offset', String(offset))

      const res = await apiClientRaw.get(`/rest/v1/products?${query}`, {
        headers: { Prefer: 'count=exact' },
      })
      const list = Array.isArray(res.data) ? res.data.map(normalizeProduct) : []
      const range = res.headers['content-range'] || ''
      const total = Number(range.split('/')[1]) || list.length

      return {
        success: true,
        data: list,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      }
    }

    // Fallback: university REST API
    const res = await apiClientRaw.get('/api/v1/recipes', {
      params: { ...params, offset, limit },
    })
    const list = Array.isArray(res.data) ? res.data.map(normalizeProduct) : []
    return {
      success: true,
      data: list,
      pagination: { total: list.length, page, limit, totalPages: 1 },
    }
  }

  /**
   * Fetch a single product by ID.
   */
  async getGunById(id) {
    if (IS_SUPABASE) {
      const data = await apiClient.get(`/rest/v1/products?id=eq.${id}&select=*`)
      if (Array.isArray(data) && data.length > 0) {
        return { success: true, data: normalizeProduct(data[0]) }
      }
      throw new Error('Hardware item not found.')
    }
    const res = await apiClientRaw.get(`/api/v1/recipes/${id}`)
    return { success: true, data: normalizeProduct(res.data) }
  }

  /**
   * Create a new product.
   */
  async createGun(data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : []

      const payload = {
        name: data.name,
        type: data.type || (data.category === 'minuman' ? 'Rifle' : 'Pistol'),
        caliber: data.caliber || '9mm',
        price: Number(data.price ?? data.cook_time ?? 0),
        description: data.description || '',
        specs: specsArray,
        image_url: data.image_url || null,
      }

      const res = await apiClient.post('/rest/v1/products', payload, {
        headers: { Prefer: 'return=representation' },
      })
      const created = Array.isArray(res) ? res[0] : res
      return { success: true, data: normalizeProduct(created) }
    }
    const res = await apiClientRaw.post('/api/v1/recipes', data)
    return { success: true, data: normalizeProduct(res.data) }
  }

  /**
   * Update existing product.
   */
  async updateGun(id, data) {
    if (IS_SUPABASE) {
      const specsArray = Array.isArray(data.ingredients)
        ? data.ingredients.map((i) => `${i.name}: ${i.quantity}`)
        : Array.isArray(data.specs)
        ? data.specs
        : undefined

      const payload = {
        updated_at: new Date().toISOString(),
      }
      if (data.name !== undefined) payload.name = data.name
      if (data.type !== undefined) payload.type = data.type
      if (data.caliber !== undefined) payload.caliber = data.caliber
      if (data.price !== undefined || data.cook_time !== undefined) {
        payload.price = Number(data.price ?? data.cook_time ?? 0)
      }
      if (data.description !== undefined) payload.description = data.description
      if (specsArray !== undefined) payload.specs = specsArray
      if (data.image_url !== undefined) payload.image_url = data.image_url

      const res = await apiClient.patch(`/rest/v1/products?id=eq.${id}`, payload, {
        headers: { Prefer: 'return=representation' },
      })
      const updated = Array.isArray(res) ? res[0] : res
      return { success: true, data: normalizeProduct(updated) }
    }
    const res = await apiClientRaw.put(`/api/v1/recipes/${id}`, data)
    return { success: true, data: normalizeProduct(res.data) }
  }

  /**
   * Partial update (PATCH).
   */
  async patchGun(id, data) {
    if (IS_SUPABASE) {
      return this.updateGun(id, data)
    }
    const res = await apiClientRaw.patch(`/api/v1/recipes/${id}`, data)
    return { success: true, data: normalizeProduct(res.data) }
  }

  /**
   * Delete product.
   */
  async deleteGun(id) {
    if (IS_SUPABASE) {
      await apiClient.delete(`/rest/v1/products?id=eq.${id}`)
      return { success: true }
    }
    await apiClientRaw.delete(`/api/v1/recipes/${id}`)
    return { success: true }
  }
}

export default new GunService()
