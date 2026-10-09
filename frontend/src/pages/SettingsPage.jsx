import React from 'react'
import { useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import Chatbot from '../components/Chatbot'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <h1 className="text-xl font-semibold text-slate-800">Settings</h1>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">Account</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Name</span>
              <span className="text-slate-800 font-medium">{user?.name}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-800 font-medium">{user?.email}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-slate-500">Role</span>
              <span className="text-slate-800 font-medium">{user?.role}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-slate-800 mb-3">Privacy & Consent</h2>
          <p className="text-sm text-slate-600">
            Your socio-economic profile and documents are used only to check eligibility and personalize
            recommendations within this application. You can update or remove your information at any time
            from your Profile and Wallet pages.
          </p>
        </div>

        <button onClick={handleLogout} className="btn-secondary text-red-600 border-red-100 hover:bg-red-50 w-full">
          Sign Out
        </button>
      </main>
      <Chatbot />
    </div>
  )
}
