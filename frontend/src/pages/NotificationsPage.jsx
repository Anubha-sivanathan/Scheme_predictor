import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { LoadingState, ErrorState, EmptyState } from '../components/StateViews'
import { notificationText } from '../i18n/server'
import { getNotifications, markNotificationRead, deleteNotification } from '../api/notifications'

const TYPE_ICON = {
  NEW_SCHEME: '🆕',
  DEADLINE_APPROACHING: '⏰',
  SCHEME_UPDATED: '✏️',
  RECOMMENDATION: '🎯',
}

export default function NotificationsPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = () => {
    setLoading(true)
    setError(false)
    getNotifications()
      .then((data) => setNotifications(data.notifications || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
  }, [])

  const handleClick = async (n) => {
    if (!n.read) {
      try {
        await markNotificationRead(n.id)
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
      } catch (e) {
        console.error(e)
      }
    }
    if (n.relatedSchemeId) {
      navigate(`/schemes/${n.relatedSchemeId}`)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    try {
      await deleteNotification(id)
      setNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">{t('notifications.title')}</h1>
        <p className="text-xs text-slate-400 mb-4">{t('notifications.serverTextNotice')}</p>

        {loading ? (
          <LoadingState message={t('notifications.loading')} />
        ) : error ? (
          <ErrorState message={t('notifications.loadFailed')} onRetry={load} />
        ) : notifications.length === 0 ? (
          <EmptyState message={t('notifications.empty')} icon="🔔" />
        ) : (
          <div className="card divide-y divide-slate-100 p-0 overflow-hidden">
            {notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                className={`flex items-start gap-3 px-5 py-4 cursor-pointer transition-colors ${
                  n.read ? 'bg-white' : 'bg-primary-50/40'
                } hover:bg-slate-50`}
              >
                <span className="text-lg shrink-0">{TYPE_ICON[n.type] || '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? 'text-slate-600' : 'text-slate-800 font-medium'}`}>
                    {notificationText(n, t, i18n.language)}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {n.createdAt ? new Date(n.createdAt).toLocaleString(i18n.language) : ''}
                  </p>
                </div>
                <button
                  onClick={(e) => handleDelete(e, n.id)}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                  aria-label={t('notifications.delete')}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
      <Chatbot />
    </div>
  )
}
