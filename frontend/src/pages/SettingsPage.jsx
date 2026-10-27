import React from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function SettingsPage() {
  const { t } = useTranslation()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-semibold text-slate-800">{t('settings.title')}</h1>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">{t('settings.account')}</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">{t('settings.name')}</span>
              <span className="text-slate-800 font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">{t('settings.email')}</span>
              <span className="text-slate-800 font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">{t('settings.role')}</span>
              <span className="text-slate-800 font-medium">{user?.role}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">{t('settings.language')}</h2>
          <LanguageSwitcher id="settings-language-select" />
          <p className="text-xs text-slate-500 mt-2">{t('settings.languageHint')}</p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">{t('settings.privacy')}</h2>
          <p className="text-sm text-slate-600">{t('settings.privacyBody')}</p>
        </div>

        <button onClick={handleLogout} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50 w-full">
          {t('nav.signOut')}
        </button>
      </main>
      <Chatbot />
    </div>
  )
}
