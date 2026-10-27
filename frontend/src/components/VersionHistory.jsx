import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getVersions, uploadVersion, restoreVersion } from '../api/wallet'

const MAX_VERSIONS = 10 // mirrors WalletService.MAX_VERSIONS

export default function VersionHistory({ doc, onClose, onChanged }) {
  const { t, i18n } = useTranslation()
  const [versions, setVersions] = useState([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const load = () => getVersions(doc.id).then((v) => setVersions([...v].reverse())).catch(() => {})

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, doc.currentVersion])

  const run = async (action, okMessage) => {
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const updated = await action()
      onChanged(updated)
      if (okMessage) setMessage(okMessage)
    } catch (err) {
      setError(err.response?.data?.message || t('versions.failed'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (file) run(() => uploadVersion(doc.id, file))
  }

  const currentNumber = versions.length ? versions[0].versionNumber : doc.currentVersion || 1

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="versions-title"
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 id="versions-title" className="font-semibold text-slate-800 text-base break-all">
            {t('versions.title')} — {doc.fileName}
          </h3>
          <button onClick={onClose} aria-label={t('common.close')} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-500 mb-3">{t('versions.hint', { max: MAX_VERSIONS })}</p>

        <label className="btn-secondary text-sm text-center cursor-pointer block">
          {busy ? t('versions.uploading') : t('versions.uploadNew')}
          <input
            ref={fileRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
            className="hidden"
            onChange={handleFile}
            disabled={busy}
          />
        </label>

        {error && (
          <p role="alert" className="text-xs text-red-600 mt-2">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="text-xs text-emerald-700 mt-2">
            {message}
          </p>
        )}

        <ul className="divide-y divide-slate-100 mt-4">
          {versions.map((v) => (
            <li key={v.versionNumber} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-800 truncate">
                  {t('versions.version', { n: v.versionNumber })}
                  {v.versionNumber === currentNumber && (
                    <span className="ml-2 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                      {t('versions.current')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 truncate">
                  {v.fileName}
                  {v.uploadedAt ? ` · ${new Date(v.uploadedAt).toLocaleString(i18n.language)}` : ''}
                </p>
              </div>
              {v.versionNumber !== currentNumber && (
                <button
                  disabled={busy}
                  onClick={() => run(() => restoreVersion(doc.id, v.versionNumber), t('versions.restored'))}
                  className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md shrink-0"
                >
                  {t('versions.restore')}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
