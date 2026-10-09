import React, { useEffect, useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getNotifications } from '../api/notifications'

export default function NavBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef(null)

  useEffect(() => {
    getNotifications()
      .then((data) => setUnreadCount(data.unreadCount || 0))
      .catch(() => {})
  }, [])

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-primary-600 flex items-center justify-center text-white font-bold text-sm">
            SP
          </div>
          <span className="font-semibold text-slate-800 hidden sm:block">
            Scheme Predictor
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-4">
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/schemes"
              className="text-xs font-bold uppercase tracking-wider bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-lg border border-primary-200 transition-colors flex items-center gap-1"
            >
              <span>⚙</span>
              <span className="hidden sm:inline">Admin Portal</span>
            </Link>
          )}

          <Link
            to="/notifications"
            className="relative w-10 h-10 rounded-xl flex items-center justify-center hover:bg-slate-50 transition-colors"
            aria-label="Notifications"
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
            )}
          </Link>

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-10 h-10 rounded-full bg-primary-50 text-primary-600 font-semibold flex items-center justify-center hover:bg-primary-100 transition-colors"
            >
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </button>

            {menuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-xl shadow-lg border border-slate-100 py-1 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100">
                  <p className="text-sm font-medium text-slate-800 truncate">{user?.name}</p>
                  <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  {user?.role === 'ADMIN' && (
                    <span className="inline-block mt-1 text-[10px] font-bold bg-primary-50 text-primary-700 px-1.5 py-0.5 rounded">
                      ADMINISTRATOR
                    </span>
                  )}
                </div>
                {user?.role === 'ADMIN' && (
                  <MenuLink to="/admin/schemes" onClick={() => setMenuOpen(false)}>
                    <span className="text-primary-700 font-semibold">⚙ Admin Portal</span>
                  </MenuLink>
                )}
                <MenuLink to="/profile" onClick={() => setMenuOpen(false)}>Profile</MenuLink>
                <MenuLink to="/wallet" onClick={() => setMenuOpen(false)}>Wallet</MenuLink>
                <MenuLink to="/saved-schemes" onClick={() => setMenuOpen(false)}>Saved Schemes</MenuLink>
                <MenuLink to="/scheme-history" onClick={() => setMenuOpen(false)}>Scheme History</MenuLink>
                <MenuLink to="/settings" onClick={() => setMenuOpen(false)}>Settings</MenuLink>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

function MenuLink({ to, children, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
    >
      {children}
    </Link>
  )
}

function BellIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="text-slate-600">
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.73 21a2 2 0 01-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
