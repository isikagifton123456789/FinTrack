import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../../api'
import { Button, Field } from '../../shared/ui'
import { emailSchema, resetPasswordSchema, type ResetPasswordValues } from './schemas'

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const verificationStarted = useRef(false)
  const verify = useMutation({ mutationFn: (value: string) => api.verifyEmail(value) })

  useEffect(() => {
    if (token && !verificationStarted.current) {
      verificationStarted.current = true
      verify.mutate(token)
    }
  }, [token, verify.mutate])

  return <AuthActionLayout title="Verify your email">
    {!token ? <p role="alert" className="text-sm text-[var(--color-negative)]">This verification link is missing its token.</p> :
      verify.isPending ? <p role="status" className="text-sm text-[var(--color-ink-muted)]">Verifying your email…</p> :
        verify.isError ? <p role="alert" className="text-sm text-[var(--color-negative)]">{verify.error.message}</p> :
          verify.isSuccess ? <p role="status" className="text-sm text-[var(--color-ink-muted)]">{verify.data.message}</p> : null}
    <Link className="mt-5 inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/login">Go to sign in</Link>
  </AuthActionLayout>
}

export function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const form = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: searchParams.get('email') ?? '' },
  })
  const requestReset = useMutation({ mutationFn: (email: string) => api.forgotPassword(email) })

  return <AuthActionLayout title="Forgot password" description="Enter your account email and we’ll send a password reset link.">
    {requestReset.isSuccess ? (
      <div className="space-y-4">
        <p role="status" className="text-sm leading-6 text-[var(--color-ink-muted)]">{requestReset.data.message}</p>
        {requestReset.data.developmentToken && <Link className="inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to={`/reset-password?token=${encodeURIComponent(requestReset.data.developmentToken)}`}>Continue with mock reset link</Link>}
      </div>
    ) : (
      <form className="space-y-4" onSubmit={form.handleSubmit(({ email }) => requestReset.mutate(email))}>
        <Field label="Work email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        {requestReset.isError && <p role="alert" className="text-sm text-[var(--color-negative)]">{requestReset.error.message}</p>}
        <Button className="w-full" type="submit" disabled={requestReset.isPending}>{requestReset.isPending ? 'Sending link…' : 'Send reset link'}</Button>
      </form>
    )}
    <Link className="mt-5 inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/login">Back to sign in</Link>
  </AuthActionLayout>
}

export function ResendVerificationPage() {
  const [searchParams] = useSearchParams()
  const form = useForm<{ email: string }>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: searchParams.get('email') ?? '' },
  })
  const resend = useMutation({ mutationFn: (email: string) => api.resendVerification(email) })

  return <AuthActionLayout title="Resend verification email" description="Enter your account email and we’ll send a new verification link.">
    {resend.isSuccess ? (
      <div className="space-y-4">
        <p role="status" className="text-sm leading-6 text-[var(--color-ink-muted)]">{resend.data.message}</p>
        {resend.data.developmentToken && <Link className="inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to={`/verify-email?token=${encodeURIComponent(resend.data.developmentToken)}`}>Complete verification in mock mode</Link>}
      </div>
    ) : (
      <form className="space-y-4" onSubmit={form.handleSubmit(({ email }) => resend.mutate(email))}>
        <Field label="Work email" type="email" autoComplete="email" {...form.register('email')} error={form.formState.errors.email?.message} />
        {resend.isError && <p role="alert" className="text-sm text-[var(--color-negative)]">{resend.error.message}</p>}
        <Button className="w-full" type="submit" disabled={resend.isPending}>{resend.isPending ? 'Sending link…' : 'Resend verification link'}</Button>
      </form>
    )}
    <Link className="mt-5 inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/login">Back to sign in</Link>
  </AuthActionLayout>
}

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  const form = useForm<ResetPasswordValues>({ resolver: zodResolver(resetPasswordSchema), defaultValues: { password: '', confirmPassword: '' } })
  const reset = useMutation({ mutationFn: ({ password }: ResetPasswordValues) => api.resetPassword(token ?? '', password) })

  return <AuthActionLayout title="Reset password" description="Choose a new password with at least 8 characters, including uppercase, lowercase, and a number.">
    {!token ? <div className="space-y-3">
      <p className="text-sm leading-6 text-[var(--color-ink-muted)]">A reset link is required to choose a new password. Request one and we’ll email it to you.</p>
      <Link className="inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/forgot-password">Request a reset link</Link>
    </div> :
      reset.isSuccess ? <div className="space-y-4"><p role="status" className="text-sm text-[var(--color-ink-muted)]">{reset.data.message}</p><Link className="inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/login">Sign in with your new password</Link></div> :
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => reset.mutate(values))}>
          <Field label="New password" type="password" autoComplete="new-password" {...form.register('password')} error={form.formState.errors.password?.message} />
          <Field label="Confirm new password" type="password" autoComplete="new-password" {...form.register('confirmPassword')} error={form.formState.errors.confirmPassword?.message} />
          {reset.isError && <p role="alert" className="text-sm text-[var(--color-negative)]">{reset.error.message}</p>}
          <Button className="w-full" type="submit" disabled={reset.isPending}>{reset.isPending ? 'Updating password…' : 'Update password'}</Button>
        </form>}
    {!reset.isSuccess && <Link className="mt-5 inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/login">Back to sign in</Link>}
  </AuthActionLayout>
}

function AuthActionLayout({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <main className="grid min-h-dvh place-items-center bg-[var(--color-paper)] px-5 py-10">
    <section className="w-full max-w-[410px] rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-8">
      <Link to="/login" className="text-xl font-bold tracking-[-.05em] text-[var(--color-ink)]">Fin<span className="text-[var(--color-accent)]">Track</span></Link>
      <h1 className="mt-7 text-2xl font-semibold tracking-[-.04em]">{title}</h1>
      {description && <p className="mb-5 mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{description}</p>}
      {children}
    </section>
  </main>
}
