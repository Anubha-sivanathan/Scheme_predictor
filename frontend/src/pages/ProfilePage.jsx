import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import { getProfile, updateProfile } from '../api/profile'
import { getSchemeHistory } from '../api/schemeHistory'
import { getSavedSchemes } from '../api/savedSchemes'
import { useAuth } from '../context/AuthContext'

const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'EWS']
const GENDER_OPTIONS = ['Male', 'Female', 'Other']

// The server reports missing fields as English display names; map them to locale keys.
const MISSING_FIELD_KEYS = {
  Age: 'age',
  Gender: 'gender',
  State: 'state',
  District: 'district',
  'Annual income': 'income',
  Occupation: 'occupation',
  Education: 'education',
  Category: 'category',
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [data, setData] = useState(null) // { profile, completionPercentage, missingFields }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  const [history, setHistory] = useState([])
  const [saved, setSaved] = useState([])

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([getProfile(), getSchemeHistory(), getSavedSchemes()])
      .then(([profileData, historyData, savedData]) => {
        setData(profileData)
        setForm(profileData.profile || {})
        setHistory(historyData)
        setSaved(savedData)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updated = await updateProfile(form)
      setData(updated)
      setForm(updated.profile || {})
      setEditing(false)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <LoadingState message={t('profile.loading')} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <ErrorState message={t('profile.loadFailed')} onRetry={load} />
      </div>
    )
  }

  const { completionPercentage, missingFields } = data
  const profile = data.profile

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* A. Profile image + header */}
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-600 font-semibold text-xl flex items-center justify-center shrink-0">
            {(user?.name || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-slate-800 truncate">{user?.name}</h1>
            <p className="text-sm text-slate-500 truncate">{user?.email}</p>
          </div>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn-secondary text-sm shrink-0">
              {t('profile.edit')}
            </button>
          )}
        </div>

        {/* D. Profile Completion */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-800">{t('profile.completion')}</h2>
            <span className="text-sm font-semibold text-primary-600">{completionPercentage}%</span>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-primary-600 rounded-full transition-all"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
          {missingFields?.length > 0 ? (
            <p className="text-xs text-slate-500">
              {t('profile.completeHint', {
                fields: missingFields
                  .map((f) => (MISSING_FIELD_KEYS[f] ? t(`profile.fieldNames.${MISSING_FIELD_KEYS[f]}`) : f))
                  .join(', '),
              })}
            </p>
          ) : (
            <p className="text-xs text-success-500">{t('profile.complete')}</p>
          )}
        </div>

        {/* B & C. Personal Details / Edit */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">{t('profile.personal')}</h2>

          {!editing ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailItem label={t('profile.fullName')} value={profile.fullName} />
              <DetailItem label={t('profile.dateOfBirth')} value={profile.dateOfBirth} />
              <DetailItem label={t('profile.age')} value={profile.age} />
              <DetailItem label={t('profile.gender')} value={profile.gender ? t(`profile.genders.${profile.gender}`, { defaultValue: profile.gender }) : null} />
              <DetailItem label={t('profile.state')} value={profile.state} />
              <DetailItem label={t('profile.district')} value={profile.district} />
              <DetailItem label={t('profile.pinCode')} value={profile.pinCode} />
              <DetailItem label={t('profile.address')} value={profile.address} />
              <DetailItem label={t('profile.education')} value={profile.education} />
              <DetailItem label={t('profile.occupation')} value={profile.occupation} />
              <DetailItem label={t('profile.income')} value={profile.income ? `₹${profile.income.toLocaleString(i18n.language)}` : null} />
              <DetailItem label={t('profile.category')} value={profile.category} />
              <DetailItem label={t('profile.familySize')} value={profile.familySize} />
              <DetailItem label={t('profile.landHolding')} value={profile.landHoldingAcres != null ? t('profile.acres', { value: profile.landHoldingAcres }) : null} />
              <DetailItem label={t('profile.disability')} value={profile.disability != null ? (profile.disability ? t('common.yes') : t('common.no')) : null} />
              <DetailItem label={t('profile.student')} value={profile.isStudent != null ? (profile.isStudent ? t('common.yes') : t('common.no')) : null} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label={t('profile.fullName')}>
                <input className="input-field" value={form.fullName ?? ''} onChange={(e) => handleChange('fullName', e.target.value)} />
              </Field>
              <Field label={t('profile.dateOfBirth')}>
                <input
                  className="input-field"
                  placeholder="DD/MM/YYYY"
                  value={form.dateOfBirth ?? ''}
                  onChange={(e) => handleChange('dateOfBirth', e.target.value)}
                />
              </Field>
              <Field label={t('profile.age')}>
                <input
                  type="number"
                  className="input-field"
                  value={form.age ?? ''}
                  onChange={(e) => handleChange('age', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label={t('profile.gender')}>
                <select className="input-field" value={form.gender ?? ''} onChange={(e) => handleChange('gender', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{t(`profile.genders.${g}`)}</option>)}
                </select>
              </Field>
              <Field label={t('profile.state')}>
                <input className="input-field" value={form.state ?? ''} onChange={(e) => handleChange('state', e.target.value)} />
              </Field>
              <Field label={t('profile.district')}>
                <input className="input-field" value={form.district ?? ''} onChange={(e) => handleChange('district', e.target.value)} />
              </Field>
              <Field label={t('profile.pinCode')}>
                <input
                  className="input-field"
                  inputMode="numeric"
                  maxLength={6}
                  value={form.pinCode ?? ''}
                  onChange={(e) => handleChange('pinCode', e.target.value.replace(/\D/g, ''))}
                />
              </Field>
              <Field label={t('profile.address')}>
                <input className="input-field" value={form.address ?? ''} onChange={(e) => handleChange('address', e.target.value)} />
              </Field>
              <Field label={t('profile.education')}>
                <input className="input-field" value={form.education ?? ''} onChange={(e) => handleChange('education', e.target.value)} placeholder={t('profile.educationPlaceholder')} />
              </Field>
              <Field label={t('profile.occupation')}>
                <input className="input-field" value={form.occupation ?? ''} onChange={(e) => handleChange('occupation', e.target.value)} />
              </Field>
              <Field label={t('profile.incomeInput')}>
                <input
                  type="number"
                  className="input-field"
                  value={form.income ?? ''}
                  onChange={(e) => handleChange('income', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label={t('profile.category')}>
                <select className="input-field" value={form.category ?? ''} onChange={(e) => handleChange('category', e.target.value)}>
                  <option value="">{t('common.select')}</option>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label={t('profile.familySize')}>
                <input
                  type="number"
                  className="input-field"
                  value={form.familySize ?? ''}
                  onChange={(e) => handleChange('familySize', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label={t('profile.landHoldingInput')}>
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  value={form.landHoldingAcres ?? ''}
                  onChange={(e) => handleChange('landHoldingAcres', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label={t('profile.disability')}>
                <select
                  className="input-field"
                  value={form.disability == null ? '' : String(form.disability)}
                  onChange={(e) => handleChange('disability', e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">{t('common.select')}</option>
                  <option value="true">{t('common.yes')}</option>
                  <option value="false">{t('common.no')}</option>
                </select>
              </Field>
              <Field label={t('profile.student')}>
                <select
                  className="input-field"
                  value={form.isStudent == null ? '' : String(form.isStudent)}
                  onChange={(e) => handleChange('isStudent', e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">{t('common.select')}</option>
                  <option value="true">{t('common.yes')}</option>
                  <option value="false">{t('common.no')}</option>
                </select>
              </Field>

              <div className="sm:col-span-2 flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? t('profile.saving') : t('profile.saveChanges')}
                </button>
                <button onClick={() => { setEditing(false); setForm(profile) }} className="btn-secondary">
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* E. Scheme History */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">{t('profile.recentlyViewed')}</h2>
            <button onClick={() => navigate('/scheme-history')} className="text-sm text-primary-600 hover:text-primary-700">
              {t('common.viewAll')}
            </button>
          </div>
          {history.length === 0 ? (
            <EmptyState message={t('profile.noHistory')} icon="🕒" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {history.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  onClick={() => navigate(`/schemes/${s.id}`)}
                  className="py-2.5 first:pt-0 last:pb-0 cursor-pointer text-sm text-slate-700 hover:text-primary-600"
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* F. Saved Schemes */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">{t('nav.savedSchemes')}</h2>
            <button onClick={() => navigate('/saved-schemes')} className="text-sm text-primary-600 hover:text-primary-700">
              {t('common.viewAll')}
            </button>
          </div>
          {saved.length === 0 ? (
            <EmptyState message={t('profile.noSaved')} icon="♡" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {saved.slice(0, 5).map((s) => (
                <li
                  key={s.id}
                  onClick={() => navigate(`/schemes/${s.id}`)}
                  className="py-2.5 first:pt-0 last:pb-0 cursor-pointer text-sm text-slate-700 hover:text-primary-600"
                >
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <Chatbot />
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-700">{value ?? '—'}</p>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1.5">{label}</label>
      {children}
    </div>
  )
}
