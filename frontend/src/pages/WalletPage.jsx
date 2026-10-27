import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import {
  getDocuments,
  uploadDocument,
  verifyDocumentFields,
  deleteDocument,
  syncWallet,
  getProfileChanges,
  applyProfileChanges,
} from '../api/wallet'
import { getProfile } from '../api/profile'
import ShareDialog from '../components/ShareDialog'
import VersionHistory from '../components/VersionHistory'

const DOCUMENT_TYPES = [
  'AADHAAR',
  'INCOME_CERTIFICATE',
  'CASTE_CERTIFICATE',
  'RESIDENCE_CERTIFICATE',
  'RATION_CARD',
  'EDUCATION',
  'DISABILITY',
  'LAND',
  'EMPLOYMENT',
  'BANK_PASSBOOK',
  'OTHER',
]

export default function WalletPage() {
  const { t, i18n } = useTranslation()
  const [uploadError, setUploadError] = useState('')
  const [sharingDoc, setSharingDoc] = useState(null)
  const [versionsDoc, setVersionsDoc] = useState(null)
  const [documents, setDocuments] = useState([])
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncSuccess, setSyncSuccess] = useState(false)

  const [uploadType, setUploadType] = useState('AADHAAR')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)

  const [reviewingDoc, setReviewingDoc] = useState(null)
  const [reviewFields, setReviewFields] = useState({})
  const [reviewError, setReviewError] = useState('')
  const [uploadNotice, setUploadNotice] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  // Profile values that differ from a just-confirmed document: { doc, items, accepted: Set<field> }
  const [conflicts, setConflicts] = useState(null)
  const [applyingConflicts, setApplyingConflicts] = useState(false)
  const [conflictError, setConflictError] = useState('')

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([getDocuments(), getProfile()])
      .then(([docs, profData]) => {
        setDocuments(docs)
        setProfile(profData.profile)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError('')
    setUploadNotice('')
    try {
      const doc = await uploadDocument(uploadType, file)
      setDocuments((prev) => [doc, ...prev])
      if (doc.extractedFields && Object.keys(doc.extractedFields).length > 0) {
        openReview(doc)
      } else if (doc.verificationStatus === 'OCR_FAILED') {
        setUploadNotice(t('wallet.ocrFailedNotice'))
      } else {
        setUploadNotice(t('wallet.ocrEmptyNotice'))
      }
    } catch (err) {
      console.error('Upload failed', err)
      setUploadError(err.response?.data?.message || t('wallet.uploadFailed'))
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openReview = (doc) => {
    setReviewError('')
    setReviewingDoc(doc)
    setReviewFields(doc.verifiedFields || doc.extractedFields || {})
  }

  const handleFieldChange = (key, value) => {
    setReviewFields((f) => ({ ...f, [key]: value }))
  }

  const handleConfirmReview = async () => {
    try {
      const updated = await verifyDocumentFields(reviewingDoc.id, reviewFields)
      setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      setReviewingDoc(null)
    } catch (err) {
      console.error('Verification failed', err)
      setReviewError(t('wallet.confirmFailed'))
      return
    }
    // Blank profile fields were filled on the server; fields that disagree are left for the user to decide.
    try {
      const [updatedProfileData, items] = await Promise.all([getProfile(), getProfileChanges(reviewingDoc.id)])
      setProfile(updatedProfileData.profile)
      if (items.length > 0) {
        setConflictError('')
        setConflicts({ doc: reviewingDoc, items, accepted: new Set() })
      }
    } catch (err) {
      console.error('Profile refresh failed', err)
    }
  }

  const toggleConflict = (field) => {
    setConflicts((c) => {
      const accepted = new Set(c.accepted)
      if (accepted.has(field)) accepted.delete(field)
      else accepted.add(field)
      return { ...c, accepted }
    })
  }

  const handleApplyConflicts = async () => {
    setApplyingConflicts(true)
    setConflictError('')
    try {
      const updatedProfile = await applyProfileChanges(conflicts.doc.id, [...conflicts.accepted])
      setProfile(updatedProfile)
      setConflicts(null)
    } catch (err) {
      console.error('Applying profile changes failed', err)
      setConflictError(t('wallet.applyFailed'))
    } finally {
      setApplyingConflicts(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await deleteDocument(id)
      setDocuments((prev) => prev.filter((d) => d.id !== id))
    } catch (err) {
      console.error('Delete failed', err)
    }
  }

  const handleManualSync = async () => {
    setSyncing(true)
    try {
      const updated = await syncWallet()
      setProfile(updated)
      setSyncSuccess(true)
      setTimeout(() => setSyncSuccess(false), 3000)
    } catch (err) {
      console.error('Sync failed', err)
    } finally {
      setSyncing(false)
    }
  }

  const verifiedCount = documents.filter((d) => d.verificationStatus === 'VERIFIED').length

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold text-slate-800">{t('wallet.title')}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {t('wallet.subtitle')}
            </p>
          </div>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="btn-secondary text-xs shrink-0 self-start sm:self-auto"
          >
            {syncing ? t('wallet.syncing') : syncSuccess ? t('wallet.synced') : t('wallet.sync')}
          </button>
        </div>

        {/* Unified Profile Summary Card */}
        {profile && (
          <div className="card bg-gradient-to-br from-white to-primary-50/30 border border-primary-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse" />
                <h2 className="font-semibold text-slate-800 text-sm">{t('wallet.profileStatus')}</h2>
              </div>
              <span className="badge-success text-xs">
                {t('wallet.docVerified', { count: verifiedCount })}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <WalletField label={t('profile.age')} value={profile.age ? t('wallet.yrs', { count: profile.age }) : t('wallet.notVerified')} />
              <WalletField label={t('profile.gender')} value={profile.gender ? t(`profile.genders.${profile.gender}`, { defaultValue: profile.gender }) : t('wallet.notVerified')} />
              <WalletField label={t('profile.state')} value={profile.state || t('wallet.notVerified')} />
              <WalletField label={t('profile.district')} value={profile.district || t('wallet.notVerified')} />
              <WalletField
                label={t('profile.income')}
                value={profile.income != null ? `₹${profile.income.toLocaleString(i18n.language)}` : t('wallet.notVerified')}
              />
              <WalletField label={t('wallet.communityCategory')} value={profile.category || t('wallet.notVerified')} />
              <WalletField label={t('profile.familySize')} value={profile.familySize ? t('wallet.members', { count: profile.familySize }) : t('wallet.notVerified')} />
              <WalletField label={t('profile.education')} value={profile.education || t('wallet.notVerified')} />
              <WalletField label={t('wallet.studentStatus')} value={profile.isStudent ? t('wallet.student') : t('wallet.nonStudent')} />
              <WalletField
                label={t('profile.landHolding')}
                value={t('profile.acres', { value: profile.landHoldingAcres != null ? profile.landHoldingAcres : 0 })}
              />
              <WalletField
                label={t('wallet.disabilityStatus')}
                value={profile.disability ? `${t('common.yes')} (${profile.disabilityPercentage || 0}%)` : t('wallet.none')}
              />
              <WalletField
                label={t('wallet.employmentStatus')}
                value={profile.employmentStatus || profile.occupation || t('wallet.notProvided')}
              />
            </div>
          </div>
        )}

        {/* Upload Card */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-2">{t('wallet.uploadTitle')}</h2>
          <p className="text-xs text-slate-500 mb-4">
            {t('wallet.uploadHint')}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="input-field sm:w-80 text-sm"
              aria-label={t('wallet.uploadTitle')}
            >
              {DOCUMENT_TYPES.map((type) => (
                <option key={type} value={type}>{t(`wallet.docTypes.${type}`)}</option>
              ))}
            </select>
            <label className="btn-primary text-center cursor-pointer text-sm">
              {uploading ? t('wallet.processing') : t('wallet.chooseFile')}
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-red-600 mt-3">{uploadError}</p>
          )}
          {uploadNotice && (
            <p role="status" className="text-xs text-amber-700 bg-amber-50 rounded-md px-3 py-2 mt-3">{uploadNotice}</p>
          )}
        </div>

        {/* Document List */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">{t('wallet.listTitle', { count: documents.length })}</h2>

          {loading ? (
            <LoadingState message={t('wallet.loadingDocs')} />
          ) : error ? (
            <ErrorState message={t('wallet.loadFailed')} onRetry={load} />
          ) : documents.length === 0 ? (
            <EmptyState message={t('wallet.empty')} icon="📄" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:flex-wrap justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {t(`wallet.docTypes.${doc.documentType}`, { defaultValue: doc.documentType })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <StatusBadge status={doc.verificationStatus} />
                    {(doc.extractedFields || doc.verifiedFields) && (
                      <button
                        onClick={() => openReview(doc)}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md"
                      >
                        {doc.verificationStatus === 'VERIFIED' ? t('wallet.editDetails') : t('wallet.reviewOcr')}
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                      aria-expanded={expandedId === doc.id}
                      className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md"
                    >
                      {expandedId === doc.id ? t('wallet.hideDetails') : t('wallet.showDetails')}
                    </button>
                    <button
                      onClick={() => setVersionsDoc(doc)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-slate-100 px-2.5 py-1 rounded-md"
                    >
                      {t('versions.title')}{doc.currentVersion > 1 ? ` (v${doc.currentVersion})` : ''}
                    </button>
                    <button
                      onClick={() => setSharingDoc(doc)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md"
                    >
                      {t('share.button')}
                    </button>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs text-red-500 hover:text-red-600 px-2 py-1"
                    >
                      {t('common.delete')}
                    </button>
                  </div>
                  {expandedId === doc.id && <DocumentDetails doc={doc} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {/* Review/Verify Modal */}
      {reviewingDoc && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
            <div className="mb-4">
              <h3 className="font-semibold text-slate-800 text-base">{t('wallet.reviewTitle')}</h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('wallet.reviewHint')}
              </p>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {Object.entries(reviewFields).length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-sm text-slate-500">{t('wallet.noFields')}</p>
                  <p className="text-xs text-slate-400 mt-1">{t('wallet.noFieldsHint')}</p>
                </div>
              ) : (
                Object.entries(reviewFields).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {t(`wallet.fields.${key}`, { defaultValue: formatFieldLabel(key) })}
                    </label>
                    <input
                      className="input-field text-sm"
                      value={value ?? ''}
                      onChange={(e) => handleFieldChange(key, e.target.value)}
                    />
                  </div>
                ))
              )}
            </div>

            {reviewError && (
              <p role="alert" className="text-xs text-red-600 mt-3">{reviewError}</p>
            )}

            <div className="flex gap-3 mt-6 pt-3 border-t border-slate-100">
              <button onClick={handleConfirmReview} className="btn-primary flex-1 text-sm py-2">
                {t('wallet.confirm')}
              </button>
              <button onClick={() => setReviewingDoc(null)} className="btn-secondary flex-1 text-sm py-2">
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile conflict review: nothing is overwritten unless the user ticks it */}
      {conflicts && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center px-4 z-50">
          <div
            role="dialog"
            aria-label={t('wallet.conflictTitle')}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] flex flex-col"
          >
            <h3 className="font-semibold text-slate-800 text-base">{t('wallet.conflictTitle')}</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">{t('wallet.conflictHint')}</p>

            <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
              {conflicts.items.map((c) => (
                <li key={c.field} className="border border-slate-100 rounded-xl p-3">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={conflicts.accepted.has(c.field)}
                      onChange={() => toggleConflict(c.field)}
                    />
                    <span className="text-xs min-w-0">
                      <span className="font-semibold text-slate-700 block">
                        {t(`wallet.profileFields.${c.field}`, { defaultValue: c.field })}
                      </span>
                      <span className="text-slate-500 block">
                        {t('wallet.conflictCurrent')}: <span className="text-slate-700">{formatValue(c.current)}</span>
                      </span>
                      <span className="text-slate-500 block">
                        {t('wallet.conflictProposed')}: <span className="text-primary-700 font-medium">{formatValue(c.proposed)}</span>
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {conflictError && <p role="alert" className="text-xs text-red-600 mt-3">{conflictError}</p>}

            <div className="flex gap-3 mt-6 pt-3 border-t border-slate-100">
              <button
                onClick={handleApplyConflicts}
                disabled={applyingConflicts || conflicts.accepted.size === 0}
                className="btn-primary flex-1 text-sm py-2"
              >
                {t('wallet.conflictApply')}
              </button>
              <button onClick={() => setConflicts(null)} className="btn-secondary flex-1 text-sm py-2">
                {t('wallet.conflictKeep')}
              </button>
            </div>
          </div>
        </div>
      )}

      {sharingDoc && <ShareDialog doc={sharingDoc} onClose={() => setSharingDoc(null)} />}
      {versionsDoc && (
        <VersionHistory
          doc={versionsDoc}
          onClose={() => setVersionsDoc(null)}
          onChanged={(updated) => {
            setDocuments((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
            setVersionsDoc(updated)
          }}
        />
      )}

      <Chatbot />
    </div>
  )
}

function WalletField({ label, value }) {
  return (
    <div className="bg-white/80 p-2.5 rounded-lg border border-slate-100">
      <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
      <p className="text-xs font-semibold text-slate-700 truncate mt-0.5">{value}</p>
    </div>
  )
}

const SENSITIVE_FIELDS = ['aadhaarNumber', 'accountNumber', 'labourRegistrationDetails', 'udid']

/** Shows only the last 4 characters of identity/account numbers in read-only views. */
export function maskSensitive(key, value) {
  const v = String(value ?? '')
  if (!SENSITIVE_FIELDS.includes(key) || v.length <= 4) return v
  return `${'•'.repeat(v.length - 4)}${v.slice(-4)}`
}

function formatValue(value) {
  if (value === true) return '✓'
  if (value === false) return '✗'
  return value == null || value === '' ? '—' : String(value)
}

/** Read-only view of everything OCR extracted (or the user later confirmed) for a document. */
function DocumentDetails({ doc }) {
  const { t } = useTranslation()
  const fields = doc.verifiedFields || doc.extractedFields || {}
  const entries = Object.entries(fields)
  return (
    <div className="w-full basis-full bg-slate-50 rounded-xl p-3" data-testid="document-details">
      {doc.verificationStatus === 'OCR_FAILED' && (
        <p className="text-xs text-red-600 mb-2">{t('wallet.ocrFailedNotice')}</p>
      )}
      {doc.verificationStatus === 'OCR_EMPTY' && (
        <p className="text-xs text-slate-600 mb-2">{t('wallet.ocrEmptyNotice')}</p>
      )}
      {entries.length === 0 ? (
        <p className="text-xs text-slate-500">{t('wallet.noDetails')}</p>
      ) : (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {entries.map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-slate-400">{t(`wallet.fields.${key}`, { defaultValue: formatFieldLabel(key) })}</dt>
              <dd className="font-medium text-slate-700 break-words">{maskSensitive(key, value)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const { t } = useTranslation()
  const map = {
    PENDING: 'badge-warning',
    OCR_EXTRACTED: 'bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full',
    OCR_EMPTY: 'bg-slate-100 text-slate-600 text-xs font-medium px-2.5 py-1 rounded-full',
    OCR_FAILED: 'bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full',
    VERIFIED: 'badge-success',
    REJECTED: 'bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full',
  }
  const key = map[status] ? status : 'PENDING'
  return <span className={map[key]}>{t(`wallet.status.${key}`)}</span>
}

function formatFieldLabel(key) {
  const labels = {
    aadhaarNumber: 'Aadhaar Number',
    dateOfBirth: 'Date of Birth',
    yearOfBirth: 'Year of Birth',
    pinCode: 'PIN Code',
    mobileNumber: 'Mobile Number',
    annualIncome: 'Annual Income (₹)',
    financialYear: 'Financial Year',
    certificateNumber: 'Certificate Number',
    issueDate: 'Issue Date',
    familyCardNumber: 'Family Card Number',
    headOfFamily: 'Head of Family',
    familyMembers: 'Family Members',
    familySize: 'Family Size',
    educationLevel: 'Education Level',
    yearOfStudy: 'Year of Study',
    studentStatus: 'Student Status',
    academicYear: 'Academic Year',
    disabilityType: 'Disability Type',
    disabilityPercentage: 'Disability Percentage (%)',
    udid: 'UDID Number',
    ownerName: 'Owner / Pattadhar Name',
    surveyNumber: 'Survey Number',
    landArea: 'Land Area Extent',
    landHoldingAcres: 'Land Holding (Acres)',
    landType: 'Land Type',
    cultivationStatus: 'Cultivation Status',
    workerCategory: 'Worker Category',
    monthlyIncome: 'Monthly Income (₹)',
    labourRegistrationDetails: 'Labour Registration / UAN',
    accountHolderName: 'Account Holder Name',
    bankName: 'Bank Name',
    accountNumber: 'Account Number',
    ifsc: 'IFSC Code',
    branch: 'Branch Name',
  }
  return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())
}
