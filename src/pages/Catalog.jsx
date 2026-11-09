import { useState, useEffect, useMemo } from 'react'
import { RefreshCw, Plus, Loader, AlertCircle, PackageOpen } from 'lucide-react'
import { useGuns } from '../hooks/useGuns'
import GUNS_LOCAL from '../data/guns'
import GunCard from '../components/gun/GunCard'
import GunDetail from '../components/gun/GunDetail'
import AdvancedFilter from '../components/common/AdvancedFilter'
import ConfirmModal from '../components/modals/ConfirmModal'
import gunService from '../services/gunService'
import {
  matchesSearch,
  matchesCategory,
  sortItems,
  extractCategories,
} from '../utils/helpers'
import { computePagination } from '../utils/pagination'

const PAGE_SIZE = 9

/**
 * Catalog page — the main product listing.
 *
 * Data source priority:
 *   1. Live API via useGuns() (server-side search / filter / sort / pagination)
 *   2. Local static array (GUNS_LOCAL) when the API is unreachable
 */
export default function Catalog({ onNavigate }) {
  // ---- filters / sort / page ----
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [sortKey, setSortKey] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)
  const [useLocal, setUseLocal] = useState(false)

  // Debounce search so typing does not fire a request per keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  // Any filter change returns to page 1.
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, activeCategory, sortKey, sortOrder])

  // ---- API data (server-side pagination) ----
  const {
    guns: apiGuns,
    loading,
    error,
    pagination,
    refetch,
  } = useGuns({
    search: debouncedSearch,
    category: activeCategory,
    sort_by: sortKey,
    order: sortOrder,
    page,
    limit: PAGE_SIZE,
  })

  // ---- local fallback ----
  const localGuns = useMemo(
    () => GUNS_LOCAL.map((g, i) => ({ ...g, id: g.id || `local-${i}` })),
    [],
  )
  const localFiltered = useMemo(
    () =>
      sortItems(
        localGuns.filter(
          (g) => matchesSearch(g, search) && matchesCategory(g, activeCategory),
        ),
        sortKey,
        sortOrder,
      ),
    [localGuns, search, activeCategory, sortKey, sortOrder],
  )

  const usingLocal = useLocal || (Boolean(error) && apiGuns.length === 0)
  const { totalPages: localTotalPages } = computePagination(
    localFiltered.length,
    page,
    PAGE_SIZE,
  )
  const totalPages = usingLocal ? localTotalPages : pagination?.totalPages || 1
  const totalCount = usingLocal ? localFiltered.length : pagination?.total || 0
  const displayGuns = usingLocal
    ? localFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
    : apiGuns

  // Categories come from the static catalog so the pills stay stable
  // across server pages.
  const categories = useMemo(() => extractCategories(localGuns), [localGuns])

  // ---- detail view ----
  const [selectedGun, setSelectedGun] = useState(null)

  // ---- delete ----
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      setDeleting(true)
      setDeleteError('')
      await gunService.deleteGun(deleteTarget.id)
      setDeleteTarget(null)
      refetch()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete.')
    } finally {
      setDeleting(false)
    }
  }

  // ---- If viewing a single product detail ----
  if (selectedGun) {
    return (
      <GunDetail
        gun={selectedGun}
        onBack={() => setSelectedGun(null)}
        onEdit={(g) => onNavigate && onNavigate('Edit', g)}
        onDelete={(g) => {
          setSelectedGun(null)
          setDeleteTarget(g)
        }}
      />
    )
  }

  // ---- Main catalog view ----
  return (
    <>
      <section className="masthead">
        <h1 className="display">Hardware, by the spec sheet.</h1>
        <p className="lede">
          A small armory of pistols, rifles, and shotguns. Every piece listed
          with its type, caliber, and price — nothing else.
        </p>
      </section>

      <section>
        <div className="list-head">
          <h2>Current stock</h2>
          <div className="list-head-right">
            <span className="count">
              {totalCount} piece{totalCount !== 1 ? 's' : ''}
            </span>
            {onNavigate && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                onClick={() => onNavigate('Create')}
              >
                <Plus size={16} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilter
          search={search}
          onSearch={setSearch}
          categories={categories}
          activeCategory={activeCategory}
          onCategory={setActiveCategory}
          sortKey={sortKey}
          sortOrder={sortOrder}
          onSort={({ key, order }) => {
            setSortKey(key)
            setSortOrder(order)
          }}
        />

        {/* States */}
        {loading && (
          <div className="state-box">
            <Loader size={28} className="spin" />
            <p>Loading products…</p>
          </div>
        )}

        {!loading && error && !useLocal && (
          <div className="state-box state-box--error">
            <AlertCircle size={28} />
            <p>{error}</p>
            <div className="state-box__actions">
              <button type="button" className="btn btn--outline" onClick={refetch}>
                <RefreshCw size={16} /> Retry
              </button>
              <button
                type="button"
                className="btn btn--outline"
                onClick={() => setUseLocal(true)}
              >
                View Local Catalog
              </button>
            </div>
          </div>
        )}

        {!loading && displayGuns.length === 0 && !error && (
          <div className="state-box">
            <PackageOpen size={28} />
            <p>No products match your search.</p>
          </div>
        )}

        {/* Product grid */}
        {displayGuns.length > 0 && (
          <ul className="stock">
            {displayGuns.map((gun) => (
              <GunCard
                key={gun.id || gun.name}
                gun={gun}
                onSelect={setSelectedGun}
                onEdit={onNavigate ? (g) => onNavigate('Edit', g) : undefined}
                onDelete={setDeleteTarget}
              />
            ))}
          </ul>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Prev
            </button>
            <span className="pagination__info">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              className="btn btn--outline btn--sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              Next
            </button>
          </div>
        )}

        {useLocal && (
          <p className="local-notice">
            Showing local catalog (server unavailable).{' '}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setUseLocal(false)
                refetch()
              }}
            >
              Retry server
            </button>
          </p>
        )}
      </section>

      {/* Delete confirmation */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Product"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError('')
        }}
      />
      {deleteError && <div className="toast toast--error">{deleteError}</div>}
    </>
  )
}
