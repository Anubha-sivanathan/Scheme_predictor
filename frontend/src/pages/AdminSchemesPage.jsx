import React, { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import {
  getAdminSchemes,
  createAdminScheme,
  updateAdminScheme,
  toggleAdminSchemeStatus,
  deleteAdminScheme,
} from '../api/admin'

const ALL_CATEGORIES = [
  'Education',
  'Agriculture',
  'Healthcare',
  'Housing',
  'Employment',
  'Women & Child Welfare',
  'Financial Assistance',
  'Disability Support',
  'Senior Citizens',
]

const SOCIAL_CATEGORIES = ['General', 'OBC', 'SC', 'ST', 'EWS']
const GENDER_OPTIONS = ['Female', 'Male', 'Other']

const INITIAL_SCHEME_STATE = {
  name: '',
  department: '',
  category: 'Education',
  description: '',
  applicationLink: '',
  applicationProcess: '',
  deadline: '',
  status: 'ACTIVE',
  benefitsText: '',
  documentsText: '',
  eligibilityCriteria: {
    minAge: '',
    maxAge: '',
    minIncome: '',
    maxIncome: '',
    allowedCategories: [],
    allowedGenders: [],
    allowedStates: ['Tamil Nadu'],
    allowedDistricts: [],
    minDisabilityPercentage: '',
    maxLandHoldingAcres: '',
    requiresStudent: false,
    requiresFarmer: false,
    requiresDisability: false,
    requiresSeniorCitizen: false,
  },
}

export default function AdminSchemesPage() {
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('ALL')
  const [filterStatus, setFilterStatus] = useState('ALL')

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSchemeId, setEditingSchemeId] = useState(null)
  const [formData, setFormData] = useState(INITIAL_SCHEME_STATE)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const loadSchemes = () => {
    setLoading(true)
    setError(false)
    getAdminSchemes()
      .then(setSchemes)
      .catch((err) => {
        console.error('Failed to load admin schemes:', err)
        setError(true)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadSchemes()
  }, [])

  // Open modal for Create
  const handleOpenCreate = () => {
    setEditingSchemeId(null)
    setFormData(INITIAL_SCHEME_STATE)
    setFormError('')
    setIsModalOpen(true)
  }

  // Open modal for Edit
  const handleOpenEdit = (scheme) => {
    setEditingSchemeId(scheme.id)
    const crit = scheme.eligibilityCriteria || {}
    setFormData({
      name: scheme.name || '',
      department: scheme.department || '',
      category: scheme.category || 'Education',
      description: scheme.description || '',
      applicationLink: scheme.applicationLink || '',
      applicationProcess: scheme.applicationProcess || '',
      deadline: scheme.deadline || '',
      status: scheme.status || 'ACTIVE',
      benefitsText: (scheme.benefits || []).join('\n'),
      documentsText: (scheme.requiredDocuments || []).join('\n'),
      eligibilityCriteria: {
        minAge: crit.minAge ?? '',
        maxAge: crit.maxAge ?? '',
        minIncome: crit.minIncome ?? '',
        maxIncome: crit.maxIncome ?? '',
        allowedCategories: crit.allowedCategories || [],
        allowedGenders: crit.allowedGenders || [],
        allowedStates: crit.allowedStates || ['Tamil Nadu'],
        allowedDistricts: crit.allowedDistricts || [],
        minDisabilityPercentage: crit.minDisabilityPercentage ?? '',
        maxLandHoldingAcres: crit.maxLandHoldingAcres ?? '',
        requiresStudent: crit.requiresStudent || false,
        requiresFarmer: crit.requiresFarmer || false,
        requiresDisability: crit.requiresDisability || false,
        requiresSeniorCitizen: crit.requiresSeniorCitizen || false,
      },
    })
    setFormError('')
    setIsModalOpen(true)
  }

  // Save (Create or Update)
  const handleSave = async (e) => {
    e.preventDefault()
    if (!formData.name.trim()) {
      setFormError('Scheme name is required.')
      return
    }
    if (!formData.department.trim()) {
      setFormError('Department is required.')
      return
    }

    setSaving(true)
    setFormError('')

    const benefits = formData.benefitsText
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)

    const requiredDocuments = formData.documentsText
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean)

    const crit = formData.eligibilityCriteria
    const payload = {
      name: formData.name.trim(),
      department: formData.department.trim(),
      category: formData.category,
      description: formData.description.trim(),
      applicationLink: formData.applicationLink.trim(),
      applicationProcess: formData.applicationProcess.trim(),
      deadline: formData.deadline || null,
      status: formData.status,
      benefits,
      requiredDocuments,
      eligibilityCriteria: {
        minAge: crit.minAge !== '' ? Number(crit.minAge) : null,
        maxAge: crit.maxAge !== '' ? Number(crit.maxAge) : null,
        minIncome: crit.minIncome !== '' ? Number(crit.minIncome) : null,
        maxIncome: crit.maxIncome !== '' ? Number(crit.maxIncome) : null,
        allowedCategories: crit.allowedCategories.length > 0 ? crit.allowedCategories : null,
        allowedGenders: crit.allowedGenders.length > 0 ? crit.allowedGenders : null,
        allowedStates: crit.allowedStates.length > 0 ? crit.allowedStates : null,
        allowedDistricts: crit.allowedDistricts.length > 0 ? crit.allowedDistricts : null,
        minDisabilityPercentage: crit.minDisabilityPercentage !== '' ? Number(crit.minDisabilityPercentage) : null,
        maxLandHoldingAcres: crit.maxLandHoldingAcres !== '' ? Number(crit.maxLandHoldingAcres) : null,
        requiresStudent: crit.requiresStudent,
        requiresFarmer: crit.requiresFarmer,
        requiresDisability: crit.requiresDisability,
        requiresSeniorCitizen: crit.requiresSeniorCitizen,
      },
    }

    try {
      if (editingSchemeId) {
        const updated = await updateAdminScheme(editingSchemeId, payload)
        setSchemes((prev) => prev.map((s) => (s.id === editingSchemeId ? updated : s)))
      } else {
        const created = await createAdminScheme(payload)
        setSchemes((prev) => [created, ...prev])
      }
      setIsModalOpen(false)
    } catch (err) {
      console.error('Error saving scheme:', err)
      setFormError(err.response?.data?.message || 'Failed to save scheme. Please verify inputs.')
    } finally {
      setSaving(false)
    }
  }

  // Toggle Scheme Status
  const handleToggleStatus = async (id) => {
    try {
      const updated = await toggleAdminSchemeStatus(id)
      setSchemes((prev) => prev.map((s) => (s.id === id ? updated : s)))
    } catch (err) {
      console.error('Failed to toggle scheme status:', err)
    }
  }

  // Delete Scheme
  const handleDelete = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently delete the scheme "${name}"?`)) {
      return
    }
    try {
      await deleteAdminScheme(id)
      setSchemes((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error('Failed to delete scheme:', err)
      alert('Could not delete scheme.')
    }
  }

  // Filter schemes
  const filteredSchemes = schemes.filter((s) => {
    const matchesSearch =
      searchTerm === '' ||
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.department && s.department.toLowerCase().includes(searchTerm.toLowerCase()))

    const matchesCategory = filterCategory === 'ALL' || s.category === filterCategory
    const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus

    return matchesSearch && matchesCategory && matchesStatus
  })

  // Summary Metrics
  const activeCount = schemes.filter((s) => s.status === 'ACTIVE').length
  const inactiveCount = schemes.filter((s) => s.status !== 'ACTIVE').length

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider bg-primary-100 text-primary-700 px-2.5 py-0.5 rounded-md">
                Admin Control
              </span>
              <h1 className="text-xl font-bold text-slate-800">Government Schemes Portal</h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Configure deterministic eligibility rules, application links, and manage scheme availability.
            </p>
          </div>

          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-1.5 self-start sm:self-auto text-sm">
            <span>+</span> Create New Scheme
          </button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card !p-4">
            <p className="text-xs text-slate-400 font-medium">Total Schemes</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{schemes.length}</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs text-emerald-600 font-medium">Active Schemes</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs text-amber-600 font-medium">Inactive Schemes</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{inactiveCount}</p>
          </div>
          <div className="card !p-4">
            <p className="text-xs text-primary-600 font-medium">Categories</p>
            <p className="text-2xl font-bold text-primary-600 mt-1">
              {new Set(schemes.map((s) => s.category)).size}
            </p>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="card !p-4 flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="Search by scheme name or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field text-xs sm:flex-1"
          />

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input-field text-xs sm:w-48"
          >
            <option value="ALL">All Categories</option>
            {ALL_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="input-field text-xs sm:w-36"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {/* Scheme List Table */}
        {loading ? (
          <LoadingState message="Loading scheme management records..." />
        ) : error ? (
          <ErrorState message="Could not load schemes for administration." onRetry={loadSchemes} />
        ) : filteredSchemes.length === 0 ? (
          <EmptyState message="No schemes match the specified filters." icon="📂" />
        ) : (
          <div className="card !p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Scheme Details</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Eligibility Highlights</th>
                    <th className="py-3 px-3">Deadline</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSchemes.map((s) => {
                    const c = s.eligibilityCriteria || {}
                    const isCritDefined =
                      c.minAge != null ||
                      c.maxAge != null ||
                      c.maxIncome != null ||
                      c.requiresStudent ||
                      c.requiresFarmer ||
                      c.requiresDisability ||
                      (c.allowedGenders && c.allowedGenders.length > 0)

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4 max-w-xs">
                          <p className="font-semibold text-slate-800 truncate" title={s.name}>
                            {s.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {s.department}
                          </p>
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <span className="badge-primary">{s.category}</span>
                        </td>

                        <td className="py-3.5 px-3 max-w-xs">
                          {isCritDefined ? (
                            <div className="text-[11px] text-slate-600 space-y-0.5">
                              {(c.minAge != null || c.maxAge != null) && (
                                <p>Age: {c.minAge ?? '0'}–{c.maxAge ?? '∞'}</p>
                              )}
                              {c.maxIncome != null && (
                                <p>Max Income: ₹{(c.maxIncome / 100000).toFixed(1)}L</p>
                              )}
                              {c.allowedGenders?.length > 0 && (
                                <p className="text-primary-700">Gender: {c.allowedGenders.join(', ')}</p>
                              )}
                              {c.requiresStudent && <span className="mr-1 text-emerald-600 font-semibold">[Student]</span>}
                              {c.requiresFarmer && <span className="mr-1 text-emerald-600 font-semibold">[Farmer]</span>}
                              {c.requiresDisability && <span className="mr-1 text-amber-600 font-semibold">[Disability]</span>}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">No strict rules</span>
                          )}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap text-slate-600">
                          {s.deadline || <span className="text-slate-400">—</span>}
                        </td>

                        <td className="py-3.5 px-3 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(s.id)}
                            className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border transition-colors ${
                              s.status === 'ACTIVE'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                            }`}
                            title="Click to toggle status"
                          >
                            <span>{s.status === 'ACTIVE' ? '● Active' : '○ Inactive'}</span>
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(s)}
                              className="text-primary-600 hover:text-primary-800 font-medium px-2 py-1 rounded hover:bg-primary-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(s.id, s.name)}
                              className="text-rose-500 hover:text-rose-700 font-medium px-2 py-1 rounded hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800 text-base">
                {editingSchemeId ? 'Edit Government Scheme' : 'Create New Government Scheme'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-6 flex-1 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
                  {formError}
                </div>
              )}

              {/* Section 1: Basic Scheme Information */}
              <div className="space-y-3">
                <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  1. Scheme Overview
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Scheme Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="input-field text-xs"
                      placeholder="e.g. Chief Minister Higher Education Scholarship"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Department *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="input-field text-xs"
                      placeholder="e.g. Higher Education Department"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Scheme Category *
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="input-field text-xs"
                    >
                      {ALL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="input-field text-xs"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="input-field text-xs"
                    placeholder="Brief description of the scheme and its objectives..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Official Portal Link
                    </label>
                    <input
                      type="url"
                      value={formData.applicationLink}
                      onChange={(e) => setFormData({ ...formData, applicationLink: e.target.value })}
                      className="input-field text-xs"
                      placeholder="https://..."
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Application Deadline
                    </label>
                    <input
                      type="date"
                      value={formData.deadline}
                      onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                      className="input-field text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Machine-Checkable Eligibility Rules */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                    2. Eligibility Rule Criteria (Evaluated deterministically)
                  </h3>
                  <span className="text-[10px] text-primary-600 font-medium">Rule Engine Source of Truth</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Min Age</label>
                    <input
                      type="number"
                      value={formData.eligibilityCriteria.minAge}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            minAge: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                      placeholder="e.g. 18"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Max Age</label>
                    <input
                      type="number"
                      value={formData.eligibilityCriteria.maxAge}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            maxAge: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                      placeholder="e.g. 35"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Min Income (₹)</label>
                    <input
                      type="number"
                      value={formData.eligibilityCriteria.minIncome}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            minIncome: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                      placeholder="Optional"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Max Income (₹)</label>
                    <input
                      type="number"
                      value={formData.eligibilityCriteria.maxIncome}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            maxIncome: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                      placeholder="e.g. 250000"
                    />
                  </div>
                </div>

                {/* Social Categories Checkbox Group */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">
                    Target Social Categories (Leave unselected for all categories)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {SOCIAL_CATEGORIES.map((cat) => {
                      const selected = formData.eligibilityCriteria.allowedCategories.includes(cat)
                      return (
                        <button
                          type="button"
                          key={cat}
                          onClick={() => {
                            const current = formData.eligibilityCriteria.allowedCategories
                            const updated = selected
                              ? current.filter((c) => c !== cat)
                              : [...current, cat]
                            setFormData({
                              ...formData,
                              eligibilityCriteria: {
                                ...formData.eligibilityCriteria,
                                allowedCategories: updated,
                              },
                            })
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            selected
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                          }`}
                        >
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Gender Targeting */}
                <div>
                  <label className="block text-slate-700 font-medium mb-1.5">
                    Gender Requirement (Leave unselected for all genders)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {GENDER_OPTIONS.map((g) => {
                      const selected = formData.eligibilityCriteria.allowedGenders.includes(g)
                      return (
                        <button
                          type="button"
                          key={g}
                          onClick={() => {
                            const current = formData.eligibilityCriteria.allowedGenders
                            const updated = selected
                              ? current.filter((item) => item !== g)
                              : [...current, g]
                            setFormData({
                              ...formData,
                              eligibilityCriteria: {
                                ...formData.eligibilityCriteria,
                                allowedGenders: updated,
                              },
                            })
                          }}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors ${
                            selected
                              ? 'bg-primary-600 text-white border-primary-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:border-primary-300'
                          }`}
                        >
                          {g}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Specific Thresholds */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Min Disability Percentage (%)
                    </label>
                    <input
                      type="number"
                      value={formData.eligibilityCriteria.minDisabilityPercentage}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            minDisabilityPercentage: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                      placeholder="e.g. 40"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Max Land Holding (Acres)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={formData.eligibilityCriteria.maxLandHoldingAcres}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            maxLandHoldingAcres: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                      placeholder="e.g. 5.0"
                    />
                  </div>
                </div>

                {/* Requirement Flags */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.eligibilityCriteria.requiresStudent}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            requiresStudent: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Requires Student</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.eligibilityCriteria.requiresFarmer}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            requiresFarmer: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Requires Farmer</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.eligibilityCriteria.requiresDisability}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            requiresDisability: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Requires Disability</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.eligibilityCriteria.requiresSeniorCitizen}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          eligibilityCriteria: {
                            ...formData.eligibilityCriteria,
                            requiresSeniorCitizen: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Senior Citizen</span>
                  </label>
                </div>
              </div>

              {/* Section 3: Benefits & Documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Key Benefits (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.benefitsText}
                    onChange={(e) => setFormData({ ...formData, benefitsText: e.target.value })}
                    className="input-field text-xs"
                    placeholder="Full tuition fee waiver&#10;Monthly maintenance allowance ₹1,000"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Required Documents (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.documentsText}
                    onChange={(e) => setFormData({ ...formData, documentsText: e.target.value })}
                    className="input-field text-xs"
                    placeholder="Aadhaar Card&#10;Income Certificate&#10;Community Certificate"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn-primary text-xs">
                  {saving ? 'Saving...' : editingSchemeId ? 'Update Scheme' : 'Create Scheme'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
