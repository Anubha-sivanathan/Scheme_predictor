import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import SchemeCard from '../components/SchemeCard'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import { getRecommendations } from '../api/recommendations'
import { searchSchemes, getSchemesByCategory } from '../api/schemes'

const CATEGORIES = [
  { name: 'Education', icon: '🎓' },
  { name: 'Agriculture', icon: '🌾' },
  { name: 'Healthcare', icon: '🏥' },
  { name: 'Housing', icon: '🏠' },
  { name: 'Employment', icon: '💼' },
  { name: 'Women & Child Welfare', icon: '👩‍👧' },
  { name: 'Financial Assistance', icon: '💰' },
  { name: 'Disability Support', icon: '♿' },
  { name: 'Senior Citizens', icon: '👴' },
]

export default function LandingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [searching, setSearching] = useState(false)

  const [activeCategory, setActiveCategory] = useState(null)
  const [categorySchemes, setCategorySchemes] = useState(null)
  const [categoryLoading, setCategoryLoading] = useState(false)

  const loadRecommendations = () => {
    setLoading(true)
    setError(false)
    getRecommendations()
      .then(setRecommendations)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadRecommendations()
  }, [])

  const handleSearch = async (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }
    setSearching(true)
    setActiveCategory(null)
    setCategorySchemes(null)
    try {
      const results = await searchSchemes(searchQuery.trim())
      setSearchResults(results)
    } catch (err) {
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleCategoryClick = async (category) => {
    setSearchResults(null)
    setSearchQuery('')
    if (activeCategory === category) {
      setActiveCategory(null)
      setCategorySchemes(null)
      return
    }
    setActiveCategory(category)
    setCategoryLoading(true)
    try {
      const results = await getSchemesByCategory(category)
      setCategorySchemes(results)
    } catch (err) {
      setCategorySchemes([])
    } finally {
      setCategoryLoading(false)
    }
  }

  const handleToggleSave = (schemeId, saved) => {
    setRecommendations((prev) =>
      prev.map((r) => (r.schemeId === schemeId ? { ...r, saved } : r))
    )
  }

  const [recFilterTab, setRecFilterTab] = useState('ALL')

  const deadlineSchemes = recommendations
    .filter((r) => r.daysRemaining != null && r.daysRemaining >= 0 && r.daysRemaining <= 30)
    .sort((a, b) => a.daysRemaining - b.daysRemaining)
    .slice(0, 5)

  const eligibleSchemes = recommendations.filter(
    (r) => r.eligibilityStatus === 'ELIGIBLE' || (!r.eligibilityStatus && r.eligible === true)
  )
  const needsVerificationSchemes = recommendations.filter(
    (r) => r.eligibilityStatus === 'NEEDS_VERIFICATION'
  )
  const notEligibleSchemes = recommendations.filter(
    (r) => r.eligibilityStatus === 'NOT_ELIGIBLE' || (!r.eligibilityStatus && r.eligible === false)
  )

  const displayedRecommendations =
    recFilterTab === 'ELIGIBLE'
      ? eligibleSchemes
      : recFilterTab === 'NEEDS_VERIFICATION'
      ? needsVerificationSchemes
      : recFilterTab === 'NOT_ELIGIBLE'
      ? notEligibleSchemes
      : recommendations

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-8">
        {/* A. Search Bar */}
        <section>
          <h1 className="text-xl font-semibold text-slate-800 mb-1">{t('landing.heading')}</h1>
          <p className="text-sm text-slate-500 mb-4">
            {t('landing.subheading')}
          </p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('landing.searchPlaceholder')}
              aria-label={t('landing.searchPlaceholder')}
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary shrink-0">
              {t('common.search')}
            </button>
          </form>
        </section>

        {/* Search results (overrides other sections while active) */}
        {searchResults !== null && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">
                {t('landing.searchResults')} {searching ? '' : `(${searchResults.length})`}
              </h2>
              <button
                onClick={() => { setSearchResults(null); setSearchQuery('') }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                {t('common.clear')}
              </button>
            </div>
            {searching ? (
              <LoadingState message={t('landing.searching')} />
            ) : searchResults.length === 0 ? (
              <EmptyState message={t('landing.noResults')} icon="🔍" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {searchResults.map((s) => (
                  <SchemeCard key={s.id} scheme={s} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* B. Category Section */}
        {searchResults === null && (
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">{t('landing.browseCategory')}</h2>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => handleCategoryClick(cat.name)}
                  className={`shrink-0 flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl border transition-colors min-w-[92px] ${
                    activeCategory === cat.name
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-slate-100 text-slate-700 hover:border-primary-200'
                  }`}
                >
                  <span className="text-xl">{cat.icon}</span>
                  <span className="text-xs font-medium text-center leading-tight">{t(`categories.${cat.name}`)}</span>
                </button>
              ))}
            </div>

            {activeCategory && (
              <div className="mt-4">
                {categoryLoading ? (
                  <LoadingState message={t('landing.loadingSchemes')} />
                ) : categorySchemes.length === 0 ? (
                  <EmptyState message={t('landing.noCategorySchemes', { category: t(`categories.${activeCategory}`) })} />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {categorySchemes.map((s) => (
                      <SchemeCard key={s.id} scheme={s} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* C & D. Recommended for You with Tri-State Partitioning */}
        {searchResults === null && !activeCategory && (
          <section className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="font-semibold text-slate-800 text-lg">{t('landing.recommended')}</h2>
                <p className="text-xs text-slate-500">
                  {t('landing.recommendedNote')}
                </p>
              </div>

              {/* Tri-State Filter Tabs */}
              {!loading && !error && recommendations.length > 0 && (
                <div className="flex items-center gap-1.5 bg-slate-100/90 p-1 rounded-xl self-start sm:self-auto overflow-x-auto max-w-full">
                  <button
                    onClick={() => setRecFilterTab('ALL')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
                      recFilterTab === 'ALL'
                        ? 'bg-white text-slate-800 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {t('landing.tabAll', { count: recommendations.length })}
                  </button>

                  <button
                    onClick={() => setRecFilterTab('ELIGIBLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                      recFilterTab === 'ELIGIBLE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span>✓</span> {t('landing.tabEligible', { count: eligibleSchemes.length })}
                  </button>

                  <button
                    onClick={() => setRecFilterTab('NEEDS_VERIFICATION')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                      recFilterTab === 'NEEDS_VERIFICATION'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <span>⚠</span> {t('landing.tabNeeds', { count: needsVerificationSchemes.length })}
                  </button>

                  <button
                    onClick={() => setRecFilterTab('NOT_ELIGIBLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                      recFilterTab === 'NOT_ELIGIBLE'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-500 hover:bg-slate-200/50'
                    }`}
                  >
                    <span>✕</span> {t('landing.tabNot', { count: notEligibleSchemes.length })}
                  </button>
                </div>
              )}
            </div>

            {/* Context Notice based on selected tab */}
            {!loading && !error && recommendations.length > 0 && (
              <div className="text-xs rounded-xl px-4 py-2.5 flex items-center justify-between border bg-white border-slate-100 shadow-xs">
                {recFilterTab === 'ALL' && (
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">{t('landing.noteAllTitle')}</span> {t('landing.noteAll')}
                  </p>
                )}
                {recFilterTab === 'ELIGIBLE' && (
                  <p className="text-emerald-700">
                    <span className="font-semibold">{t('landing.noteEligibleTitle')}</span> {t('landing.noteEligible')}
                  </p>
                )}
                {recFilterTab === 'NEEDS_VERIFICATION' && (
                  <div className="flex items-center justify-between w-full">
                    <p className="text-amber-800">
                      <span className="font-semibold">{t('landing.noteNeedsTitle')}</span> {t('landing.noteNeeds')}
                    </p>
                    <button
                      onClick={() => navigate('/wallet')}
                      className="ml-3 text-xs font-bold text-amber-700 hover:text-amber-800 underline shrink-0"
                    >
                      {t('landing.goToWallet')}
                    </button>
                  </div>
                )}
                {recFilterTab === 'NOT_ELIGIBLE' && (
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-700">{t('landing.noteNotTitle')}</span> {t('landing.noteNot')}
                  </p>
                )}
              </div>
            )}

            {loading ? (
              <LoadingState message={t('landing.analyzing')} />
            ) : error ? (
              <ErrorState message={t('landing.loadFailed')} onRetry={loadRecommendations} />
            ) : displayedRecommendations.length === 0 ? (
              <EmptyState
                message={
                  recFilterTab === 'ELIGIBLE'
                    ? t('landing.emptyEligible')
                    : recFilterTab === 'NEEDS_VERIFICATION'
                    ? t('landing.emptyNeeds')
                    : recFilterTab === 'NOT_ELIGIBLE'
                    ? t('landing.emptyNot')
                    : t('landing.emptyAll')
                }
                icon={recFilterTab === 'ELIGIBLE' ? '✓' : recFilterTab === 'NEEDS_VERIFICATION' ? '📂' : '🎯'}
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedRecommendations.map((r) => (
                  <SchemeCard key={r.schemeId} scheme={r} onToggleSave={handleToggleSave} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* E. Deadlines Approaching */}
        {searchResults === null && !activeCategory && !loading && !error && deadlineSchemes.length > 0 && (
          <section>
            <h2 className="font-semibold text-slate-800 mb-3">{t('landing.deadlines')}</h2>
            <div className="card divide-y divide-slate-100">
              {deadlineSchemes.map((s) => (
                <div
                  key={s.schemeId}
                  onClick={() => navigate(`/schemes/${s.schemeId}`)}
                  className="flex items-center justify-between py-3 first:pt-0 last:pb-0 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="text-xs text-slate-500">{s.department}</p>
                  </div>
                  <span
                    className={`badge-warning ${s.daysRemaining <= 5 ? '!bg-red-50 !text-red-600' : ''}`}
                  >
                    {s.daysRemaining === 0 ? t('card.deadlineToday') : t('scheme.daysRemaining', { count: s.daysRemaining })}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <Chatbot />
    </div>
  )
}
