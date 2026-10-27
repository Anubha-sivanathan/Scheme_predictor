import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/admin', () => ({
  getAdminSchemes: vi.fn(() => Promise.resolve([
    { id: '1', name: 'Test Scheme', department: 'Dept', category: 'Education', status: 'ACTIVE', eligibilityCriteria: { minAge: 18, maxIncome: 250000 } },
  ])),
  createAdminScheme: vi.fn(),
  updateAdminScheme: vi.fn(),
  toggleAdminSchemeStatus: vi.fn(),
  deleteAdminScheme: vi.fn(),
}))
vi.mock('../api/notifications', () => ({ getNotifications: vi.fn(() => Promise.resolve({ notifications: [], unreadCount: 0 })) }))

import i18n, { setLanguage } from '../i18n'
import ta from '../locales/ta.json'
import hi from '../locales/hi.json'
import { localizeRecommendation, notificationText, checkDetail } from '../i18n/server'
import AdminSchemesPage from '../pages/AdminSchemesPage'
import { AuthProvider } from '../context/AuthContext'

const t = (...args) => i18n.t(...args)

const rec = {
  schemeId: 's1',
  category: 'Education',
  eligibilityStatus: 'NEEDS_VERIFICATION',
  eligibilityStatusMessage: 'You appear potentially eligible, but some mandatory criteria require verified documents.',
  explanationText: 'English narrative',
  missingInformation: ['Annual Income (Income Certificate)'],
  missingInformationCodes: ['INCOME'],
  criteriaChecks: [
    { code: 'AGE', label: 'Age requirement', detail: '19 yrs (required 15–30 yrs)', status: 'MET', params: { actual: '19', min: '15', max: '30' } },
    { code: 'INCOME', label: 'Income requirement', detail: 'Required: under ₹2.5L — not provided', status: 'UNKNOWN', params: { max: '250000' } },
  ],
  passedChecks: [{ code: 'AGE', label: 'Age requirement', detail: '19 yrs (required 15–30 yrs)', status: 'MET', params: { actual: '19', min: '15', max: '30' } }],
  failedChecks: [],
}

describe('server text localisation', () => {
  it('leaves English completely untouched', () => {
    expect(localizeRecommendation(rec, t, 'en')).toBe(rec)
  })

  it('rebuilds status message, checks and explanation in Tamil from codes', async () => {
    await setLanguage('ta')
    const out = localizeRecommendation(rec, t, 'ta')
    expect(out.eligibilityStatusMessage).toBe(ta.server.status.NEEDS_VERIFICATION)
    expect(out.criteriaChecks[0].label).toBe(ta.server.check.AGE.label)
    expect(out.criteriaChecks[0].detail).toBe('19 வயது (தேவை: 15–30 வயது)')
    expect(out.criteriaChecks[1].detail).toContain('₹2.5L')
    expect(out.missingDisplay).toEqual([ta.server.missing.INCOME])
    expect(out.explanationText).toContain(ta.categories.Education)
    expect(out.explanationText).not.toContain('English narrative')
  })

  it('keeps the English missingInformation so document matching on the scheme page still works', async () => {
    await setLanguage('hi')
    const out = localizeRecommendation(rec, t, 'hi')
    expect(out.missingInformation).toEqual(['Annual Income (Income Certificate)'])
    expect(out.missingDisplay).toEqual([hi.server.missing.INCOME])
  })

  it('falls back to the English text for unknown codes', async () => {
    await setLanguage('ta')
    const odd = { code: 'FUTURE_RULE', label: 'Future rule', detail: 'English detail', status: 'MET', params: {} }
    expect(checkDetail(odd, t)).toBe('English detail')
  })

  it('uses the yes/no and age-derived variants', async () => {
    await setLanguage('hi')
    expect(checkDetail({ code: 'STUDENT', status: 'MET', params: { actual: 'true' } }, t)).toBe(hi.server.check.STUDENT.metYes)
    expect(checkDetail({ code: 'SENIOR', status: 'NOT_MET', params: { age: '45' } }, t)).toContain('45')
    expect(checkDetail({ code: 'DISABILITY', status: 'NOT_MET', params: {} }, t)).toBe(hi.server.check.DISABILITY.notMet)
  })

  it('translates deadline notifications that carry params, and leaves others as sent', async () => {
    const n = { type: 'DEADLINE_APPROACHING', message: 'English', params: { scheme: 'PM Kisan', days: '3' } }
    expect(notificationText(n, t, 'en')).toBe('English')
    await setLanguage('ta')
    const text = notificationText(n, t, 'ta')
    expect(text).toContain('PM Kisan')
    expect(text).toContain('3')
    expect(text).not.toBe('English')
    expect(notificationText({ type: 'NEW_SCHEME', message: 'Server text' }, t, 'ta')).toBe('Server text')
  })
})

describe('Admin Portal', () => {
  const renderAdmin = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <AdminSchemesPage />
        </AuthProvider>
      </MemoryRouter>,
    )

  it('renders in English by default', async () => {
    renderAdmin()
    expect(await screen.findByText('Government Schemes Portal')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Create New Scheme/ })).toBeInTheDocument()
  })

  it('renders in Tamil and shows the category in the active language', async () => {
    await setLanguage('ta')
    renderAdmin()
    expect(await screen.findByText(ta.admin.title)).toBeInTheDocument()
    expect(screen.getAllByText(ta.categories.Education).length).toBeGreaterThan(0)
    // scheme data itself is never translated
    expect(screen.getByText('Test Scheme')).toBeInTheDocument()
  })
})
