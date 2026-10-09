import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
          <h1 className="text-xl font-semibold text-slate-800 mb-1">Find schemes you may qualify for</h1>
          <p className="text-sm text-slate-500 mb-4">
            Search by name, category, or describe your situation in your own words.
          </p>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='Try "scholarship" or "schemes for farmers with low income"'
              className="input-field flex-1"
            />
            <button type="submit" className="btn-primary shrink-0">
              Search
            </button>
          </form>
        </section>

        {/* Search results (overrides other sections while active) */}
        {searchResults !== null && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">
                Search Results {searching ? '' : `(${searchResults.length})`}
              </h2>
              <button
                onClick={() => { setSearchResults(null); setSearchQuery('') }}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                Clear
              </button>
            </div>
            {searching ? (
              <LoadingState message="Searching schemes..." />
            ) : searchResults.length === 0 ? (
              <EmptyState message="No schemes matched your search. Try different words." icon="🔍" />
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
            <h2 className="font-semibold text-slate-800 mb-3">Browse by Category</h2>
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
                  <span className="text-xs font-medium text-center leading-tight">{cat.name}</span>
                </button>
              ))}
            </div>

            {activeCategory && (
              <div className="mt-4">
                {categoryLoading ? (
                  <LoadingState message="Loading schemes..." />
                ) : categorySchemes.length === 0 ? (
                  <EmptyState message={`No active schemes found in ${activeCategory} right now.`} />
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
                <h2 className="font-semibold text-slate-800 text-lg">Recommended for You</h2>
                <p className="text-xs text-slate-500">
                  Evaluated with rule-based legal eligibility and ML predictive affinity.
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
                    All ({recommendations.length})
                  </button>

                  <button
                    onClick={() => setRecFilterTab('ELIGIBLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                      recFilterTab === 'ELIGIBLE'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <span>✓</span> Eligible ({eligibleSchemes.length})
                  </button>

                  <button
                    onClick={() => setRecFilterTab('NEEDS_VERIFICATION')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                      recFilterTab === 'NEEDS_VERIFICATION'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-amber-700 hover:bg-amber-50'
                    }`}
                  >
                    <span>⚠</span> Needs Verification ({needsVerificationSchemes.length})
                  </button>

                  <button
                    onClick={() => setRecFilterTab('NOT_ELIGIBLE')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 shrink-0 ${
                      recFilterTab === 'NOT_ELIGIBLE'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-500 hover:bg-slate-200/50'
                    }`}
                  >
                    <span>✕</span> Not Eligible ({notEligibleSchemes.length})
                  </button>
                </div>
              )}
            </div>

            {/* Context Notice based on selected tab */}
            {!loading && !error && recommendations.length > 0 && (
              <div className="text-xs rounded-xl px-4 py-2.5 flex items-center justify-between border bg-white border-slate-100 shadow-xs">
                {recFilterTab === 'ALL' && (
                  <p className="text-slate-600">
                    <span className="font-semibold text-slate-800">Priority Ordering:</span> Showing schemes ranked by verified eligibility first, followed by schemes with high ML affinity requiring document verification.
                  </p>
                )}
                {recFilterTab === 'ELIGIBLE' && (
                  <p className="text-emerald-700">
                    <span className="font-semibold">Ready to Apply:</span> You satisfy all verified mandatory criteria for these schemes.
                  </p>
                )}
                {recFilterTab === 'NEEDS_VERIFICATION' && (
                  <div className="flex items-center justify-between w-full">
                    <p className="text-amber-800">
                      <span className="font-semibold">Unlock Eligibility:</span> High AI affinity for your profile, but requires verifying documents in your Wallet.
                    </p>
                    <button
                      onClick={() => navigate('/wallet')}
                      className="ml-3 text-xs font-bold text-amber-700 hover:text-amber-800 underline shrink-0"
                    >
                      Go to Wallet →
                    </button>
                  </div>
                )}
                {recFilterTab === 'NOT_ELIGIBLE' && (
                  <p className="text-slate-500">
                    <span className="font-semibold text-slate-700">Requirements Unmet:</span> One or more mandatory conditions (e.g. income limit, age, or occupation) do not match.
                  </p>
                )}
              </div>
            )}

            {loading ? (
              <LoadingState message="Analyzing your profile..." />
            ) : error ? (
              <ErrorState message="Couldn't load recommendations right now." onRetry={loadRecommendations} />
            ) : displayedRecommendations.length === 0 ? (
              <EmptyState
                message={
                  recFilterTab === 'ELIGIBLE'
                    ? "No fully verified eligible schemes yet. Check the 'Needs Verification' tab or upload documents in your Wallet."
                    : recFilterTab === 'NEEDS_VERIFICATION'
                    ? "No schemes currently pending document verification."
                    : recFilterTab === 'NOT_ELIGIBLE'
                    ? "None of the schemes are marked as not eligible."
                    : "Complete your profile to get personalized recommendations."
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
            <h2 className="font-semibold text-slate-800 mb-3">Deadlines Approaching</h2>
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
                    {s.daysRemaining === 0 ? 'Deadline today' : `${s.daysRemaining} days remaining`}
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
