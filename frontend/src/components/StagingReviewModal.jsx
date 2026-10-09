import React, { useState, useEffect } from 'react'
import {
  getStagingSchemeById,
  approveStagingScheme,
  rejectStagingScheme,
  updateStagingScheme,
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

export default function StagingReviewModal({
  stagingId,
  isOpen,
  onClose,
  onActionComplete,
  allLiveSchemes = [],
}) {
  const [staging, setStaging] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showRejectPrompt, setShowRejectPrompt] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')

  // Edit Form State
  const [editForm, setEditForm] = useState(null)

  useEffect(() => {
    if (isOpen && stagingId) {
      loadStagingRecord(stagingId)
    }
  }, [isOpen, stagingId])

  const loadStagingRecord = async (id) => {
    setLoading(true)
    setError('')
    try {
      const data = await getStagingSchemeById(id)
      setStaging(data)
      initEditForm(data.proposedData)
    } catch (err) {
      console.error('Failed to load staging scheme:', err)
      setError('Could not load staging record details.')
    } finally {
      setLoading(false)
    }
  }

  const initEditForm = (scheme) => {
    if (!scheme) return
    const crit = scheme.eligibilityCriteria || {}
    setEditForm({
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
  }

  if (!isOpen) return null

  // Find corresponding live scheme if UPDATE
  const liveScheme =
    staging?.existingSchemeId && allLiveSchemes.length > 0
      ? allLiveSchemes.find((s) => s.id === staging.existingSchemeId)
      : null

  // Save Staged Edits
  const handleSaveEdits = async (e) => {
    e.preventDefault()
    if (!editForm.name.trim() || !editForm.department.trim()) {
      setError('Name and Department are required.')
      return
    }

    setActionLoading(true)
    setError('')

    const benefits = editForm.benefitsText
      .split('\n')
      .map((b) => b.trim())
      .filter(Boolean)

    const requiredDocuments = editForm.documentsText
      .split('\n')
      .map((d) => d.trim())
      .filter(Boolean)

    const crit = editForm.eligibilityCriteria
    const payload = {
      name: editForm.name.trim(),
      department: editForm.department.trim(),
      category: editForm.category,
      description: editForm.description.trim(),
      applicationLink: editForm.applicationLink.trim(),
      applicationProcess: editForm.applicationProcess.trim(),
      deadline: editForm.deadline || null,
      status: editForm.status,
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
        minDisabilityPercentage:
          crit.minDisabilityPercentage !== '' ? Number(crit.minDisabilityPercentage) : null,
        maxLandHoldingAcres:
          crit.maxLandHoldingAcres !== '' ? Number(crit.maxLandHoldingAcres) : null,
        requiresStudent: crit.requiresStudent,
        requiresFarmer: crit.requiresFarmer,
        requiresDisability: crit.requiresDisability,
        requiresSeniorCitizen: crit.requiresSeniorCitizen,
      },
    }

    try {
      const updatedStaging = await updateStagingScheme(staging.id, payload)
      setStaging(updatedStaging)
      setIsEditing(false)
      if (onActionComplete) {
        onActionComplete({ type: 'EDITED', id: staging.id })
      }
    } catch (err) {
      console.error('Failed to update staging scheme:', err)
      setError(err.response?.data?.message || 'Could not save staged edits.')
    } finally {
      setActionLoading(false)
    }
  }

  // Approve
  const handleApprove = async () => {
    setActionLoading(true)
    setError('')
    try {
      const live = await approveStagingScheme(staging.id)
      if (onActionComplete) {
        onActionComplete({
          type: 'APPROVED',
          id: staging.id,
          schemeName: live.name,
          changeType: staging.changeType,
        })
      }
      onClose()
    } catch (err) {
      console.error('Failed to approve staging scheme:', err)
      setError(err.response?.data?.message || 'Failed to approve scheme.')
    } finally {
      setActionLoading(false)
    }
  }

  // Reject
  const handleReject = async (e) => {
    e.preventDefault()
    if (!rejectionReason.trim()) {
      setError('Please provide an explicit rejection reason.')
      return
    }

    setActionLoading(true)
    setError('')
    try {
      await rejectStagingScheme(staging.id, { reason: rejectionReason.trim() })
      if (onActionComplete) {
        onActionComplete({
          type: 'REJECTED',
          id: staging.id,
          schemeName: staging.proposedData?.name,
        })
      }
      onClose()
    } catch (err) {
      console.error('Failed to reject staging scheme:', err)
      setError(err.response?.data?.message || 'Failed to reject scheme.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col my-6">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-md ${
                staging?.changeType === 'NEW'
                  ? 'bg-emerald-100 text-emerald-800'
                  : staging?.changeType === 'UPDATE'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-rose-100 text-rose-800'
              }`}
            >
              {staging?.changeType || 'REVIEW'}
            </span>
            <div>
              <h2 className="font-semibold text-slate-800 text-base leading-tight">
                {staging?.proposedData?.name || 'Review Staged Government Scheme'}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Staging ID: {staging?.id} • Origin: {staging?.dataOrigin || 'BULK_IMPORT'} • Source:{' '}
                {staging?.sourceSystem || 'OFFICIAL'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!loading && staging?.reviewStatus === 'PENDING' && (
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="btn-secondary text-xs !py-1.5 !px-3"
              >
                {isEditing ? '✕ Cancel Edit' : '✏ Edit Proposed Data'}
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 text-lg leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400">Loading staging record...</div>
          ) : isEditing ? (
            /* EDIT FORM */
            <form onSubmit={handleSaveEdits} className="space-y-5">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                You are editing the <strong>proposed data</strong> in staging before final approval.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Scheme Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Department *</label>
                  <input
                    type="text"
                    required
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Category *</label>
                  <select
                    value={editForm.category}
                    onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                    className="input-field text-xs"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Official Portal Link (HTTPS) *
                  </label>
                  <input
                    type="url"
                    required
                    value={editForm.applicationLink}
                    onChange={(e) => setEditForm({ ...editForm, applicationLink: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Description</label>
                <textarea
                  rows={2}
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  className="input-field text-xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Application Process</label>
                  <textarea
                    rows={2}
                    value={editForm.applicationProcess}
                    onChange={(e) =>
                      setEditForm({ ...editForm, applicationProcess: e.target.value })
                    }
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Deadline</label>
                  <input
                    type="date"
                    value={editForm.deadline}
                    onChange={(e) => setEditForm({ ...editForm, deadline: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              {/* Benefits & Documents */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Key Benefits (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.benefitsText}
                    onChange={(e) => setEditForm({ ...editForm, benefitsText: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Required Documents (One per line)
                  </label>
                  <textarea
                    rows={3}
                    value={editForm.documentsText}
                    onChange={(e) => setEditForm({ ...editForm, documentsText: e.target.value })}
                    className="input-field text-xs"
                  />
                </div>
              </div>

              {/* Eligibility Thresholds */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h4 className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                  Eligibility Criteria Overrides
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Min Age</label>
                    <input
                      type="number"
                      value={editForm.eligibilityCriteria.minAge}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            minAge: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Max Age</label>
                    <input
                      type="number"
                      value={editForm.eligibilityCriteria.maxAge}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            maxAge: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">Max Income (₹)</label>
                    <input
                      type="number"
                      value={editForm.eligibilityCriteria.maxIncome}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            maxIncome: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-700 font-medium mb-1">
                      Max Land (Acres)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={editForm.eligibilityCriteria.maxLandHoldingAcres}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            maxLandHoldingAcres: e.target.value,
                          },
                        })
                      }
                      className="input-field text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.eligibilityCriteria.requiresStudent}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            requiresStudent: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Student</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.eligibilityCriteria.requiresFarmer}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            requiresFarmer: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Farmer</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.eligibilityCriteria.requiresDisability}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
                            requiresDisability: e.target.checked,
                          },
                        })
                      }
                      className="rounded text-primary-600"
                    />
                    <span className="text-slate-700 font-medium">Disability</span>
                  </label>
                  <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.eligibilityCriteria.requiresSeniorCitizen}
                      onChange={(e) =>
                        setEditForm({
                          ...editForm,
                          eligibilityCriteria: {
                            ...editForm.eligibilityCriteria,
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

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary text-xs flex items-center gap-1"
                >
                  {actionLoading ? 'Saving Edits...' : 'Save Staged Changes'}
                </button>
              </div>
            </form>
          ) : staging?.changeType === 'UPDATE' && liveScheme ? (
            /* DIFF VIEWER FOR UPDATES */
            <div className="space-y-4">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
                <strong>Change Detection:</strong> This scheme matches an active scheme{' '}
                <span className="font-semibold text-slate-800 underline">
                  "{liveScheme.name}"
                </span>{' '}
                (ID: {liveScheme.id}). Review side-by-side differences before approving the update.
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3 w-1/4">Field</th>
                      <th className="py-2.5 px-3 w-3/8 text-slate-500">Live Existing Value</th>
                      <th className="py-2.5 px-3 w-3/8 text-primary-700 bg-primary-50/50">
                        Proposed Staged Value
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <DiffRow
                      label="Scheme Name"
                      oldVal={liveScheme.name}
                      newVal={staging.proposedData?.name}
                    />
                    <DiffRow
                      label="Department"
                      oldVal={liveScheme.department}
                      newVal={staging.proposedData?.department}
                    />
                    <DiffRow
                      label="Category"
                      oldVal={liveScheme.category}
                      newVal={staging.proposedData?.category}
                    />
                    <DiffRow
                      label="Description"
                      oldVal={liveScheme.description}
                      newVal={staging.proposedData?.description}
                    />
                    <DiffRow
                      label="Application Link"
                      oldVal={liveScheme.applicationLink}
                      newVal={staging.proposedData?.applicationLink}
                    />
                    <DiffRow
                      label="Deadline"
                      oldVal={liveScheme.deadline || '—'}
                      newVal={staging.proposedData?.deadline || '—'}
                    />
                    <DiffRow
                      label="Key Benefits"
                      oldVal={(liveScheme.benefits || []).join(', ')}
                      newVal={(staging.proposedData?.benefits || []).join(', ')}
                    />
                    <DiffRow
                      label="Required Documents"
                      oldVal={(liveScheme.requiredDocuments || []).join(', ')}
                      newVal={(staging.proposedData?.requiredDocuments || []).join(', ')}
                    />
                    <DiffRow
                      label="Eligibility Criteria"
                      oldVal={formatCriteria(liveScheme.eligibilityCriteria)}
                      newVal={formatCriteria(staging.proposedData?.eligibilityCriteria)}
                    />
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* DETAILS VIEW FOR NEW SCHEMES */
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs">
                <strong>New Scheme Proposal:</strong> This scheme does not match any existing
                records and will be published as a new scheme in the live directory upon approval.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  <p className="font-semibold text-slate-700">Scheme Overview</p>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Department:</span>
                    <span className="font-medium text-slate-800">
                      {staging?.proposedData?.department}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Category:</span>
                    <span className="badge-primary inline-block mt-0.5">
                      {staging?.proposedData?.category}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Official Link:</span>
                    <a
                      href={staging?.proposedData?.applicationLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary-600 hover:underline break-all"
                    >
                      {staging?.proposedData?.applicationLink}
                    </a>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Deadline:</span>
                    <span className="text-slate-700">
                      {staging?.proposedData?.deadline || 'No specific deadline'}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
                  <p className="font-semibold text-slate-700">Eligibility Rules</p>
                  <p className="text-slate-600 leading-relaxed text-[11px]">
                    {formatCriteria(staging?.proposedData?.eligibilityCriteria)}
                  </p>
                </div>
              </div>

              <div>
                <p className="font-semibold text-slate-700 mb-1">Description</p>
                <p className="p-3 bg-slate-50 rounded-xl text-slate-600 leading-relaxed">
                  {staging?.proposedData?.description || 'No description provided.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Key Benefits</p>
                  <ul className="p-3 bg-slate-50 rounded-xl list-disc list-inside space-y-0.5 text-slate-600">
                    {(staging?.proposedData?.benefits || []).length > 0 ? (
                      staging.proposedData.benefits.map((b, i) => <li key={i}>{b}</li>)
                    ) : (
                      <li className="text-slate-400 italic">None specified</li>
                    )}
                  </ul>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 mb-1">Required Documents</p>
                  <ul className="p-3 bg-slate-50 rounded-xl list-disc list-inside space-y-0.5 text-slate-600">
                    {(staging?.proposedData?.requiredDocuments || []).length > 0 ? (
                      staging.proposedData.requiredDocuments.map((d, i) => <li key={i}>{d}</li>)
                    ) : (
                      <li className="text-slate-400 italic">None specified</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* REJECT PROMPT */}
          {showRejectPrompt && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <p className="font-semibold text-rose-800 text-xs">
                Specify Reason for Rejecting this Staged Scheme *
              </p>
              <textarea
                rows={2}
                required
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Duplicate of existing state welfare scheme, inaccurate criteria, or unverified link."
                className="input-field text-xs !bg-white"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRejectPrompt(false)}
                  className="btn-secondary text-xs !py-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-xl px-3 py-1.5 transition-colors disabled:opacity-50 text-xs"
                >
                  {actionLoading ? 'Rejecting...' : 'Confirm Permanent Rejection'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">
            Close
          </button>

          {!loading && staging?.reviewStatus === 'PENDING' && !isEditing && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowRejectPrompt(true)}
                disabled={actionLoading || showRejectPrompt}
                className="bg-white hover:bg-rose-50 text-rose-600 font-medium rounded-xl px-3 py-2 border border-rose-200 transition-colors text-xs"
              >
                Reject Scheme
              </button>
              <button
                type="button"
                onClick={handleApprove}
                disabled={actionLoading}
                className="btn-primary text-xs flex items-center gap-1.5"
              >
                {actionLoading ? (
                  <>
                    <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                    <span>Processing Approval...</span>
                  </>
                ) : (
                  <span>
                    ✓ Approve &{' '}
                    {staging?.changeType === 'UPDATE' ? 'Update Live Scheme' : 'Publish Live'}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DiffRow({ label, oldVal, newVal }) {
  const isChanged = String(oldVal || '').trim() !== String(newVal || '').trim()

  return (
    <tr className={isChanged ? 'bg-amber-50/40' : 'hover:bg-slate-50/40'}>
      <td className="py-2 px-3 font-medium text-slate-700 align-top">
        <div className="flex items-center gap-1">
          {isChanged && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
          <span>{label}</span>
        </div>
      </td>
      <td className="py-2 px-3 text-slate-500 align-top break-words">
        {oldVal || <span className="text-slate-300 italic">empty</span>}
      </td>
      <td
        className={`py-2 px-3 align-top break-words ${
          isChanged ? 'font-semibold text-amber-900 bg-amber-50/60' : 'text-slate-700'
        }`}
      >
        {newVal || <span className="text-slate-300 italic">empty</span>}
      </td>
    </tr>
  )
}

function formatCriteria(crit) {
  if (!crit) return 'No strict criteria configured (Evaluated as NEEDS_VERIFICATION)'
  const parts = []
  if (crit.minAge != null || crit.maxAge != null) {
    parts.push(`Age: ${crit.minAge ?? 0}–${crit.maxAge ?? '∞'}`)
  }
  if (crit.maxIncome != null) {
    parts.push(`Max Income: ₹${(crit.maxIncome / 100000).toFixed(1)}L`)
  }
  if (crit.allowedGenders?.length > 0) {
    parts.push(`Gender: ${crit.allowedGenders.join(', ')}`)
  }
  if (crit.allowedCategories?.length > 0) {
    parts.push(`Community: ${crit.allowedCategories.join(', ')}`)
  }
  if (crit.requiresStudent) parts.push('Student required')
  if (crit.requiresFarmer) parts.push('Farmer required')
  if (crit.requiresDisability) parts.push('Disability required')
  if (crit.requiresSeniorCitizen) parts.push('Senior Citizen required')
  if (crit.maxLandHoldingAcres != null) {
    parts.push(`Max Land: ${crit.maxLandHoldingAcres} acres`)
  }
  return parts.length > 0 ? parts.join(' • ') : 'No strict criteria rules'
}
