import { useState, useEffect, Suspense, lazy } from 'react'
import Header from './components/Header.jsx'
import Footer from './components/Footer.jsx'
import GunDetail from './components/gun/GunDetail.jsx'
import PWABadge from './components/PWABadge.jsx'
import ConfirmModal from './components/modals/ConfirmModal.jsx'
import SplashScreen from './components/common/SplashScreen.jsx'
import gunService from './services/gunService.js'
import { clearGunsCache } from './hooks/useGuns.js'
import './App.css'

// Lazy-loaded pages — each becomes its own chunk at build time.
const LazyCatalog = lazy(() => import('./pages/Catalog.jsx'))
const LazyCreateGunPage = lazy(() => import('./pages/CreateGunPage.jsx'))
const LazyEditGunPage = lazy(() => import('./pages/EditGunPage.jsx'))
const LazyFavoritesPage = lazy(() => import('./pages/FavoritesPage.jsx'))
const LazyProfilePage = lazy(() => import('./pages/ProfilePage.jsx'))
const LazyAbout = lazy(() => import('./pages/About.jsx'))
const LazyContact = lazy(() => import('./pages/Contact.jsx'))

const PageFallback = (
  <div className="state-box">
    <p>Loading…</p>
  </div>
)

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [tab, setTab] = useState('Catalog')
  const [mode, setMode] = useState('list') // 'list' | 'create' | 'edit' | 'detail'
  const [selectedGun, setSelectedGun] = useState(null)
  const [editingGun, setEditingGun] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // Deep link: /?gun=<id> opens that product's detail view.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('gun')
    if (!id) return
    gunService
      .getGunById(id)
      .then((res) => {
        if (res?.success && res.data) {
          setSelectedGun(res.data)
          setMode('detail')
        }
      })
      .catch(() => {
        /* invalid/deleted id — stay on the catalog */
      })
  }, [])

  const handleNavigate = (target, payload) => {
    if (target === 'Create') {
      setMode('create')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Edit') {
      setEditingGun(payload)
      setMode('edit')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (target === 'Detail') {
      setSelectedGun(payload)
      setMode('detail')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else {
      setTab(target)
      setMode('list')
      setSelectedGun(null)
      setEditingGun(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBackToList = () => {
    setMode('list')
    setSelectedGun(null)
    setEditingGun(null)
    if (window.location.search) {
      window.history.replaceState(null, '', window.location.pathname)
    }
  }

  return (
    <div className="shell">
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}

      <Header
        tab={mode === 'list' ? tab : ''}
        onTab={(newTab) => handleNavigate(newTab)}
        onNavigateCreate={() => handleNavigate('Create')}
      />

      <main className="main">
        <Suspense fallback={PageFallback}>
          {/* Sub-page views */}
          {mode === 'create' && (
            <LazyCreateGunPage
              onBack={handleBackToList}
              onSuccess={() => {
                clearGunsCache()
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'edit' && (
            <LazyEditGunPage
              gun={editingGun}
              gunId={editingGun?.id}
              onBack={handleBackToList}
              onSuccess={() => {
                clearGunsCache()
                handleBackToList()
                setTab('Catalog')
              }}
            />
          )}

          {mode === 'detail' && selectedGun && (
            <GunDetail
              gun={selectedGun}
              onBack={handleBackToList}
              onEdit={(g) => handleNavigate('Edit', g)}
              onDelete={(g) => setDeleteTarget(g)}
            />
          )}

          {/* Top-level tabs */}
          {mode === 'list' && (
            <>
              {tab === 'Catalog' && (
                <LazyCatalog
                  onNavigate={(destination, payload) =>
                    handleNavigate(destination, payload)
                  }
                />
              )}
              {tab === 'Favorites' && (
                <LazyFavoritesPage
                  onSelectGun={(g) => handleNavigate('Detail', g)}
                  onNavigateCatalog={() => setTab('Catalog')}
                />
              )}
              {tab === 'Profile' && (
                <LazyProfilePage onReplaySplash={() => setShowSplash(true)} />
              )}
              {tab === 'About' && <LazyAbout />}
              {tab === 'Contact' && <LazyContact />}
            </>
          )}
        </Suspense>
      </main>

      {/* Global delete confirmation */}
      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete Hardware Record"
        message={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={deleting}
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            setDeleting(true)
            await gunService.deleteGun(deleteTarget.id)
            clearGunsCache()
            setDeleteTarget(null)
            handleBackToList()
            setTab('Catalog')
          } catch (err) {
            alert(err.message || 'Failed to delete record.')
          } finally {
            setDeleting(false)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <PWABadge />
      <Footer />
    </div>
  )
}

export default App
