import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'

import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LandingPage from './pages/LandingPage'
import SchemeDetailPage from './pages/SchemeDetailPage'
import ProfilePage from './pages/ProfilePage'
import WalletPage from './pages/WalletPage'
import NotificationsPage from './pages/NotificationsPage'
import SavedSchemesPage from './pages/SavedSchemesPage'
import SchemeHistoryPage from './pages/SchemeHistoryPage'
import SettingsPage from './pages/SettingsPage'
import AdminSchemesPage from './pages/AdminSchemesPage'

function ProtectedRoute({ children }) {
  const { user } = useAuth()
  const hasToken = localStorage.getItem('token')
  if (!user && !hasToken) {
    return <Navigate to="/login" replace />
  }
  return children
}

function AdminRoute({ children }) {
  const { user } = useAuth()
  const hasToken = localStorage.getItem('token')
  if (!user && !hasToken) {
    return <Navigate to="/login" replace />
  }
  if (user && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <LandingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/schemes/:id"
        element={
          <ProtectedRoute>
            <SchemeDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/saved-schemes"
        element={
          <ProtectedRoute>
            <SavedSchemesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/scheme-history"
        element={
          <ProtectedRoute>
            <SchemeHistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/schemes"
        element={
          <AdminRoute>
            <AdminSchemesPage />
          </AdminRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
