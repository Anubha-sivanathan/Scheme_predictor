import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState } from '../components/StateViews'
import { getSchemeById, saveScheme, unsaveScheme } from '../api/schemes'
import { getRecommendations } from '../api/recommendations'
import { localizeRecommendation } from '../i18n/server'

export default function SchemeDetailPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()

  const [scheme, setScheme] = useState(null)
  const [rawRecommendation, setRecommendation] = useState(null) // has match %, eligibility, etc.
  // Server-generated eligibility text is rebuilt in the active language (English passes through unchanged).
  const recommendation = localizeRecommendation(rawRecommendation, t, i18n.language)
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
        <LoadingState message={t('scheme.loading')} />
      </div>
    )
  }

  if (error || !scheme) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <ErrorState message={t('scheme.loadFailed')} onRetry={load} />
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
          {t('common.back')}
        </button>

        {/* Header */}
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              {recommendation?.rank != null && (
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide mb-1">
                  {t('scheme.recommendedRank', { rank: recommendation.rank })}
                </p>
              )}
              <h1 className="text-xl font-semibold text-slate-800">{scheme.name}</h1>
              <p className="text-sm text-slate-500 mt-1">{scheme.department} · {t(`categories.${scheme.category}`, { defaultValue: scheme.category })}</p>
            </div>
            {recommendation && (
              <div className="text-center shrink-0">
                <div className="text-2xl font-bold text-primary-600">{recommendation.matchPercentage}%</div>
                <div className="text-[10px] text-slate-400 uppercase tracking-wide">{t('card.match')}</div>
              </div>
            )}
          </div>

          <p className="text-sm text-slate-600 mt-4">{scheme.description}</p>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            {status === 'ELIGIBLE' && (
              <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full border border-emerald-200">
                <span>✓</span> {t('scheme.appearsEligibleAll')}
              </span>
            )}
            {status === 'NEEDS_VERIFICATION' && (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 text-xs font-semibold px-3 py-1 rounded-full border border-amber-200">
                <span>⚠</span> {t('scheme.needsVerificationLong')}
              </span>
            )}
            {status === 'NOT_ELIGIBLE' && (
              <span className="inline-flex items-center gap-1.5 bg-rose-50 text-rose-700 text-xs font-semibold px-3 py-1 rounded-full border border-rose-200">
                <span>✕</span> {t('scheme.requirementsNotMet')}
              </span>
            )}
            {!status && recommendation?.eligible === true && <span className="badge-success">{t('card.appearsEligible')}</span>}
            {!status && recommendation?.eligible === false && <span className="badge-warning">{t('scheme.requirementsNotYet')}</span>}

            <button onClick={handleToggleSave} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-800 ml-auto">
              <span className={`text-lg transition-transform hover:scale-110 ${saved ? 'text-rose-500' : 'text-slate-400'}`}>
                {saved ? '♥' : '♡'}
              </span>
              <span>{saved ? t('scheme.saved') : t('scheme.save')}</span>
            </button>
          </div>
        </div>

        {/* Explainable AI Decision Analysis */}
        {recommendation?.explanationText && (
          <div className="card bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-slate-50 border-primary-100">
            <div className="flex items-center gap-2 mb-2 text-primary-700 font-semibold text-sm">
              <span className="text-base">✦</span>
              <h2>{t('scheme.xaiTitle')}</h2>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {recommendation.explanationText}
            </p>
            {recommendation.eligibilityStatusMessage && (
              <p className="text-xs text-primary-800/80 mt-2 font-medium">
                {t('scheme.note')} {recommendation.eligibilityStatusMessage}
              </p>
            )}
          </div>
        )}

        {/* Criteria Breakdown from Rule Engine */}
        {recommendation?.criteriaChecks?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">{t('scheme.breakdown')}</h2>
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
                        {c.status === 'MET' ? t('scheme.satisfied') : c.status === 'NOT_MET' ? t('scheme.unmet') : t('scheme.requiresVerification')}
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
                  <span className="font-semibold">{t('scheme.missingVerification')}</span> {t('scheme.missingVerificationBody')}
                </p>
                <button
                  onClick={() => navigate('/wallet')}
                  className="btn-primary text-xs !py-1.5 !px-3 shrink-0"
                >
                  {t('scheme.uploadInWallet')}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Benefits */}
        {scheme.benefits && scheme.benefits.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">{t('scheme.benefits')}</h2>
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
          <h2 className="font-semibold text-slate-800 mb-3">{t('scheme.criteria')}</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {(criteria.minAge || criteria.maxAge) && (
              <CriteriaItem label={t('scheme.age')} value={`${criteria.minAge ?? t('scheme.any')}–${criteria.maxAge ?? t('scheme.any')}`} />
            )}
            {(criteria.minIncome || criteria.maxIncome) && (
              <CriteriaItem
                label={t('scheme.income')}
                value={
                  criteria.maxIncome
                    ? t('scheme.incomeUpTo', { value: (criteria.maxIncome / 100000).toFixed(1) })
                    : t('scheme.incomeAbove', { value: (criteria.minIncome / 100000).toFixed(1) })
                }
              />
            )}
            {criteria.allowedCategories?.length > 0 && (
              <CriteriaItem label={t('scheme.category')} value={criteria.allowedCategories.join(', ')} />
            )}
            {criteria.allowedStates?.length > 0 && (
              <CriteriaItem label={t('scheme.residence')} value={criteria.allowedStates.join(', ')} />
            )}
            {criteria.allowedOccupations?.length > 0 && (
              <CriteriaItem label={t('scheme.occupation')} value={criteria.allowedOccupations.join(', ')} />
            )}
            {criteria.requiresDisability && <CriteriaItem label={t('scheme.disability')} value={t('scheme.requiredValue')} />}
            {criteria.requiresStudent && <CriteriaItem label={t('scheme.studentStatus')} value={t('scheme.requiredValue')} />}
            {criteria.requiresFarmer && <CriteriaItem label={t('scheme.farmerStatus')} value={t('scheme.requiredValue')} />}
            {criteria.requiresSeniorCitizen && <CriteriaItem label={t('scheme.seniorCitizen')} value={t('scheme.requiredValue')} />}
          </div>
        </div>

        {/* Required Documents */}
        {scheme.requiredDocuments && scheme.requiredDocuments.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-slate-800">{t('scheme.requiredDocuments')}</h2>
              <button
                onClick={() => navigate('/wallet')}
                className="text-xs font-semibold text-primary-600 hover:text-primary-700"
              >
                {t('landing.goToWallet')}
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
                        {t('scheme.verificationNeeded')}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-slate-400 mt-3">
              {t('scheme.walletHintPre')}
              <button onClick={() => navigate('/wallet')} className="text-primary-600 hover:underline font-medium">
                {t('scheme.walletHintLink')}
              </button>
              {t('scheme.walletHintPost')}
            </p>
          </div>
        )}

        {/* Application Process */}
        {scheme.applicationProcess && (
          <div className="card">
            <h2 className="font-semibold text-slate-800 mb-3">{t('scheme.applicationProcess')}</h2>
            <p className="text-sm text-slate-600 whitespace-pre-line">{scheme.applicationProcess}</p>
          </div>
        )}

        {/* Deadline + Apply */}
        <div className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            {scheme.deadline && (
              <>
                <p className="text-sm text-slate-500">{t('scheme.deadline')}</p>
                <p className="font-medium text-slate-800">{scheme.deadline}</p>
                {recommendation?.daysRemaining != null && (
                  <p className="text-xs text-warning-500 mt-0.5">
                    {recommendation.daysRemaining >= 0
                      ? t('scheme.daysRemaining', { count: recommendation.daysRemaining })
                      : t('scheme.deadlinePassed')}
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
              {t('scheme.applyOfficially')}
            </a>
          ) : (
            <p className="text-sm text-slate-400">{t('scheme.noLink')}</p>
          )}
        </div>

        {scheme.dataSource && (
          <p className="text-xs text-slate-400 text-center -mt-3">
            {t('scheme.officialSource')}: {scheme.dataSource}
            {scheme.linkVerifiedOn ? ` · ${t('scheme.linkChecked', { date: scheme.linkVerifiedOn })}` : ''}
          </p>
        )}

        <p className="text-xs text-slate-400 text-center pb-4">
          {t('scheme.disclaimer')}
        </p>
        {i18n.language !== 'en' && (
          <p className="text-xs text-slate-400 text-center pb-4">{t('scheme.officialTextNotice')}</p>
        )}
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
