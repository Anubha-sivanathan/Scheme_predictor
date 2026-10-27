import i18n from './index'

// Renders server-generated eligibility text in the active language.
//
// The backend keeps sending its English text (so English users and older clients are unaffected) and
// also sends stable codes + raw values (`code`, `params`, `missingInformationCodes`). For any other
// language we rebuild the text from those; anything we cannot rebuild falls back to the English text.

const formatCurrency = (amount) => {
  const n = Number(amount)
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function rangeText(code, params, t) {
  const { min, max } = params
  if (code === 'AGE') {
    if (min != null && max != null) return t('server.range.ageBoth', { min, max })
    if (min != null) return t('server.range.ageMin', { min })
    return t('server.range.ageMax', { max })
  }
  if (code === 'INCOME') {
    if (min != null && max != null) return t('server.range.incomeBoth', { min: formatCurrency(min), max: formatCurrency(max) })
    if (max != null) return t('server.range.incomeMax', { max: formatCurrency(max) })
    return t('server.range.incomeMin', { min: formatCurrency(min) })
  }
  return ''
}

export function checkLabel(check, t) {
  return check.code ? t(`server.check.${check.code}.label`, { defaultValue: check.label }) : check.label
}

export function checkDetail(check, t) {
  const { code, status } = check
  if (!code) return check.detail
  const params = { ...(check.params || {}) }
  const base = `server.check.${code}`
  const values = { ...params, range: rangeText(code, params, t) }
  let key
  if (status === 'UNKNOWN') key = 'unknown'
  else if (params.actual === 'true') key = 'metYes'
  else if (params.actual === 'false') key = 'metNo'
  else if (code === 'SENIOR') key = status === 'MET' ? 'ageMet' : 'ageNotMet'
  else if (status === 'NOT_MET') key = 'notMet'
  else key = 'met'

  // Fall back through notMet -> met, then to the server's English text.
  const candidates = key === 'notMet' ? ['notMet', 'met'] : [key]
  for (const k of candidates) {
    const full = `${base}.${k}`
    if (i18n.exists(full)) return t(full, values)
  }
  return check.detail
}

export function missingLabel(code, english, t) {
  return code ? t(`server.missing.${code}`, { defaultValue: english }) : english
}

function explanation(rec, t) {
  const passed = (rec.passedChecks || []).filter((c) => c.status === 'MET')
  const failed = (rec.failedChecks || []).filter((c) => c.status === 'NOT_MET')
  const status = rec.eligibilityStatus

  if (status === 'ELIGIBLE') {
    const labels = passed.slice(0, 3).map((c) => checkLabel(c, t)).join(', ')
    const others = passed.length > 3 ? t('server.explain.others') : ''
    const income = passed.some((c) => c.code === 'INCOME') ? ` ${t('server.explain.income')}` : ''
    return `${t('server.explain.eligible', { labels, others })}${income}`
  }
  if (status === 'NEEDS_VERIFICATION') {
    const category = t(`categories.${rec.category}`, { defaultValue: rec.category })
    const head = t('server.explain.needs', { category })
    const codes = rec.missingInformationCodes || []
    const docs = (rec.missingInformation || [])
      .slice(0, 3)
      .map((m, i) => missingLabel(codes[i], m, t))
      .join(', ')
    return docs ? `${head} ${t('server.explain.needsUpload', { docs })}` : head
  }
  const items = failed
    .slice(0, 2)
    .map((c) => `${checkLabel(c, t)} (${checkDetail(c, t)})`)
    .join('; ')
  return t('server.explain.notEligible', { items })
}

/** Returns the recommendation with its server text localised. English (or no language) is returned untouched. */
export function localizeRecommendation(rec, t, language) {
  if (!rec || !language || language === 'en') return rec

  const localizeChecks = (list) =>
    list && list.map((c) => ({ ...c, label: checkLabel(c, t), detail: checkDetail(c, t) }))

  const codes = rec.missingInformationCodes || []
  const unconfigured = (rec.criteriaChecks || []).some((c) => c.code === 'UNCONFIGURED')
  const statusMessage = rec.eligibilityStatus
    ? t(`server.status.${unconfigured ? 'UNCONFIGURED' : rec.eligibilityStatus}`, {
        defaultValue: rec.eligibilityStatusMessage,
      })
    : rec.eligibilityStatusMessage

  return {
    ...rec,
    eligibilityStatusMessage: statusMessage,
    explanationText: rec.eligibilityStatus ? explanation(rec, t) : rec.explanationText,
    criteriaChecks: localizeChecks(rec.criteriaChecks),
    passedChecks: localizeChecks(rec.passedChecks),
    failedChecks: localizeChecks(rec.failedChecks),
    // `missingInformation` stays in English: the scheme page matches it against document names.
    missingDisplay: (rec.missingInformation || []).map((m, i) => missingLabel(codes[i], m, t)),
  }
}

export function notificationText(n, t, language) {
  if (!n.params || !language || language === 'en') return n.message
  return t(`server.notification.${n.type}`, { ...n.params, defaultValue: n.message })
}
