import { AnimatePresence, motion } from 'framer-motion'
import { AlertCircle, Check, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type KeyboardEvent, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react'

export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'quiet' | 'danger' }) {
  const styles = {
    primary: 'bg-[var(--color-navy)] text-white hover:bg-[var(--color-navy-soft)]',
    secondary: 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface-muted)]',
    quiet: 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]',
    danger: 'bg-[var(--color-negative)] text-white hover:opacity-90',
  }
  return <button className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-[9px] px-4 py-2 text-sm font-semibold transition duration-150 active:scale-[.98] disabled:active:scale-100 ${styles[variant]} ${className}`} {...props}>{children}</button>
}

export function Field({
  label,
  error,
  hint,
  id,
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string; ref?: Ref<HTMLInputElement> }) {
  const fieldId = id ?? props.name
  const errorId = `${fieldId}-error`
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label htmlFor={fieldId} className="block text-sm font-medium text-[var(--color-ink)]">{label}</label>
      <input id={fieldId} className="field" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props} />
      {hint && !error && <p className="text-xs text-[var(--color-ink-muted)]">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-[var(--color-negative)]">{error}</p>}
    </div>
  )
}

export function SelectField({
  label,
  error,
  id,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; error?: string; ref?: Ref<HTMLSelectElement> }) {
  const fieldId = id ?? props.name
  const errorId = `${fieldId}-error`
  return (
    <div className="space-y-1.5">
      <label htmlFor={fieldId} className="block text-sm font-medium text-[var(--color-ink)]">{label}</label>
      <select id={fieldId} className="field" aria-invalid={Boolean(error)} aria-describedby={error ? errorId : undefined} {...props}>{children}</select>
      {error && <p id={errorId} role="alert" className="text-xs font-medium text-[var(--color-negative)]">{error}</p>}
    </div>
  )
}

export function PageSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-label="Loading content" role="status" className="space-y-4">
      <span className="sr-only">Loading content</span>
      <div className="h-24 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-muted)]" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: rows }, (_, index) => <div key={index} className="h-36 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />)}
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
      <AlertCircle size={22} strokeWidth={1.5} className="mx-auto mb-3 text-[var(--color-negative)]" aria-hidden="true" />
      <h2 className="font-semibold">We couldn’t load this information</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-[var(--color-ink-muted)]">{message}</p>
      <Button variant="secondary" className="mt-4" onClick={onRetry}>Try again</Button>
    </div>
  )
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  size = 'max-w-lg',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  size?: string
}) {
  const dialogRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('button, input, select')?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      previousFocus?.focus()
    }
  }, [open])

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
    if (event.key === 'Tab' && dialogRef.current) {
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-5"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
        >
          <motion.section
            role="dialog" aria-modal="true" aria-labelledby="dialog-title" aria-describedby={description ? 'dialog-description' : undefined}
            className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-xl sm:max-h-[88dvh] sm:rounded-xl sm:p-6 ${size}`}
            initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.18 }}
            onKeyDown={handleKeyDown}
            ref={dialogRef}
          >
            <header className="mb-5 flex items-start justify-between gap-4">
              <div><h2 id="dialog-title" className="text-lg font-semibold tracking-tight">{title}</h2>{description && <p id="dialog-description" className="mt-1 text-sm text-[var(--color-ink-muted)]">{description}</p>}</div>
              <button onClick={onClose} className="rounded-md p-1.5 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]" aria-label="Close dialog"><X size={18} strokeWidth={1.5} /></button>
            </header>
            {children}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

type Toast = { id: number; title: string; message?: string; kind: 'success' | 'error' }
interface ToastContextValue { notify: (title: string, message?: string, kind?: Toast['kind']) => void }
const ToastContext = createContext<ToastContextValue | null>(null)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const notify = useCallback((title: string, message?: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((current) => [...current, { id, title, message, kind }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200)
  }, [])
  const value = useMemo(() => ({ notify }), [notify])
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="fixed right-4 top-4 z-[70] flex w-[min(360px,calc(100%-32px))] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div key={toast.id} role={toast.kind === 'error' ? 'alert' : 'status'} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: 10 }} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-lg">
              {toast.kind === 'success' ? <Check size={18} className="mt-0.5 text-[var(--color-positive)]" strokeWidth={1.5} /> : <AlertCircle size={18} className="mt-0.5 text-[var(--color-negative)]" strokeWidth={1.5} />}
              <div className="min-w-0 flex-1"><p className="font-semibold">{toast.title}</p>{toast.message && <p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">{toast.message}</p>}</div>
              <button aria-label="Dismiss notification" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))}><X size={16} strokeWidth={1.5} /></button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string
  description: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-12 text-center">
    {icon && <div className="mb-3 flex justify-center text-[var(--color-ink-muted)]">{icon}</div>}
    <h2 className="font-semibold">{title}</h2><p className="mx-auto mt-1 max-w-sm text-sm text-[var(--color-ink-muted)]">{description}</p>
    {action && <div className="mt-5">{action}</div>}
  </div>
}
