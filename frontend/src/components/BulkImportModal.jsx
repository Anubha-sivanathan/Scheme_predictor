import React, { useState } from 'react'
import { importStagingFile } from '../api/admin'

export default function BulkImportModal({ isOpen, onClose, onImportSuccess }) {
  const [file, setFile] = useState(null)
  const [sourceSystem, setSourceSystem] = useState('GOV_OPEN_DATA')
  const [sourceUrl, setSourceUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  if (!isOpen) return null

  const handleFileChange = (e) => {
    const selected = e.target.files[0]
    if (selected) {
      const name = selected.name.toLowerCase()
      if (!name.endsWith('.csv') && !name.endsWith('.json')) {
        setError('Only .csv and .json files are supported.')
        setFile(null)
        return
      }
      setFile(selected)
      setError('')
      setSummary(null)
    }
  }

  const handleImport = async (e) => {
    e.preventDefault()
    if (!file) {
      setError('Please select a CSV or JSON file to import.')
      return
    }

    setLoading(true)
    setError('')
    setSummary(null)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('sourceSystem', sourceSystem.trim() || 'GOV_OPEN_DATA')
    if (sourceUrl.trim()) {
      formData.append('sourceUrl', sourceUrl.trim())
    }

    try {
      const result = await importStagingFile(formData)
      setSummary(result)
      if (onImportSuccess) {
        onImportSuccess(result)
      }
    } catch (err) {
      console.error('Import failed:', err)
      setError(
        err.response?.data?.message || 'Failed to import scheme data. Please verify file format.'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setFile(null)
    setSummary(null)
    setError('')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-slate-800 text-base">Bulk Ingestion Pipeline</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Upload official government scheme dataset (CSV or JSON) to staging for review.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-medium">
              {error}
            </div>
          )}

          {!summary ? (
            <form onSubmit={handleImport} className="space-y-4">
              <div>
                <label className="block text-slate-700 font-medium mb-1.5">
                  Select Dataset File *
                </label>
                <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-primary-400 transition-colors bg-slate-50/50">
                  <input
                    type="file"
                    id="bulk-scheme-file"
                    accept=".csv,.json"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label htmlFor="bulk-scheme-file" className="cursor-pointer block">
                    <span className="text-2xl block mb-1">📄</span>
                    <span className="text-primary-600 font-semibold hover:underline text-xs">
                      Click to choose file
                    </span>
                    <span className="text-slate-500 block text-[11px] mt-1">
                      Supported formats: <strong className="text-slate-700">.csv</strong>,{' '}
                      <strong className="text-slate-700">.json</strong>
                    </span>
                  </label>
                  {file && (
                    <div className="mt-3 inline-flex items-center gap-2 bg-primary-50 text-primary-700 px-3 py-1 rounded-lg text-xs font-medium">
                      <span>✓ {file.name}</span>
                      <span className="text-slate-400 text-[10px]">
                        ({(file.size / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Source System / Tag
                  </label>
                  <input
                    type="text"
                    value={sourceSystem}
                    onChange={(e) => setSourceSystem(e.target.value)}
                    placeholder="e.g. DATA_GOV_IN, TN_GAZETTE"
                    className="input-field text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">
                    Source Dataset URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://data.gov.in/resource/..."
                    className="input-field text-xs"
                  />
                </div>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-800 text-[11px] leading-relaxed">
                <strong>Pipeline Notice:</strong> Imported schemes are placed in the{' '}
                <strong>Staging Collection</strong> under <em>PENDING</em> review. Data will never
                bypass admin approval or write directly to live citizen recommendations.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={loading}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !file}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
                      <span>Ingesting & Validating...</span>
                    </>
                  ) : (
                    <span>Start Ingestion</span>
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Summary Report */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                <p className="font-bold text-sm flex items-center gap-1.5">
                  <span>✓</span> Ingestion Pipeline Completed Successfully
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  Validated records have been safely placed in the staging review queue.
                </p>
              </div>

              {/* Metric Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                  <p className="text-[11px] text-slate-500 font-medium">Total Processed</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">
                    {summary.totalProcessed || 0}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/80">
                  <p className="text-[11px] text-emerald-700 font-medium">Staged as NEW</p>
                  <p className="text-xl font-bold text-emerald-700 mt-0.5">
                    {summary.stagedNew || 0}
                  </p>
                </div>
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200/80">
                  <p className="text-[11px] text-amber-700 font-medium">Staged as UPDATE</p>
                  <p className="text-xl font-bold text-amber-700 mt-0.5">
                    {summary.stagedUpdate || 0}
                  </p>
                </div>
                <div className="p-3 bg-slate-100 rounded-xl border border-slate-200/80">
                  <p className="text-[11px] text-slate-500 font-medium">Skipped Duplicates</p>
                  <p className="text-xl font-bold text-slate-600 mt-0.5">
                    {summary.skippedDuplicates || 0}
                  </p>
                </div>
              </div>

              {/* Errors if any */}
              {summary.rejectedErrors > 0 && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <p className="font-semibold text-rose-700 text-xs mb-1">
                    Rejected Invalid Records ({summary.rejectedErrors}):
                  </p>
                  <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] text-rose-600">
                    {(summary.errors || []).map((err, idx) => (
                      <p key={idx} className="font-mono bg-white/70 p-1.5 rounded">
                        • {err}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button type="button" onClick={handleReset} className="btn-secondary text-xs">
                  Import Another File
                </button>
                <button type="button" onClick={onClose} className="btn-primary text-xs">
                  View Staging Queue
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
