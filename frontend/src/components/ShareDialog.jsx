import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { createShare, getShares, revokeShare, getShareEvents } from '../api/wallet'

// Mirrors the server rule; the server is the authority and enforces it again.
export const BLOCKED_TYPES = ['AADHAAR']
export const RISKY_TYPES = [
  'INCOME_CERTIFICATE',
  'CASTE_CERTIFICATE',
  'DISABILITY',
  'LAND',
  'RESIDENCE_CERTIFICATE',
  'RATION_CARD',
  'BANK_PASSBOOK',
  'EMPLOYMENT',
]

const EXPIRY_CHOICES = [
  { hours: 1, unit: 'hours', n: 1 },
  { hours: 24, unit: 'hours', n: 24 },
  { hours: 72, unit: 'days', n: 3 },
  { hours: 168, unit: 'days', n: 7 },
]

export function shareStatus(link, now = Date.now()) {
  if (link.revokedAt) return 'revoked'
  if (new Date(link.expiresAt).getTime() <= now) return 'expired'
  return 'active'
}

export default function ShareDialog({ doc, onClose }) {
  const { t, i18n } = useTranslation()
  const blocked = BLOCKED_TYPES.includes(doc.documentType)
  const risky = RISKY_TYPES.includes(doc.documentType)

  const [permission, setPermission] = useState('VIEW')
  const [expiry, setExpiry] = useState(24)
  const [acknowledged, setAcknowledged] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [newLink, setNewLink] = useState(null)
  const [copied, setCopied] = useState(false)
  const [links, setLinks] = useState([])
  const [events, setEvents] = useState({}) // shareId -> events[]

  const loadLinks = () => getShares(doc.id).then(setLinks).catch(() => {})

  useEffect(() => {
    if (!blocked) loadLinks()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const created = await createShare(doc.id, {
        permission,
        expiresInHours: expiry,
        acknowledgeRisk: acknowledged,
      })
      setNewLink(`${window.location.origin}/shared/${created.token}`)
      setCopied(false)
      loadLinks()
    } catch (err) {
      setError(err.response?.data?.message || t('share.failed'))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(newLink)
      setCopied(true)
    } catch {
      /* clipboard blocked; the link is selectable in the field */
    }
  }

  const handleRevoke = async (shareId) => {
    await revokeShare(doc.id, shareId).catch(() => {})
    loadLinks()
  }

  const toggleActivity = async (shareId) => {
    if (events[shareId]) {
      setEvents(({ [shareId]: _, ...rest }) => rest)
      return
    }
    const list = await getShareEvents(doc.id, shareId).catch(() => [])
    setEvents((e) => ({ ...e, [shareId]: list }))
  }

  const fmt = (iso) => new Date(iso).toLocaleString(i18n.language)
  const needsAck = risky
  const canCreate = !creating && (!needsAck || acknowledged)

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <h3 id="share-title" className="font-semibold text-slate-800 text-base break-all">
            {t('share.title', { name: doc.fileName })}
          </h3>
          <button onClick={onClose} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {blocked ? (
          <div role="alert" className="bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-xl p-3">
            {t('share.blockedAadhaar')}
          </div>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 space-y-1.5">
              <p className="font-semibold">⚠ {t('share.riskTitle')}</p>
              <ul className="list-disc pl-4 space-y-1">
                <li>{t('share.risk1')}</li>
                <li>{t('share.risk2')}</li>
                <li>{t('share.risk3')}</li>
              </ul>
              {risky && <p className="font-medium">{t('share.riskSensitive')}</p>}
            </div>

            {risky && (
              <label className="flex items-start gap-2 text-sm text-slate-700 mt-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>{t('share.ack')}</span>
              </label>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              <div>
                <label htmlFor="share-permission" className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('share.permission')}
                </label>
                <select
                  id="share-permission"
                  className="input-field text-sm"
                  value={permission}
                  onChange={(e) => setPermission(e.target.value)}
                >
                  <option value="VIEW">{t('share.viewOnly')}</option>
                  <option value="DOWNLOAD">{t('share.download')}</option>
                </select>
              </div>
              <div>
                <label htmlFor="share-expiry" className="text-xs font-semibold text-slate-600 block mb-1">
                  {t('share.expiry')}
                </label>
                <select
                  id="share-expiry"
                  className="input-field text-sm"
                  value={expiry}
                  onChange={(e) => setExpiry(Number(e.target.value))}
                >
                  {EXPIRY_CHOICES.map((c) => (
                    <option key={c.hours} value={c.hours}>
                      {t(`share.${c.unit}`, { count: c.n })}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-red-600 mt-3">
                {error}
              </p>
            )}

            <button onClick={handleCreate} disabled={!canCreate} className="btn-primary text-sm w-full mt-4">
              {creating ? t('share.creating') : t('share.create')}
            </button>

            {newLink && (
              <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-xs font-semibold text-emerald-800 mb-1.5">{t('share.linkReady')}</p>
                <div className="flex gap-2">
                  <input readOnly value={newLink} className="input-field text-xs" onFocus={(e) => e.target.select()} />
                  <button onClick={handleCopy} className="btn-secondary text-xs shrink-0">
                    {copied ? t('common.copied') : t('common.copy')}
                  </button>
                </div>
              </div>
            )}

            <h4 className="font-semibold text-slate-800 text-sm mt-5 mb-2">{t('share.existing')}</h4>
            {links.length === 0 ? (
              <p className="text-xs text-slate-400">{t('share.noLinks')}</p>
            ) : (
              <ul className="space-y-2">
                {links.map((l) => {
                  const status = shareStatus(l)
                  return (
                    <li key={l.id} className="border border-slate-100 rounded-xl p-2.5 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span
                            className={`font-semibold ${
                              status === 'active' ? 'text-emerald-700' : 'text-slate-400'
                            }`}
                          >
                            {t(`share.${status}`)}
                          </span>
                          <span className="text-slate-500">
                            {' · '}
                            {l.permission === 'DOWNLOAD' ? t('share.download') : t('share.viewOnly')}
                            {' · '}
                            {t('share.expiresOn', { date: fmt(l.expiresAt) })}
                          </span>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => toggleActivity(l.id)}
                            className="text-primary-600 hover:text-primary-700"
                          >
                            {t('share.activity')}
                          </button>
                          {status === 'active' && (
                            <button onClick={() => handleRevoke(l.id)} className="text-red-500 hover:text-red-600">
                              {t('share.revoke')}
                            </button>
                          )}
                        </div>
                      </div>
                      {events[l.id] && (
                        <ul className="mt-2 border-t border-slate-100 pt-2 space-y-0.5 text-slate-500">
                          {events[l.id].length === 0 ? (
                            <li>{t('share.noActivity')}</li>
                          ) : (
                            events[l.id].map((ev) => (
                              <li key={ev.id}>
                                {fmt(ev.at)} — {t(`share.event.${ev.outcome}`, { defaultValue: ev.outcome })}
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
