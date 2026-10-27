import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/user', () => ({ updateLanguage: vi.fn(() => Promise.resolve({})) }))
vi.mock('../api/wallet', () => ({
  createShare: vi.fn(),
  getShares: vi.fn(() => Promise.resolve([])),
  revokeShare: vi.fn(() => Promise.resolve({})),
  getShareEvents: vi.fn(() => Promise.resolve([])),
  getVersions: vi.fn(),
  uploadVersion: vi.fn(),
  restoreVersion: vi.fn(),
}))
vi.mock('../api/schemes', () => ({ searchSchemes: vi.fn(() => Promise.resolve([])) }))
vi.mock('../api/auth', () => ({ login: vi.fn(), register: vi.fn(), getMe: vi.fn() }))

import i18n, { setLanguage } from '../i18n'
import ta from '../locales/ta.json'
import hi from '../locales/hi.json'
import { updateLanguage } from '../api/user'
import { createShare, getVersions, uploadVersion, restoreVersion } from '../api/wallet'
import LanguageSwitcher from '../components/LanguageSwitcher'
import ShareDialog, { shareStatus } from '../components/ShareDialog'
import VersionHistory from '../components/VersionHistory'
import { answerQuery } from '../components/Chatbot'
import LoginPage from '../pages/LoginPage'
import { AuthProvider, useAuth } from '../context/AuthContext'
import * as authApi from '../api/auth'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LanguageSwitcher', () => {
  it('lists the three languages by their own names', () => {
    render(<LanguageSwitcher />)
    const options = screen.getAllByRole('option').map((o) => o.textContent)
    expect(options).toEqual(['English', 'தமிழ்', 'हिन्दी'])
  })

  it('changes language, persists it and sets <html lang>', async () => {
    render(<LanguageSwitcher />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ta')
    await waitFor(() => expect(i18n.language).toBe('ta'))
    expect(localStorage.getItem('lang')).toBe('ta')
    expect(document.documentElement.lang).toBe('ta')
  })

  it('also saves to the account when signed in, but not when signed out', async () => {
    render(<LanguageSwitcher />)
    await userEvent.selectOptions(screen.getByRole('combobox'), 'hi')
    await waitFor(() => expect(i18n.language).toBe('hi'))
    expect(updateLanguage).not.toHaveBeenCalled()

    localStorage.setItem('token', 'jwt')
    await userEvent.selectOptions(screen.getByRole('combobox'), 'ta')
    await waitFor(() => expect(updateLanguage).toHaveBeenCalledWith('ta'))
  })

  it('has an accessible name that follows the language', async () => {
    render(<LanguageSwitcher />)
    expect(screen.getByRole('combobox', { name: 'Language' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'hi')
    await waitFor(() => expect(screen.getByRole('combobox', { name: hi.lang.label })).toBeInTheDocument())
  })
})

describe('translated forms and validation', () => {
  const renderLogin = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    )

  it('shows validation errors in the selected language', async () => {
    await setLanguage('ta')
    renderLogin()
    await userEvent.click(screen.getByRole('button', { name: ta.auth.signIn }))
    expect(await screen.findByRole('alert')).toHaveTextContent(ta.auth.errors.emailRequired)
  })

  it('re-renders text when the language changes', async () => {
    renderLogin()
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    await userEvent.selectOptions(screen.getByRole('combobox'), 'hi')
    expect(await screen.findByRole('heading', { name: hi.auth.welcomeBack })).toBeInTheDocument()
  })

  it('associates labels with inputs', () => {
    renderLogin()
    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email')
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'password')
  })
})

describe('chatbot', () => {
  it('recognises intents in all three languages and answers in the active language', async () => {
    const t = i18n.t.bind(i18n)
    expect(await answerQuery('what documents do I need?', t)).toBe(i18n.t('chatbot.docs'))
    expect(await answerQuery('தகுதி என்ன?', t)).toBe(i18n.t('chatbot.eligibility'))
    expect(await answerQuery('आवेदन कैसे करें', t)).toBe(i18n.t('chatbot.apply'))

    await setLanguage('ta')
    expect(await answerQuery('documents', i18n.t.bind(i18n))).toBe(ta.chatbot.docs)
  })
})

describe('ShareDialog', () => {
  const doc = (documentType) => ({ id: 'd1', fileName: 'file.pdf', documentType })

  it('refuses to offer sharing for Aadhaar documents', () => {
    render(<ShareDialog doc={doc('AADHAAR')} onClose={() => {}} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Aadhaar documents cannot be shared')
    expect(screen.queryByRole('button', { name: 'Create link' })).not.toBeInTheDocument()
    expect(createShare).not.toHaveBeenCalled()
  })

  it('shows the risk warning before any link exists', () => {
    render(<ShareDialog doc={doc('EDUCATION')} onClose={() => {}} />)
    expect(screen.getByText(/Before you share/)).toBeInTheDocument()
    expect(screen.getByText(/Anyone who has the link/)).toBeInTheDocument()
  })

  it('requires explicit acknowledgement for sensitive document types', async () => {
    render(<ShareDialog doc={doc('INCOME_CERTIFICATE')} onClose={() => {}} />)
    const create = screen.getByRole('button', { name: 'Create link' })
    expect(create).toBeDisabled()
    await userEvent.click(screen.getByRole('checkbox'))
    expect(create).toBeEnabled()
  })

  it('creates a link, sends the acknowledgement and shows the token URL once', async () => {
    createShare.mockResolvedValueOnce({ id: 's1', token: 'abc123' })
    render(<ShareDialog doc={doc('INCOME_CERTIFICATE')} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('checkbox'))
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }))

    await waitFor(() =>
      expect(createShare).toHaveBeenCalledWith('d1', {
        permission: 'VIEW',
        expiresInHours: 24,
        acknowledgeRisk: true,
      }),
    )
    expect(await screen.findByDisplayValue(`${window.location.origin}/shared/abc123`)).toBeInTheDocument()
  })

  it('surfaces a server refusal', async () => {
    createShare.mockRejectedValueOnce({ response: { data: { message: 'Aadhaar documents cannot be shared.' } } })
    render(<ShareDialog doc={doc('EDUCATION')} onClose={() => {}} />)
    await userEvent.click(screen.getByRole('button', { name: 'Create link' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Aadhaar documents cannot be shared.')
  })

  it('classifies link status for revoked / expired / active', () => {
    const now = Date.parse('2026-01-01T12:00:00Z')
    expect(shareStatus({ expiresAt: '2026-01-02T00:00:00Z' }, now)).toBe('active')
    expect(shareStatus({ expiresAt: '2026-01-01T11:00:00Z' }, now)).toBe('expired')
    expect(shareStatus({ expiresAt: '2026-01-02T00:00:00Z', revokedAt: '2026-01-01T10:00:00Z' }, now)).toBe('revoked')
  })
})

describe('VersionHistory', () => {
  const doc = { id: 'd1', fileName: 'b.pdf', currentVersion: 2 }
  const versions = [
    { versionNumber: 1, fileName: 'a.pdf', uploadedAt: '2026-01-01T00:00:00Z' },
    { versionNumber: 2, fileName: 'b.pdf', uploadedAt: '2026-01-02T00:00:00Z' },
  ]

  it('lists versions newest first, marks the current one, and only offers restore on older ones', async () => {
    getVersions.mockResolvedValue(versions)
    render(<VersionHistory doc={doc} onClose={() => {}} onChanged={() => {}} />)
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Version 2')
    expect(items[0]).toHaveTextContent('Current')
    expect(items[0]).not.toHaveTextContent('Restore')
    expect(items[1]).toHaveTextContent('Version 1')
    expect(items[1]).toHaveTextContent('Restore')
  })

  it('restores an older version and reports the updated document', async () => {
    getVersions.mockResolvedValue(versions)
    restoreVersion.mockResolvedValue({ ...doc, currentVersion: 3 })
    const onChanged = vi.fn()
    render(<VersionHistory doc={doc} onClose={() => {}} onChanged={onChanged} />)
    await userEvent.click(await screen.findByRole('button', { name: 'Restore' }))
    await waitFor(() => expect(restoreVersion).toHaveBeenCalledWith('d1', 1))
    expect(onChanged).toHaveBeenCalledWith({ ...doc, currentVersion: 3 })
  })

  it('shows the server message when an upload is rejected', async () => {
    getVersions.mockResolvedValue(versions)
    uploadVersion.mockRejectedValue({ response: { data: { message: 'Only PDF, JPG and PNG files are allowed' } } })
    const { container } = render(<VersionHistory doc={doc} onClose={() => {}} onChanged={() => {}} />)
    await screen.findAllByRole('listitem')
    const input = container.querySelector('input[type=file]')
    await userEvent.upload(input, new File(['x'], 'bad.exe'), { applyAccept: false })
    expect(await screen.findByRole('alert')).toHaveTextContent('Only PDF, JPG and PNG files are allowed')
  })
})

describe('language follows the account on sign-in', () => {
  function LoginProbe() {
    const { login } = useAuth()
    return <button onClick={() => login('a@b.c', 'password1')}>go</button>
  }
  const renderProbe = () =>
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginProbe />
        </AuthProvider>
      </MemoryRouter>,
    )

  it("applies the account's saved language", async () => {
    authApi.login.mockResolvedValue({ token: 't', userId: 'u', name: 'A', email: 'a@b.c', role: 'CITIZEN', language: 'ta' })
    renderProbe()
    await userEvent.click(screen.getByText('go'))
    await waitFor(() => expect(i18n.language).toBe('ta'))
    expect(localStorage.getItem('lang')).toBe('ta')
  })

  it('saves the device language to the account when the account has none', async () => {
    await setLanguage('hi')
    authApi.login.mockResolvedValue({ token: 't', userId: 'u', name: 'A', email: 'a@b.c', role: 'CITIZEN' })
    renderProbe()
    await userEvent.click(screen.getByText('go'))
    await waitFor(() => expect(updateLanguage).toHaveBeenCalledWith('hi'))
    expect(i18n.language).toBe('hi')
  })
})
