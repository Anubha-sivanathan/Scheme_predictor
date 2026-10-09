import React, { useEffect, useRef, useState } from 'react'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import { getDocuments, uploadDocument, verifyDocumentFields, deleteDocument, syncWallet } from '../api/wallet'
import { getProfile } from '../api/profile'

const DOCUMENT_TYPES = [
  { value: 'AADHAAR', label: 'Aadhaar Card' },
  { value: 'INCOME_CERTIFICATE', label: 'Income Certificate' },
  { value: 'CASTE_CERTIFICATE', label: 'Community / Caste Certificate' },
  { value: 'RESIDENCE_CERTIFICATE', label: 'Residence / Nativity Certificate' },
  { value: 'RATION_CARD', label: 'Ration / Family Smart Card' },
  { value: 'EDUCATION', label: 'Education / Student Certificate' },
  { value: 'DISABILITY', label: 'Disability Certificate / UDID' },
  { value: 'LAND', label: 'Land Document (Patta / Chitta / Adangal)' },
  { value: 'EMPLOYMENT', label: 'Employment / Labour Document' },
  { value: 'BANK_PASSBOOK', label: 'Bank Passbook (DBT Details)' },
  { value: 'OTHER', label: 'Other Document' },
]

export default function WalletPage() {
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
    try {
      const doc = await uploadDocument(uploadType, file)
      setDocuments((prev) => [doc, ...prev])
      if (doc.extractedFields && Object.keys(doc.extractedFields).length > 0) {
        openReview(doc)
      }
    } catch (err) {
      console.error('Upload failed', err)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const openReview = (doc) => {
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
      // Refresh profile to reflect synced Data Wallet attributes
      const updatedProfileData = await getProfile()
      setProfile(updatedProfileData.profile)
    } catch (err) {
      console.error('Verification failed', err)
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
            <h1 className="text-xl font-semibold text-slate-800">Unified Socio-Economic Data Wallet</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Securely upload and verify your government certificates. Verified data automatically normalizes into your citizen profile.
            </p>
          </div>
          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="btn-secondary text-xs shrink-0 self-start sm:self-auto"
          >
            {syncing ? 'Syncing...' : syncSuccess ? '✓ Synced!' : '⟳ Sync Data Wallet'}
          </button>
        </div>

        {/* Unified Profile Summary Card */}
        {profile && (
          <div className="card bg-gradient-to-br from-white to-primary-50/30 border border-primary-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-success-500 animate-pulse" />
                <h2 className="font-semibold text-slate-800 text-sm">Unified Citizen Profile Status</h2>
              </div>
              <span className="badge-success text-xs">
                {verifiedCount} {verifiedCount === 1 ? 'Document Verified' : 'Documents Verified'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <WalletField label="Age" value={profile.age ? `${profile.age} yrs` : 'Not verified'} />
              <WalletField label="Gender" value={profile.gender || 'Not verified'} />
              <WalletField label="State" value={profile.state || 'Not verified'} />
              <WalletField label="District" value={profile.district || 'Not verified'} />
              <WalletField
                label="Annual Income"
                value={profile.income != null ? `₹${profile.income.toLocaleString()}` : 'Not verified'}
              />
              <WalletField label="Community / Category" value={profile.category || 'Not verified'} />
              <WalletField label="Family Size" value={profile.familySize ? `${profile.familySize} members` : 'Not verified'} />
              <WalletField label="Education" value={profile.education || 'Not verified'} />
              <WalletField label="Student Status" value={profile.isStudent ? 'Student' : 'Non-Student'} />
              <WalletField
                label="Land Holding"
                value={profile.landHoldingAcres != null ? `${profile.landHoldingAcres} acres` : '0 acres'}
              />
              <WalletField
                label="Disability Status"
                value={profile.disability ? `Yes (${profile.disabilityPercentage || 0}%)` : 'None'}
              />
              <WalletField
                label="Employment Status"
                value={profile.employmentStatus || profile.occupation || 'Not provided'}
              />
            </div>
          </div>
        )}

        {/* Upload Card */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-2">Upload Government Document</h2>
          <p className="text-xs text-slate-500 mb-4">
            Upload document images (JPG, PNG) or PDFs. Our OCR engine extracts key identity and socio-economic fields for your review.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="input-field sm:w-80 text-sm"
            >
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <label className="btn-primary text-center cursor-pointer text-sm">
              {uploading ? 'Processing OCR...' : 'Choose Document File'}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Document List */}
        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">Your Wallet Documents ({documents.length})</h2>

          {loading ? (
            <LoadingState message="Loading documents..." />
          ) : error ? (
            <ErrorState message="Couldn't load your documents." onRetry={load} />
          ) : documents.length === 0 ? (
            <EmptyState message="No documents uploaded yet. Upload your Aadhaar, Income, or Caste certificate to begin." icon="📄" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <li key={doc.id} className="py-3.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {DOCUMENT_TYPES.find((t) => t.value === doc.documentType)?.label || doc.documentType}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                    <StatusBadge status={doc.verificationStatus} />
                    {(doc.extractedFields || doc.verifiedFields) && (
                      <button
                        onClick={() => openReview(doc)}
                        className="text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 px-2.5 py-1 rounded-md"
                      >
                        {doc.verificationStatus === 'VERIFIED' ? 'Edit Details' : 'Review OCR'}
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="text-xs text-red-500 hover:text-red-600 px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
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
              <h3 className="font-semibold text-slate-800 text-base">Review & Confirm Extracted Fields</h3>
              <p className="text-xs text-slate-500 mt-1">
                OCR extracted the following information. Please verify accuracy before confirming — verified details will update your Unified Citizen Profile.
              </p>
            </div>

            <div className="space-y-3 overflow-y-auto flex-1 pr-1">
              {Object.entries(reviewFields).length === 0 ? (
                <div className="p-4 bg-slate-50 rounded-xl text-center">
                  <p className="text-sm text-slate-500">No structured fields were extracted automatically.</p>
                  <p className="text-xs text-slate-400 mt-1">You can verify details or enter them manually in your Profile.</p>
                </div>
              ) : (
                Object.entries(reviewFields).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-xs font-semibold text-slate-600 block mb-1">
                      {formatFieldLabel(key)}
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

            <div className="flex gap-3 mt-6 pt-3 border-t border-slate-100">
              <button onClick={handleConfirmReview} className="btn-primary flex-1 text-sm py-2">
                Confirm & Sync with Profile
              </button>
              <button onClick={() => setReviewingDoc(null)} className="btn-secondary flex-1 text-sm py-2">
                Cancel
              </button>
            </div>
          </div>
        </div>
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

function StatusBadge({ status }) {
  const map = {
    PENDING: { label: 'Pending OCR', cls: 'badge-warning' },
    OCR_EXTRACTED: { label: 'Needs Review', cls: 'bg-amber-50 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full' },
    VERIFIED: { label: 'Verified ✓', cls: 'badge-success' },
    REJECTED: { label: 'Rejected', cls: 'bg-red-50 text-red-600 text-xs font-medium px-2.5 py-1 rounded-full' },
  }
  const cfg = map[status] || map.PENDING
  return <span className={cfg.cls}>{cfg.label}</span>
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
