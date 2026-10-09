import React from 'react'
import { useNavigate } from 'react-router-dom'
import { saveScheme, unsaveScheme } from '../api/schemes'

export default function SchemeCard({ scheme, onToggleSave }) {
  const navigate = useNavigate()

  const {
    schemeId,
    id,
    name,
    department,
    category,
    shortDescription,
    description,
    matchPercentage,
    eligible,
    eligibilityStatus,
    eligibilityStatusMessage,
    explanationText,
    keyBenefits,
    benefits,
    daysRemaining,
    saved,
    rank,
    criteriaChecks,
    passedChecks,
    failedChecks,
    missingInformation,
    requiredDocuments,
  } = scheme

  const targetId = schemeId || id
  const desc = shortDescription || description
  const benefitList = keyBenefits || benefits || []

  // Resolve tri-state status: ELIGIBLE, NEEDS_VERIFICATION, NOT_ELIGIBLE
  const status = eligibilityStatus || (eligible === true ? 'ELIGIBLE' : eligible === false ? 'NOT_ELIGIBLE' : null)

  // Criteria checks straight from rule engine
  const passed = passedChecks || (criteriaChecks || []).filter((c) => c.status === 'MET')
  const failed = failedChecks || (criteriaChecks || []).filter((c) => c.status === 'NOT_MET')
  const missing = missingInformation || (criteriaChecks || []).filter((c) => c.status === 'UNKNOWN').map(c => c.label)

  const handleToggleSave = async (e) => {
    e.stopPropagation()
    try {
      if (saved) {
        await unsaveScheme(targetId)
      } else {
        await saveScheme(targetId)
      }
      onToggleSave?.(targetId, !saved)
    } catch (err) {
      console.error('Failed to update saved scheme', err)
    }
  }

  return (
    <div
      onClick={() => navigate(`/schemes/${targetId}`)}
      className="card cursor-pointer hover:shadow-md transition-shadow flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {rank != null && (
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-50 text-primary-700 text-xs font-bold">
              #{rank}
            </span>
          )}
          <div>
            <h3 className="font-semibold text-slate-800 leading-snug">{name}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{department}</p>
          </div>
        </div>
        {matchPercentage != null && (
          <div className="shrink-0 text-right">
            <div className={`text-lg font-bold ${
              status === 'ELIGIBLE'
                ? 'text-emerald-600'
                : status === 'NEEDS_VERIFICATION'
                ? 'text-primary-600'
                : 'text-slate-400'
            }`}>
              {matchPercentage}%
            </div>
            <div className="text-[10px] text-slate-400 uppercase tracking-wide">Match</div>
          </div>
        )}
      </div>

      {desc && <p className="text-sm text-slate-600 line-clamp-2">{desc}</p>}

      <div className="flex flex-wrap items-center gap-2">
        {category && <span className="badge-primary">{category}</span>}
        {status === 'ELIGIBLE' && (
          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-emerald-200">
            <span>✓</span> Eligible
          </span>
        )}
        {status === 'NEEDS_VERIFICATION' && (
          <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-amber-200">
            <span>⚠</span> Needs Verification
          </span>
        )}
        {status === 'NOT_ELIGIBLE' && (
          <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-rose-200">
            <span>✕</span> Not Eligible
          </span>
        )}
        {!status && eligible === true && <span className="badge-success">Appears Eligible</span>}
        {!status && eligible === false && <span className="badge-warning">Check Requirements</span>}
        {daysRemaining != null && daysRemaining >= 0 && (
          <span className={`text-xs ${daysRemaining <= 5 ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
            {daysRemaining === 0 ? 'Deadline today' : `${daysRemaining} days left`}
          </span>
        )}
      </div>

      {/* Explainable AI Narrative */}
      {explanationText && (
        <div className="bg-primary-50/70 border border-primary-100 rounded-xl p-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-1 text-[11px] font-semibold text-primary-700 mb-1">
            <span>✦</span>
            <span>AI Decision Summary</span>
          </div>
          <p className="line-clamp-2 leading-relaxed text-slate-600">{explanationText}</p>
        </div>
      )}

      {/* Criteria Breakdown (Passed / Failed / Missing) */}
      {(passed.length > 0 || failed.length > 0 || (missing.length > 0 && status === 'NEEDS_VERIFICATION')) && (
        <div className="space-y-1">
          {passed.length > 0 && (
            <ul className="text-xs text-slate-600 space-y-0.5">
              {passed.slice(0, 2).map((c, i) => (
                <li key={i} className="flex items-center gap-1.5 truncate">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span className="truncate">{c.label || c}</span>
                </li>
              ))}
            </ul>
          )}

          {failed.length > 0 && (
            <ul className="text-xs text-rose-600 space-y-0.5">
              {failed.slice(0, 2).map((c, i) => (
                <li key={i} className="flex items-center gap-1.5 truncate">
                  <span className="font-bold shrink-0">✕</span>
                  <span className="truncate">{c.label || c}</span>
                  {c.detail && <span className="text-slate-400 text-[11px] truncate">({c.detail})</span>}
                </li>
              ))}
            </ul>
          )}

          {missing.length > 0 && status === 'NEEDS_VERIFICATION' && (
            <div className="flex items-center gap-1 text-[11px] text-amber-700 truncate">
              <span className="font-bold">?</span>
              <span className="font-medium">Missing:</span>
              <span className="text-slate-600 truncate">
                {missing.slice(0, 2).map(m => typeof m === 'object' ? m.label : m).join(', ')}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Required Documents Tags */}
      {requiredDocuments && requiredDocuments.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Required:</span>
          {requiredDocuments.slice(0, 3).map((doc, i) => (
            <span key={i} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[140px]">
              {doc}
            </span>
          ))}
          {requiredDocuments.length > 3 && (
            <span className="text-[10px] text-slate-400">+{requiredDocuments.length - 3} more</span>
          )}
        </div>
      )}

      {benefitList.length > 0 && (
        <ul className="text-xs text-slate-500 space-y-0.5">
          {benefitList.slice(0, 2).map((b, i) => (
            <li key={i} className="truncate">• {b}</li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-slate-50">
        <button
          onClick={() => navigate(`/schemes/${targetId}`)}
          className="text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          View Details →
        </button>
        <button
          onClick={handleToggleSave}
          aria-label="Save scheme"
          className={`text-lg transition-transform hover:scale-110 ${saved ? 'text-rose-500' : 'text-slate-400 hover:text-slate-600'}`}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>
    </div>
  )
}
