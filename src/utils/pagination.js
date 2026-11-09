/**
 * Pagination helper — shared by the server-side (offset/limit) and local
 * fallback catalog. Pure function so it can be unit tested.
 *
 * @param {number} totalItems — total items available
 * @param {number} currentPage — active page (1-based)
 * @param {number} limit — items per page
 * @returns {Object} { totalPages, startIndex, endIndex, hasPrev, hasNext }
 */
export const computePagination = (totalItems, currentPage, limit) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / limit) || 1)
  const zeroBased = currentPage - 1
  const startIndex = zeroBased * limit
  const endIndex = Math.min(startIndex + limit, totalItems)
  return {
    totalPages,
    startIndex,
    endIndex,
    hasPrev: zeroBased > 0,
    hasNext: endIndex < totalItems,
  }
}
