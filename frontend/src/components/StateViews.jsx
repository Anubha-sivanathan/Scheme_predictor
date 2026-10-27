import React from 'react'
import { useTranslation } from 'react-i18next'

export function LoadingState({ message }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin mb-3" />
      <p className="text-sm">{message ?? t('common.loading')}</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-500">
      <div className="w-12 h-12 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-3 text-xl">
        !
      </div>
      <p className="text-sm text-center max-w-sm">{message ?? t('common.somethingWrong')}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-secondary mt-4 text-sm">
          {t('common.tryAgain')}
        </button>
      )}
    </div>
  )
}

export function EmptyState({ message, icon = '📭' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
      <div className="text-3xl mb-2">{icon}</div>
      <p className="text-sm">{message}</p>
    </div>
  )
}
