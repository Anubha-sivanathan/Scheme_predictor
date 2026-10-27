import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../components/NavBar', () => ({ default: () => <nav /> }))
vi.mock('../components/Chatbot', () => ({ default: () => null }))
vi.mock('../components/ShareDialog', () => ({ default: () => null }))
vi.mock('../components/VersionHistory', () => ({ default: () => null }))
vi.mock('../api/profile', () => ({ getProfile: vi.fn() }))
vi.mock('../api/wallet', () => ({
  getDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  verifyDocumentFields: vi.fn(),
  deleteDocument: vi.fn(),
  syncWallet: vi.fn(),
  getProfileChanges: vi.fn(),
  applyProfileChanges: vi.fn(),
}))

import i18n from '../i18n'
import WalletPage, { maskSensitive } from '../pages/WalletPage'
import { getProfile } from '../api/profile'
import {
  getDocuments,
  uploadDocument,
  verifyDocumentFields,
  getProfileChanges,
  applyProfileChanges,
} from '../api/wallet'

const doc = (over = {}) => ({
  id: 'd1',
  fileName: 'aadhaar.pdf',
  documentType: 'AADHAAR',
  verificationStatus: 'OCR_EXTRACTED',
  extractedFields: { name: 'Raj Kumar', aadhaarNumber: '123456789012', state: 'Tamil Nadu', issuingAuthority: 'Tahsildar' },
  ...over,
})

const profile = (over = {}) => ({ profile: { state: 'Kerala', ...over } })

beforeEach(async () => {
  vi.clearAllMocks()
  await i18n.changeLanguage('en')
  getProfile.mockResolvedValue(profile())
})

describe('maskSensitive', () => {
  it('keeps only the last 4 characters of identity and account numbers', () => {
    expect(maskSensitive('aadhaarNumber', '123456789012')).toBe('••••••••9012')
    expect(maskSensitive('accountNumber', '98765')).toBe('•8765')
    expect(maskSensitive('name', 'Raj Kumar')).toBe('Raj Kumar')
  })
})

describe('Data Wallet OCR display', () => {
  it('shows every extracted field, with the Aadhaar number masked', async () => {
    getDocuments.mockResolvedValue([doc()])
    render(<WalletPage />)

    await userEvent.click(await screen.findByRole('button', { name: 'Show details' }))

    const details = within(screen.getByTestId('document-details'))
    expect(details.getByText('Raj Kumar')).toBeInTheDocument()
    expect(details.getByText('Tahsildar')).toBeInTheDocument()
    expect(details.getByText('Issuing Authority')).toBeInTheDocument()
    expect(details.getByText('••••••••9012')).toBeInTheDocument()
    expect(details.queryByText('123456789012')).not.toBeInTheDocument()
  })

  it('explains an OCR failure instead of looking like a pending document', async () => {
    getDocuments.mockResolvedValue([doc({ verificationStatus: 'OCR_FAILED', extractedFields: null })])
    render(<WalletPage />)

    expect(await screen.findByText('OCR unavailable')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Show details' }))
    expect(screen.getByText(/automatic reading \(OCR\) is not available/)).toBeInTheDocument()
  })

  it('tells the user when an upload was stored but nothing could be read', async () => {
    getDocuments.mockResolvedValue([])
    uploadDocument.mockResolvedValue(doc({ verificationStatus: 'OCR_EMPTY', extractedFields: {} }))
    const { container } = render(<WalletPage />)
    await screen.findByText(/No documents uploaded yet/)

    await userEvent.upload(
      container.querySelector('input[type="file"]'),
      new File(['x'], 'a.pdf', { type: 'application/pdf' }),
    )

    expect(await screen.findByRole('status')).toHaveTextContent(/could not read any details/)
  })
})

describe('Review -> profile update', () => {
  const setup = async () => {
    getDocuments.mockResolvedValue([doc()])
    verifyDocumentFields.mockResolvedValue(doc({ verificationStatus: 'VERIFIED', verifiedFields: doc().extractedFields }))
    render(<WalletPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Review OCR' }))
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Sync/ }))
  }

  it('does not open the conflict dialog when the profile has no disagreements', async () => {
    getProfileChanges.mockResolvedValue([])
    await setup()
    await waitFor(() => expect(getProfileChanges).toHaveBeenCalledWith('d1'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('leaves conflicting values untouched until the user ticks them', async () => {
    getProfileChanges.mockResolvedValue([{ field: 'state', current: 'Kerala', proposed: 'Tamil Nadu' }])
    applyProfileChanges.mockResolvedValue({ state: 'Tamil Nadu' })
    await setup()

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Kerala')).toBeInTheDocument()
    expect(within(dialog).getByText('Tamil Nadu')).toBeInTheDocument()
    const apply = within(dialog).getByRole('button', { name: 'Replace selected' })
    expect(apply).toBeDisabled()
    expect(applyProfileChanges).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('checkbox'))
    await userEvent.click(apply)

    await waitFor(() => expect(applyProfileChanges).toHaveBeenCalledWith('d1', ['state']))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('keeping the profile closes the dialog without applying anything', async () => {
    getProfileChanges.mockResolvedValue([{ field: 'state', current: 'Kerala', proposed: 'Tamil Nadu' }])
    await setup()

    await userEvent.click(await screen.findByRole('button', { name: 'Keep my profile' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(applyProfileChanges).not.toHaveBeenCalled()
  })

  it('shows an error and stays open when applying fails', async () => {
    getProfileChanges.mockResolvedValue([{ field: 'state', current: 'Kerala', proposed: 'Tamil Nadu' }])
    applyProfileChanges.mockRejectedValue(new Error('boom'))
    await setup()

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('checkbox'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Replace selected' }))

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('Could not update your profile')
  })

  it('reports a failed confirmation instead of closing silently', async () => {
    getDocuments.mockResolvedValue([doc()])
    verifyDocumentFields.mockRejectedValue(new Error('boom'))
    render(<WalletPage />)
    await userEvent.click(await screen.findByRole('button', { name: 'Review OCR' }))
    await userEvent.click(screen.getByRole('button', { name: /Confirm & Sync/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save your confirmation')
    expect(getProfileChanges).not.toHaveBeenCalled()
  })
})
