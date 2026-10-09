import React, { useEffect, useState } from 'react'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import SchemeCard from '../components/SchemeCard'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import { getSchemeHistory } from '../api/schemeHistory'

export default function SchemeHistoryPage() {
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    getSchemeHistory()
      .then(setSchemes)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Scheme History</h1>

        {loading ? (
          <LoadingState message="Loading history..." />
        ) : error ? (
          <ErrorState message="Couldn't load your scheme history." onRetry={load} />
        ) : schemes.length === 0 ? (
          <EmptyState message="No schemes viewed yet." icon="🕒" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {schemes.map((s) => (
              <SchemeCard key={s.id} scheme={s} />
            ))}
          </div>
        )}
      </main>
      <Chatbot />
    </div>
  )
}
