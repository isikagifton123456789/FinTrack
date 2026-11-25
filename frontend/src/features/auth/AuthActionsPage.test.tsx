import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../api'
import { ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage } from './AuthActionsPage'

vi.mock('../../api', () => ({
  api: {
    forgotPassword: vi.fn(),
    resetPassword: vi.fn(),
    verifyEmail: vi.fn(),
  },
}))

function renderPage(element: ReactNode, initialEntry: string) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(<StrictMode><QueryClientProvider client={client}><MemoryRouter initialEntries={[initialEntry]}>{element}</MemoryRouter></QueryClientProvider></StrictMode>)
}

describe('email account actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('verifies an email using the token from the link', async () => {
    vi.mocked(api.verifyEmail).mockResolvedValue({ message: 'Email verified. You can now sign in.' })
    renderPage(<VerifyEmailPage />, '/verify-email?token=verification-token')

    expect(await screen.findByText('Email verified. You can now sign in.')).toBeInTheDocument()
    expect(api.verifyEmail).toHaveBeenCalledTimes(1)
    expect(api.verifyEmail).toHaveBeenCalledWith('verification-token')
  })

  it('requests a password reset without revealing whether the email exists', async () => {
    vi.mocked(api.forgotPassword).mockResolvedValue({ message: 'If an account exists for that email, we sent a password reset link.' })
    renderPage(<ForgotPasswordPage />, '/forgot-password')
    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'amina@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset link' }))

    expect(await screen.findByText('If an account exists for that email, we sent a password reset link.')).toBeInTheDocument()
    expect(api.forgotPassword).toHaveBeenCalledWith('amina@example.com')
  })

  it('updates the password using the reset token and validates matching fields', async () => {
    vi.mocked(api.resetPassword).mockResolvedValue({ message: 'Password updated. You can now sign in.' })
    renderPage(<ResetPasswordPage />, '/reset-password?token=reset-token')
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Secure123' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'Secure123' } })
    fireEvent.click(screen.getByRole('button', { name: 'Update password' }))

    expect(await screen.findByText('Password updated. You can now sign in.')).toBeInTheDocument()
    expect(api.resetPassword).toHaveBeenCalledWith('reset-token', 'Secure123')
  })

  it('explains how to get a reset link when opened without a token', () => {
    renderPage(<ResetPasswordPage />, '/reset-password')

    expect(screen.getByText('A reset link is required to choose a new password. Request one and we’ll email it to you.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Request a reset link' })).toHaveAttribute('href', '/forgot-password')
  })
})
