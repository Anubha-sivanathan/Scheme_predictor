import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import { getProfile, updateProfile } from '../api/profile'
import { getSchemeHistory } from '../api/schemeHistory'
import { getSavedSchemes } from '../api/savedSchemes'
import { useAuth } from '../context/AuthContext'

const CATEGORY_OPTIONS = ['General', 'OBC', 'SC', 'ST', 'EWS']
const GENDER_OPTIONS = ['Male', 'Female', 'Other']

export default function ProfilePage() {
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
        <LoadingState message="Loading your profile..." />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavBar />
        <ErrorState message="Couldn't load your profile." onRetry={load} />
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
              Edit Profile
            </button>
          )}
        </div>

        {/* D. Profile Completion */}
        <div className="card">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-slate-800">Profile Completion</h2>
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
              Complete your profile to receive more accurate scheme recommendations. Missing: {missingFields.join(', ')}.
            </p>
          ) : (
            <p className="text-xs text-success-500">Your profile is complete.</p>
          )}
        </div>

        {/* B & C. Personal Details / Edit */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-4">Personal Details</h2>

          {!editing ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DetailItem label="Age" value={profile.age} />
              <DetailItem label="Gender" value={profile.gender} />
              <DetailItem label="State" value={profile.state} />
              <DetailItem label="District" value={profile.district} />
              <DetailItem label="Education" value={profile.education} />
              <DetailItem label="Occupation" value={profile.occupation} />
              <DetailItem label="Annual Income" value={profile.income ? `₹${profile.income.toLocaleString()}` : null} />
              <DetailItem label="Category" value={profile.category} />
              <DetailItem label="Family Size" value={profile.familySize} />
              <DetailItem label="Land Holding" value={profile.landHoldingAcres != null ? `${profile.landHoldingAcres} acres` : null} />
              <DetailItem label="Disability" value={profile.disability != null ? (profile.disability ? 'Yes' : 'No') : null} />
              <DetailItem label="Student" value={profile.isStudent != null ? (profile.isStudent ? 'Yes' : 'No') : null} />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Age">
                <input
                  type="number"
                  className="input-field"
                  value={form.age ?? ''}
                  onChange={(e) => handleChange('age', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Gender">
                <select className="input-field" value={form.gender ?? ''} onChange={(e) => handleChange('gender', e.target.value)}>
                  <option value="">Select</option>
                  {GENDER_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
              <Field label="State">
                <input className="input-field" value={form.state ?? ''} onChange={(e) => handleChange('state', e.target.value)} />
              </Field>
              <Field label="District">
                <input className="input-field" value={form.district ?? ''} onChange={(e) => handleChange('district', e.target.value)} />
              </Field>
              <Field label="Education">
                <input className="input-field" value={form.education ?? ''} onChange={(e) => handleChange('education', e.target.value)} placeholder="e.g. Graduate" />
              </Field>
              <Field label="Occupation">
                <input className="input-field" value={form.occupation ?? ''} onChange={(e) => handleChange('occupation', e.target.value)} />
              </Field>
              <Field label="Annual Income (₹)">
                <input
                  type="number"
                  className="input-field"
                  value={form.income ?? ''}
                  onChange={(e) => handleChange('income', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Category">
                <select className="input-field" value={form.category ?? ''} onChange={(e) => handleChange('category', e.target.value)}>
                  <option value="">Select</option>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Family Size">
                <input
                  type="number"
                  className="input-field"
                  value={form.familySize ?? ''}
                  onChange={(e) => handleChange('familySize', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Land Holding (acres)">
                <input
                  type="number"
                  step="0.1"
                  className="input-field"
                  value={form.landHoldingAcres ?? ''}
                  onChange={(e) => handleChange('landHoldingAcres', e.target.value ? Number(e.target.value) : null)}
                />
              </Field>
              <Field label="Disability">
                <select
                  className="input-field"
                  value={form.disability == null ? '' : String(form.disability)}
                  onChange={(e) => handleChange('disability', e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>
              <Field label="Student">
                <select
                  className="input-field"
                  value={form.isStudent == null ? '' : String(form.isStudent)}
                  onChange={(e) => handleChange('isStudent', e.target.value === '' ? null : e.target.value === 'true')}
                >
                  <option value="">Select</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              </Field>

              <div className="sm:col-span-2 flex gap-3 pt-2">
                <button onClick={handleSave} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
                <button onClick={() => { setEditing(false); setForm(profile) }} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* E. Scheme History */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800">Recently Viewed</h2>
            <button onClick={() => navigate('/scheme-history')} className="text-sm text-primary-600 hover:text-primary-700">
              View All
            </button>
          </div>
          {history.length === 0 ? (
            <EmptyState message="No schemes viewed yet." icon="🕒" />
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
            <h2 className="font-semibold text-slate-800">Saved Schemes</h2>
            <button onClick={() => navigate('/saved-schemes')} className="text-sm text-primary-600 hover:text-primary-700">
              View All
            </button>
          </div>
          {saved.length === 0 ? (
            <EmptyState message="No saved schemes yet." icon="♡" />
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
