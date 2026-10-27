import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/LanguageSwitcher'
import { LoadingState } from '../components/StateViews'
import { getSharedInfo, sharedViewUrl, sharedDownloadUrl } from '../api/share'

/** Public page (no sign-in) that a share link opens. Shows only what the link grants. */
export default function SharedDocumentPage() {
  const { token } = useParams()
  const { t, i18n } = useTranslation()
  const [info, setInfo] = useState(null)
  const [errorKey, setErrorKey] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSharedInfo(token)
      .then(setInfo)
      .catch((err) => {
        const status = err.response?.status
        setErrorKey(status === 410 ? 'gone' : status === 403 ? 'forbidden' : 'notFound')
      })
      .finally(() => setLoading(false))
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher />
        </div>
        <div className="card space-y-4">
          <h1 className="text-lg font-semibold text-slate-800">{t('share.view.title')}</h1>

          {loading ? (
            <LoadingState message={t('share.view.loading')} />
          ) : errorKey ? (
            <div role="alert" className="text-sm text-slate-600">
              <p className="font-semibold text-slate-800 mb-1">{t('share.view.expiredTitle')}</p>
              <p>{t(`share.view.${errorKey}`)}</p>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium text-slate-800 break-all">{info.fileName}</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('share.view.expires', { date: new Date(info.expiresAt).toLocaleString(i18n.language) })}
                </p>
              </div>
              <div className="flex gap-3">
                <a
                  href={sharedViewUrl(token)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary text-sm text-center flex-1"
                >
                  {t('share.view.open')}
                </a>
                {info.permission === 'DOWNLOAD' && (
                  <a href={sharedDownloadUrl(token)} className="btn-secondary text-sm text-center flex-1">
                    {t('share.view.downloadBtn')}
                  </a>
                )}
              </div>
              <p className="text-xs text-slate-400">{t('share.view.notice')}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
