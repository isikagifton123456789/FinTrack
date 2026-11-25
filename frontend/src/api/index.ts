import * as mock from './mock'
import { ApiError } from '../lib/errors'
import type {
  AuthActionResponse,
  AuthResponse,
  Portfolio,
  PortfolioInput,
  PortfolioSummary,
  Transaction,
  TransactionInput,
} from '../types'

const useMock = import.meta.env.VITE_USE_MOCK_API === 'true'
const baseUrl = import.meta.env.VITE_API_BASE_URL ?? (
  import.meta.env.PROD ? 'https://fintrack-clgc.onrender.com' : ''
)

async function performRequest(path: string, init: RequestInit | undefined, token: string | null): Promise<Response> {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })
}

async function readResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } } | null
    throw new ApiError(
      response.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? `Request failed (${response.status}). Please try again.`,
      body?.error?.details ?? {},
    )
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

async function refreshSession(): Promise<string> {
  const refreshToken = window.localStorage.getItem('fintrack.refreshToken')
  if (!refreshToken) throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Sign in again.')
  const response = await performRequest('/api/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  }, null)
  const session = await readResponse<{ token: string; refreshToken: string }>(response)
  window.localStorage.setItem('fintrack.token', session.token)
  window.localStorage.setItem('fintrack.refreshToken', session.refreshToken)
  return session.token
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = window.localStorage.getItem('fintrack.token')
  const response = await performRequest(path, init, token)
  if (response.status === 401 && token && !path.startsWith('/api/auth/')) {
    const refreshedToken = await refreshSession()
    return readResponse<T>(await performRequest(path, init, refreshedToken))
  }
  return readResponse<T>(response)
}

export const api = {
  login: (email: string, password: string): Promise<AuthResponse> =>
    useMock ? mock.mockLogin(email, password) : request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  register: (name: string, email: string, password: string): Promise<AuthActionResponse> =>
    useMock ? mock.mockRegister(name, email, password) : request('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  verifyEmail: (token: string): Promise<AuthActionResponse> =>
    useMock ? mock.mockVerifyEmail(token) : request('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }),
  resendVerification: (email: string): Promise<AuthActionResponse> =>
    useMock ? mock.mockResendVerification(email) : request('/api/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),
  forgotPassword: (email: string): Promise<AuthActionResponse> =>
    useMock ? mock.mockForgotPassword(email) : request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token: string, password: string): Promise<AuthActionResponse> =>
    useMock ? mock.mockResetPassword(token, password) : request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  getPortfolios: (): Promise<Portfolio[]> =>
    useMock ? mock.mockGetPortfolios() : request('/api/portfolios'),
  createPortfolio: (input: PortfolioInput): Promise<Portfolio> =>
    useMock ? mock.mockCreatePortfolio(input) : request('/api/portfolios', { method: 'POST', body: JSON.stringify(input) }),
  getPortfolio: (id: string): Promise<Portfolio> =>
    useMock ? mock.mockGetPortfolio(id) : request(`/api/portfolios/${encodeURIComponent(id)}`),
  updatePortfolio: (id: string, input: PortfolioInput): Promise<Portfolio> =>
    useMock ? mock.mockUpdatePortfolio(id, input) : request(`/api/portfolios/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }),
  deletePortfolio: (id: string): Promise<void> =>
    useMock ? mock.mockDeletePortfolio(id) : request(`/api/portfolios/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getTransactions: (portfolioId: string): Promise<Transaction[]> =>
    useMock ? mock.mockGetTransactions(portfolioId) : request(`/api/portfolios/${encodeURIComponent(portfolioId)}/transactions`),
  createTransaction: (portfolioId: string, input: TransactionInput): Promise<Transaction> =>
    useMock ? mock.mockCreateTransaction(portfolioId, input) : request(`/api/portfolios/${encodeURIComponent(portfolioId)}/transactions`, { method: 'POST', body: JSON.stringify(input) }),
  deleteTransaction: (id: string): Promise<void> =>
    useMock ? mock.mockDeleteTransaction(id) : request(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getSummary: (portfolioId: string): Promise<PortfolioSummary> =>
    useMock ? mock.mockGetSummary(portfolioId) : request(`/api/portfolios/${encodeURIComponent(portfolioId)}/summary`),
}
