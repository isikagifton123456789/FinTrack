import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'
import { ToastProvider } from '../../shared/ui'
import { api } from '../../api'

vi.mock('../../api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
  },
}))

describe('login form', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
  })

  it('shows accessible inline validation for missing credentials', async () => {
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter><AuthPage mode="login" /></MemoryRouter></ToastProvider></QueryClientProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument()
    expect(await screen.findByText('Enter your password.')).toBeInTheDocument()
  })

  it('signs in directly with the demo account', async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: 'demo', name: 'Amina Njeri', email: 'analyst@finnet.demo' },
      token: 'demo-token',
    })
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
    render(<QueryClientProvider client={client}><ToastProvider><MemoryRouter><AuthPage mode="login" /></MemoryRouter></ToastProvider></QueryClientProvider>)

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with demo account' }))

    await waitFor(() => {
      expect(api.login).toHaveBeenCalledWith('analyst@finnet.demo', 'demo1234')
      expect(window.localStorage.getItem('fintrack.token')).toBe('demo-token')
    })
  })
})
