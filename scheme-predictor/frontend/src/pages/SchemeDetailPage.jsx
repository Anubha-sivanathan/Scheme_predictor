import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState } from '../components/StateViews'
import { getSchemeById, saveScheme, unsaveScheme } from '../api/schemes'
import { getRecommendations } from '../api/recommendations'

export default function SchemeDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [scheme, setScheme] = useState(null)
  const [recommendation, setRecommendation] = useState(null) // has match %, eligibility, etc.
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([getSchemeById(id), getRecommendations()])
      .then(([schemeData, recs]) => {
        setScheme(schemeData)
        const rec = recs.find((r) => r.schemeId === id)
        setRecommendation(rec || null)
        setSaved(rec?.saved || false)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleToggleSave = async () => {
    try {
      if (saved) {
        await unsaveScheme(id)
      } else {
        await saveScheme(id)
      }
      setSaved(!saved)
    } catch (e) {
      console.error(e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <LoadingState message="Loading scheme details..." />
      </div>
    )
  }

  if (error || !scheme) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <ErrorState message="Couldn't load this scheme." onRetry={load} />
      </div>
    )
  }

  const criteria = scheme.eligibilityCriteria || {}
  const status = recommendation?.eligibilityStatus || (recommendation?.eligible === true ? 'ELIGIBLE' : recommendation?.eligible === false ? 'NOT_ELIGIBLE' : null)

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-700">
          ← Back
        </button>

        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              {recommendation?.rank != null && (
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">
                  Recommended Scheme #{recommendation.rank}
                </p>
              )}
              <h1 className="text-xl font-semibold text-slate-800">{scheme.name}</h1>
              <p className="text-sm text-slate-500 mt-1">{scheme.department} · {scheme.category}</p>
            </div>
            {recommendation && (
              <div className="text-center shrink-0">
                <div className="text-2xl font-bold text-primary-600">{recommendation.matchPercentage}%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">Match</div>
              </div>
            )}
          </div>

          <p className="text-sm text-slate-600 mt-4">{scheme.description}</p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {status === 'ELIGIBLE' && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200">
                <span>✓</span> Appears Eligible (All Criteria Satisfied)
              </span>
            )}
            {status === 'NEEDS_VERIFICATION' && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200">
                <span>⚠</span> Needs Verification (Pending Wallet Documents)
              </span>
            )}
            {status === 'NOT_ELIGIBLE' && (
              <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-semibold px-3 py-1 rounded-full border border-rose-200">
                <span>✕</span> Requirements Not Met
              </span>
            )}
            {!status && recommendation?.eligible === true && <span className="badge-success">Appears Eligible</span>}
            {!status && recommendation?.eligible === false && <span className="badge-warning">Requirements Not Yet Met</span>}

            <button onClick={handleToggleSave} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 ml-auto">
              <span className={`text-lg transition-transform hover:scale-110 ${saved ? 'text-rose-500' : 'text-slate-400'}`}>
                {saved ? '♥' : '♡'}
              </span>
              <span>{saved ? 'Saved' : 'Save Scheme'}</span>
            </button>
          </div>
        </div>

        {/* Explainable AI Decision Analysis */}
        {recommendation?.explanationText && (
          <div className="card bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border-primary-100">
            <div className="flex items-center gap-2 mb-2 text-primary-700 font-semibold text-sm">
              <span className="text-base">✦</span>
              <h2>Explainable AI Decision Analysis</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {recommendation.explanationText}
            </p>
            {recommendation.eligibilityStatusMessage && (
              <p className="text-xs text-primary-800/80 mt-2 font-medium">
                Note: {recommendation.eligibilityStatusMessage}
              </p>
            )}
          </div>
        )}

        {/* Criteria Breakdown from Rule Engine */}
        {recommendation?.criteriaChecks?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">Eligibility Criteria Breakdown</h2>
            <ul className="space-y-2.5">
              {recommendation.criteriaChecks.map((c, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm p-2.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <span
                    className={`mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold shrink-0 ${
                      c.status === 'MET'
                        ? 'bg-emerald-100 text-emerald-700'
                        : c.status === 'NOT_MET'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {c.status === 'MET' ? '✓' : c.status === 'NOT_MET' ? '✕' : '?'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">{c.label}</span>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        c.status === 'MET'
                          ? 'bg-emerald-50 text-emerald-700'
                          : c.status === 'NOT_MET'
                          ? 'bg-rose-50 text-rose-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}>
                        {c.status === 'MET' ? 'Satisfied' : c.status === 'NOT_MET' ? 'Unmet' : 'Requires Verification'}
                      </span>
                    </div>
                    {c.detail && (
                      <p className="text-xs text-slate-500 mt-0.5">{c.detail}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {status === 'NEEDS_VERIFICATION' && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">Missing required verification:</span> Upload and confirm documents in your Data Wallet to satisfy unknown criteria.
                </p>
                <button
                  onClick={() => navigate('/wallet')}
                  className="btn-primary text-xs !py-1.5 !px-3 shrink-0"
                >
                  Upload in Wallet
                </button>
              </div>
            )}
          </div>
        )}

        {/* Benefits */}
        {scheme.benefits && scheme.benefits.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">Benefits</h2>
            <ul className="space-y-1.5">
              {scheme.benefits.map((b, i) => (
                <li key={i} className="text-sm text-slate-600 flex gap-2">
                  <span className="text-success-500">✓</span> {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Eligibility Criteria (raw, informational) */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">Eligibility Criteria</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(criteria.minAge || criteria.maxAge) && (
              <CriteriaItem label="Age" value={`${criteria.minAge ?? 'Any'}–${criteria.maxAge ?? 'Any'}`} />
            )}
            {(criteria.minIncome || criteria.maxIncome) && (
              <CriteriaItem
                label="Income"
                value={
                  criteria.maxIncome
                    ? `Up to ₹${(criteria.maxIncome / 100000).toFixed(1)}L`
                    : `Above ₹${(criteria.minIncome / 100000).toFixed(1)}L`
                }
              />
            )}
            {criteria.allowedCategories?.length > 0 && (
              <CriteriaItem label="Category" value={criteria.allowedCategories.join(', ')} />
            )}
            {criteria.allowedStates?.length > 0 && (
              <CriteriaItem label="Residence" value={criteria.allowedStates.join(', ')} />
            )}
            {criteria.allowedOccupations?.length > 0 && (
              <CriteriaItem label="Occupation" value={criteria.allowedOccupations.join(', ')} />
            )}
            {criteria.requiresDisability && <CriteriaItem label="Disability" value="Required" />}
            {criteria.requiresStudent && <CriteriaItem label="Student Status" value="Required" />}
            {criteria.requiresFarmer && <CriteriaItem label="Farmer Status" value="Required" />}
            {criteria.requiresSeniorCitizen && <CriteriaItem label="Senior Citizen" value="Required" />}
          </div>
        </div>

        {/* Required Documents */}
        {scheme.requiredDocuments && scheme.requiredDocuments.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">Required Documents</h2>
              <button
                onClick={() => navigate('/wallet')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                Go to Wallet →
              </button>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {scheme.requiredDocuments.map((d, i) => {
                const isMissing = recommendation?.missingInformation?.some(
                  (m) => m.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(m.toLowerCase())
                )
                return (
                  <li
                    key={i}
                    className={`text-sm rounded-lg px-3 py-2 border flex items-center justify-between gap-2 ${
                      isMissing
                        ? 'bg-amber-50/70 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-100 text-slate-700'
                    }`}
                  >
                    <span>{d}</span>
                    {isMissing && (
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/90 px-1.5 py-0.5 rounded">
                        Verification Needed
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-slate-400 mt-3">
              Upload and verify these certificates in your{' '}
              <button onClick={() => navigate('/wallet')} className="text-primary-600 hover:underline font-medium">
                Unified Data Wallet
              </button>
              {' '}to unlock automatic eligibility verification.
            </p>
          </div>
        )}

        {/* Application Process */}
        {scheme.applicationProcess && (
          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">Application Process</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line">{scheme.applicationProcess}</p>
          </div>
        )}

        {/* Deadline + Apply */}
        <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {scheme.deadline && (
              <>
                <p className="text-sm text-slate-500">Deadline</p>
                <p className="font-medium text-slate-800">{scheme.deadline}</p>
                {recommendation?.daysRemaining != null && (
                  <p className="text-xs text-warning-500 mt-0.5">
                    {recommendation.daysRemaining >= 0
                      ? `${recommendation.daysRemaining} days remaining`
                      : 'Deadline has passed'}
                  </p>
                )}
              </>
            )}
          </div>
          {scheme.applicationLink ? (
            <a
              href={scheme.applicationLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary text-center"
            >
              Apply Officially →
            </a>
          ) : (
            <p className="text-sm text-slate-400">Official application link not yet available.</p>
          )}
        </div>

        <p className="text-xs text-slate-400 text-center pb-4">
          This is an eligibility estimate based on the information you've provided. The final decision belongs to the relevant government authority.
        </p>
      </main>

      <Chatbot />
    </div>
  )
}

function CriteriaItem({ label, value }) {
  return (
    <div className="bg-slate-50 rounded-lg px-3 py-2">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value}</p>
    </div>
  )
}
