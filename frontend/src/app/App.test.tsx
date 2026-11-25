import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'
import { api } from '../api'

vi.mock('../api', () => ({
  api: {
    login: vi.fn(),
    register: vi.fn(),
    getPortfolios: vi.fn(),
  },
}))

describe('app authentication redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.history.replaceState({}, '', '/login')
  })

  it('shows the portfolio page after a successful sign in', async () => {
    vi.mocked(api.login).mockResolvedValue({
      user: { id: 'user-1', name: 'Amina Njeri', email: 'amina@example.com' },
      token: 'session-token',
    })
    vi.mocked(api.getPortfolios).mockResolvedValue([])

    render(<App />)

    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'amina@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secure-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Your portfolios')).toBeInTheDocument()
    expect(window.localStorage.getItem('fintrack.token')).toBe('session-token')
  })
})
