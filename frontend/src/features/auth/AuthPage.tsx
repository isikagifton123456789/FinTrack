import { useState } from 'react'
import type { InputHTMLAttributes, Ref } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { api } from '../../api'
import { ApiError } from '../../lib/errors'
import { Button, Field, useToast } from '../../shared/ui'
import { loginSchema, registerSchema, type LoginValues, type RegisterValues } from './schemas'

const demoEmail = 'analyst@finnet.demo'
const demoPassword = 'demo1234'

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register'
  const [showPassword, setShowPassword] = useState(false)
  const [registrationComplete, setRegistrationComplete] = useState<{ email: string; developmentToken?: string } | null>(null)
  const navigate = useNavigate()
  const { notify } = useToast()
  const loginForm = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const registerForm = useForm<RegisterValues>({ resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '', confirmPassword: '' } })
  const mutation = useMutation({
    mutationFn: async (values: LoginValues | RegisterValues) => 'name' in values
      ? { kind: 'register' as const, result: await api.register(values.name, values.email, values.password) }
      : { kind: 'login' as const, result: await api.login(values.email, values.password) },
    onSuccess: (result) => {
      if (result.kind === 'register') {
        setRegistrationComplete({ email: registerForm.getValues('email'), developmentToken: result.result.developmentToken })
        return
      }
      const { user, token, refreshToken } = result.result
      window.localStorage.setItem('fintrack.user', JSON.stringify(user))
      window.localStorage.setItem('fintrack.token', token)
      if (refreshToken) window.localStorage.setItem('fintrack.refreshToken', refreshToken)
      else window.localStorage.removeItem('fintrack.refreshToken')
      notify('Welcome back', 'Your portfolios are ready to review.')
      navigate('/portfolios', { replace: true })
    },
    onError: (error: Error) => notify(isRegister ? 'Account could not be created' : 'Sign in couldn’t be completed', error.message, 'error'),
  })

  return (
    <main className="grid min-h-dvh bg-[var(--color-paper)] lg:grid-cols-[1fr_1fr]">
      <section className="relative hidden min-h-dvh overflow-hidden bg-[var(--color-navy)] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
        <Brand light />
        <div className="relative z-10 max-w-xl pb-16">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[.2em] text-[var(--color-accent)]">Investment oversight, considered</p>
          <h1 className="text-4xl font-medium leading-tight tracking-[-.04em] xl:text-5xl">Good decisions start with a clear picture.</h1>
          <p className="mt-5 max-w-md text-base leading-7 text-white/70">Bring portfolio activity and performance into one quiet, dependable workspace.</p>
          <div className="mt-10 flex items-center gap-3 border-t border-white/15 pt-5 text-sm text-white/65"><ShieldCheck size={17} strokeWidth={1.5} /> Designed for thoughtful client stewardship</div>
        </div>
        <div aria-hidden="true" className="absolute bottom-28 right-[-44px] h-[360px] w-[360px] rounded-full border border-white/10">
          <div className="absolute inset-9 rounded-full border border-white/10" />
          <div className="absolute inset-[76px] rounded-full border border-white/10" />
          <div className="absolute right-[35px] top-[35px] h-2.5 w-2.5 rounded-full bg-[var(--color-accent)]" />
        </div>
        <p className="text-xs text-white/45">© 2025 Finnet Technologies</p>
      </section>
      <section className="flex min-h-dvh flex-col px-5 py-7 sm:px-10 lg:justify-center lg:px-16 xl:px-24">
        <div className="mb-12 lg:hidden"><Brand /></div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2 }} className="mx-auto w-full max-w-[410px]">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--color-accent)]">{isRegister ? 'Get started' : 'Welcome back'}</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-.04em]">{isRegister ? 'Create your account' : 'Sign in to FinTrack'}</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--color-ink-muted)]">{isRegister ? 'Set up a secure workspace for your client portfolios.' : 'Use your Finnet account details to continue.'}</p>
          {registrationComplete ? (
            <div className="mt-8 space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
              <h3 className="text-lg font-semibold">Check your email</h3>
              <p className="text-sm leading-6 text-[var(--color-ink-muted)]">We sent a verification link to <strong className="text-[var(--color-ink)]">{registrationComplete.email}</strong>. Verify your address before signing in.</p>
              {registrationComplete.developmentToken && <Link className="inline-flex font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to={`/verify-email?token=${encodeURIComponent(registrationComplete.developmentToken)}`}>Complete verification in mock mode</Link>}
              <p className="text-sm text-[var(--color-ink-muted)]">If you don’t see the email, check your spam folder or <Link className="font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to={`/resend-verification?email=${encodeURIComponent(registrationComplete.email)}`}>request another link</Link>.</p>
              <Link className="inline-flex text-sm font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/login">Return to sign in</Link>
            </div>
          ) : isRegister ? (
            <form className="mt-8 space-y-4" onSubmit={registerForm.handleSubmit((values) => mutation.mutate(values))}>
              <Field label="Full name" autoComplete="name" {...registerForm.register('name')} error={registerForm.formState.errors.name?.message} />
              <Field label="Work email" type="email" autoComplete="email" {...registerForm.register('email')} error={registerForm.formState.errors.email?.message} />
              <PasswordField label="Password" show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" {...registerForm.register('password')} error={registerForm.formState.errors.password?.message} />
              <PasswordField label="Confirm password" show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="new-password" {...registerForm.register('confirmPassword')} error={registerForm.formState.errors.confirmPassword?.message} />
              {mutation.isError && <p role="alert" className="text-sm text-[var(--color-negative)]">{mutation.error.message}</p>}
              <Button className="w-full" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Creating account…' : 'Create account'} <ArrowRight size={16} strokeWidth={1.5} /></Button>
            </form>
          ) : (
            <form className="mt-8 space-y-4" onSubmit={loginForm.handleSubmit((values) => mutation.mutate(values))}>
              <Field label="Work email" type="email" autoComplete="email" {...loginForm.register('email')} error={loginForm.formState.errors.email?.message} />
              <PasswordField label="Password" show={showPassword} toggle={() => setShowPassword((value) => !value)} autoComplete="current-password" {...loginForm.register('password')} error={loginForm.formState.errors.password?.message} />
              {mutation.isError && <p role="alert" className="rounded-lg bg-[var(--color-negative-soft)] px-3 py-2 text-sm text-[var(--color-negative)]">{mutation.error.message}</p>}
              {mutation.isError && mutation.error instanceof ApiError && mutation.error.body.error.code === 'EMAIL_NOT_VERIFIED' && <p className="text-sm"><Link className="font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to={`/resend-verification?email=${encodeURIComponent(loginForm.getValues('email'))}`}>Resend verification email</Link></p>}
              <p className="text-right text-sm"><Link className="font-medium text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to="/forgot-password">Forgot password?</Link></p>
              <Button className="w-full" type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Signing in…' : 'Sign in'} <ArrowRight size={16} strokeWidth={1.5} /></Button>
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ email: demoEmail, password: demoPassword })}
              >
                {mutation.isPending ? 'Signing in…' : 'Sign in with demo account'}
              </Button>
              <p className="text-center text-xs text-[var(--color-ink-muted)]">Demo access is for assessment use only.</p>
            </form>
          )}
          <p className="mt-7 text-center text-sm text-[var(--color-ink-muted)]">
            {isRegister ? 'Already have an account? ' : 'New to FinTrack? '}
            <Link className="font-semibold text-[var(--color-navy)] underline decoration-[var(--color-accent)] underline-offset-4" to={isRegister ? '/login' : '/register'}>{isRegister ? 'Sign in' : 'Create an account'}</Link>
          </p>
        </motion.div>
        <footer className="mt-auto pt-12 text-center text-xs text-[var(--color-ink-muted)] lg:absolute lg:bottom-7 lg:right-10">© 2025 Finnet Technologies · Private and secure</footer>
      </section>
    </main>
  )
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link to="/login" className={`inline-flex w-fit flex-col leading-none ${light ? 'text-white' : 'text-[var(--color-ink)]'}`} aria-label="FinTrack by Finnet Technologies">
    <span className="text-[22px] font-bold tracking-[-.05em]">Fin<span className="text-[var(--color-accent)]">Track</span></span>
    <span className={`mt-1 text-[10px] tracking-wide ${light ? 'text-white/60' : 'text-[var(--color-ink-muted)]'}`}>by Finnet Technologies</span>
  </Link>
}

type PasswordFieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; show: boolean; toggle: () => void; error?: string; ref?: Ref<HTMLInputElement> }
function PasswordField({ label, show, toggle, error, ...props }: PasswordFieldProps) {
  const id = props.name
  return <div className="space-y-1.5">
    <label htmlFor={id} className="block text-sm font-medium">{label}</label>
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} className="field pr-11" aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />
      <button type="button" onClick={toggle} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]">{show ? <EyeOff size={17} strokeWidth={1.5} /> : <Eye size={17} strokeWidth={1.5} />}</button>
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-[var(--color-negative)]">{error}</p>}
  </div>
}
