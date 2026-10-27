import React from 'react'
import { useTranslation } from 'react-i18next'
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n'
import { updateLanguage } from '../api/user'

/** Persists to localStorage (via the i18n module) and, when signed in, to the user's account. */
export default function LanguageSwitcher({ className = '', id = 'language-select' }) {
  const { t, i18n } = useTranslation()

  const handleChange = async (e) => {
    const lng = e.target.value
    await setLanguage(lng)
    if (localStorage.getItem('token')) {
      updateLanguage(lng).catch(() => {}) // the local choice stands even if the account sync fails
    }
  }

  return (
    <select
      id={id}
      value={i18n.resolvedLanguage || i18n.language}
      onChange={handleChange}
      aria-label={t('lang.label')}
      className={`text-sm bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-200 ${className}`}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <option key={lng} value={lng} lang={lng}>
          {t(`lang.${lng}`)}
        </option>
      ))}
    </select>
  )
}
