import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MotionConfig } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'
import { AppShell } from './AppShell'
import { AuthPage } from '../features/auth/AuthPage'
import { ForgotPasswordPage, ResendVerificationPage, ResetPasswordPage, VerifyEmailPage } from '../features/auth/AuthActionsPage'
import { PortfolioDetailPage } from '../features/portfolios/PortfolioDetailPage'
import { PortfoliosPage } from '../features/portfolios/PortfoliosPage'
import { Button, ToastProvider } from '../shared/ui'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 15_000 } },
})

export function App() {
  return <QueryClientProvider client={queryClient}><ToastProvider><MotionConfig reducedMotion="user"><BrowserRouter><TitleManager /><AppRoutes /></BrowserRouter></MotionConfig></ToastProvider></QueryClientProvider>
}

function AppRoutes() {
  const location = useLocation()
  return <ErrorBoundary><Routes location={location}>
    <Route path="/" element={<Navigate to={hasSession() ? '/portfolios' : '/login'} replace />} />
    <Route path="/login" element={hasSession() ? <Navigate to="/portfolios" replace /> : <AuthPage mode="login" />} />
    <Route path="/register" element={hasSession() ? <Navigate to="/portfolios" replace /> : <AuthPage mode="register" />} />
    <Route path="/verify-email" element={<VerifyEmailPage />} />
    <Route path="/resend-verification" element={<ResendVerificationPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={hasSession() ? <AppShell /> : <Navigate to="/login" replace />}>
      <Route path="/portfolios" element={<PortfoliosPage />} />
      <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
    </Route>
    <Route path="*" element={<NotFound />} />
  </Routes></ErrorBoundary>
}

function hasSession(): boolean {
  return Boolean(window.localStorage.getItem('fintrack.token') && window.localStorage.getItem('fintrack.user'))
}

function TitleManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname === '/login') document.title = 'Sign in · FinTrack'
    else if (pathname === '/register') document.title = 'Create account · FinTrack'
    else if (pathname === '/verify-email') document.title = 'Verify email · FinTrack'
    else if (pathname === '/forgot-password') document.title = 'Forgot password · FinTrack'
    else if (pathname === '/reset-password') document.title = 'Reset password · FinTrack'
    else if (pathname === '/portfolios') document.title = 'Portfolios · FinTrack'
    else if (pathname.startsWith('/portfolios/')) document.title = 'Portfolio details · FinTrack'
    else document.title = 'FinTrack by Finnet Technologies'
  }, [pathname])
  return null
}

function NotFound() {
  return <main className="grid min-h-dvh place-items-center px-5 py-12"><div className="max-w-md text-center"><p className="text-sm font-semibold uppercase tracking-[.16em] text-[var(--color-accent)]">404 · Page not found</p><h1 className="mt-3 text-3xl font-semibold tracking-tight">This page isn’t here</h1><p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">The link may be out of date, or the page may have moved. Return to your portfolios to continue.</p><Button className="mt-5" onClick={() => { window.location.href = hasSession() ? '/portfolios' : '/login' }}>Back to FinTrack</Button></div></main>
}

interface ErrorBoundaryState { hasError: boolean }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('FinTrack rendering error', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) return <main className="grid min-h-dvh place-items-center px-5"><div className="max-w-md text-center"><AlertTriangle size={25} className="mx-auto text-[var(--color-negative)]" strokeWidth={1.5} /><h1 className="mt-4 text-2xl font-semibold">Something went wrong</h1><p className="mt-2 text-sm text-[var(--color-ink-muted)]">The page didn’t load as expected. Refresh to try again.</p><Button className="mt-5" onClick={() => window.location.reload()}>Refresh page</Button></div></main>
    return this.props.children
  }
}
