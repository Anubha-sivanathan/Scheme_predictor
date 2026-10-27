import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import LanguageSwitcher from '../components/LanguageSwitcher'

export default function RegisterPage() {
  const { t } = useTranslation()
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    if (!name.trim()) return t('auth.errors.nameRequired')
    if (!email.trim()) return t('auth.errors.emailRequired')
    if (password.length < 8) return t('auth.errors.passwordMin')
    return ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await register(name.trim(), email.trim(), password)
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || t('auth.errors.registerFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-end mb-2">
          <LanguageSwitcher />
        </div>
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center font-bold text-lg mx-auto mb-3">
            SP
          </div>
          <h1 className="text-xl font-semibold text-slate-800">{t('auth.createTitle')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('auth.createSubtitle')}</p>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          {error && (
            <div role="alert" className="bg-red-50 text-red-600 text-sm rounded-xl px-3 py-2">{error}</div>
          )}

          <div>
            <label htmlFor="reg-name" className="text-sm font-medium text-slate-700 block mb-1.5">{t('auth.fullName')}</label>
            <input id="reg-name" value={name} onChange={(e) => setName(e.target.value)} className="input-field" placeholder={t('auth.namePlaceholder')} />
          </div>

          <div>
            <label htmlFor="reg-email" className="text-sm font-medium text-slate-700 block mb-1.5">{t('auth.email')}</label>
            <input
              id="reg-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-field"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="reg-password" className="text-sm font-medium text-slate-700 block mb-1.5">{t('auth.password')}</label>
            <input
              id="reg-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
              placeholder={t('auth.passwordHint')}
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? t('auth.creatingAccount') : t('auth.createAccount')}
          </button>

          <p className="text-sm text-center text-slate-500">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
              {t('auth.signIn')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
