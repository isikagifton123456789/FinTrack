import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, LogOut, Menu, Plus, Search, Users, X } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import { Dialog } from '../shared/ui'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api'

const pageNames: Record<string, string> = {
  '/portfolios': 'Portfolios',
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const user = readUser()
  const portfolios = useQuery({ queryKey: ['portfolios'], queryFn: api.getPortfolios, enabled: commandOpen })
  const title = location.pathname.startsWith('/portfolios/') ? 'Portfolio detail' : pageNames[location.pathname] ?? 'Workspace'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandOpen((current) => !current)
      }
      if (event.key === 'Escape') { setCommandOpen(false); setSidebarOpen(false); setUserMenuOpen(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function signOut() {
    window.localStorage.removeItem('fintrack.user')
    window.localStorage.removeItem('fintrack.token')
    window.localStorage.removeItem('fintrack.refreshToken')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-[var(--color-paper)]">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-[var(--color-border)] bg-[var(--color-surface)] lg:flex lg:flex-col">
        <div className="px-7 py-7"><Brand /></div>
        <nav aria-label="Main navigation" className="space-y-1 px-3">
          <NavLink to="/portfolios" className={({ isActive }) => navClass(isActive)}><LayoutDashboard size={18} strokeWidth={1.5} /> Portfolios</NavLink>
        </nav>
        <div className="mt-auto border-t border-[var(--color-border)] p-4">
          <div className="rounded-lg bg-[var(--color-surface-muted)] p-3">
            <p className="text-xs font-semibold">Finnet workspace</p><p className="mt-1 text-xs text-[var(--color-ink-muted)]">Portfolio overview</p>
          </div>
          <p className="px-2 pt-4 text-[10px] text-[var(--color-ink-muted)]">FINTRACK · FINNET TECHNOLOGIES</p>
        </div>
      </aside>

      <AnimatePresence>
        {sidebarOpen && <motion.div className="fixed inset-0 z-50 bg-black/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setSidebarOpen(false) }}>
          <motion.aside role="dialog" aria-modal="true" aria-label="Navigation menu" className="flex h-full w-[min(290px,85vw)] flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]" initial={{ x: -24 }} animate={{ x: 0 }} exit={{ x: -24 }}>
            <div className="flex items-center justify-between px-6 py-6"><Brand /><button aria-label="Close navigation" onClick={() => setSidebarOpen(false)}><X size={19} strokeWidth={1.5} /></button></div>
            <nav aria-label="Main navigation" className="space-y-1 px-3"><NavLink onClick={() => setSidebarOpen(false)} to="/portfolios" className={({ isActive }) => navClass(isActive)}><LayoutDashboard size={18} strokeWidth={1.5} /> Portfolios</NavLink></nav>
            <div className="mt-auto p-4 text-xs text-[var(--color-ink-muted)]">Finnet Technologies</div>
          </motion.aside>
        </motion.div>}
      </AnimatePresence>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-paper)]/95 px-4 backdrop-blur-sm sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Open navigation" className="rounded-md p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] lg:hidden" onClick={() => setSidebarOpen(true)}><Menu size={19} strokeWidth={1.5} /></button>
            <h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{title}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setCommandOpen(true)} aria-label="Open quick search" className="flex h-9 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] sm:px-3">
              <Search size={16} strokeWidth={1.5} /><span className="hidden text-xs sm:inline">Search portfolios</span><kbd className="hidden rounded border border-[var(--color-border)] px-1 text-[10px] sm:inline">⌘ / Ctrl K</kbd>
            </button>
            <div className="relative">
              <button onClick={() => setUserMenuOpen((current) => !current)} className="flex h-9 items-center gap-2 rounded-lg px-1.5 hover:bg-[var(--color-surface-muted)]" aria-expanded={userMenuOpen} aria-label="User menu">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-xs font-semibold text-[var(--color-navy)]">{user?.name?.split(' ').map((part) => part[0]).slice(0, 2).join('') ?? 'FT'}</span>
                <span className="hidden max-w-32 truncate text-sm font-medium sm:block">{user?.name ?? 'Analyst'}</span>
              </button>
              {userMenuOpen && <div className="absolute right-0 top-11 z-30 w-56 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2 shadow-lg">
                <p className="truncate px-2 py-2 text-xs text-[var(--color-ink-muted)]">{user?.email}</p>
                <button onClick={signOut} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"><LogOut size={16} strokeWidth={1.5} /> Sign out</button>
              </div>}
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-[calc(100dvh-68px)] max-w-[1440px] px-4 pb-24 pt-6 sm:px-7 sm:pt-8 lg:pb-10 lg:px-10">
          <Outlet />
        </main>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 pb-[env(safe-area-inset-bottom)] pt-2 lg:hidden">
        <NavLink to="/portfolios" className={({ isActive }) => `flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] ${isActive ? 'font-semibold text-[var(--color-navy)]' : 'text-[var(--color-ink-muted)]'}`}><LayoutDashboard size={18} strokeWidth={1.5} /> Portfolios</NavLink>
        <button onClick={() => setCommandOpen(true)} className="flex min-h-12 flex-col items-center justify-center gap-1 text-[11px] text-[var(--color-ink-muted)]"><Search size={18} strokeWidth={1.5} /> Search</button>
      </nav>
      <Dialog open={commandOpen} onClose={() => setCommandOpen(false)} title="Go to" description="Find a portfolio or start a new one." size="max-w-xl">
        <div className="space-y-2">
          <button onClick={() => { setCommandOpen(false); navigate('/portfolios?new=1') }} className="flex w-full items-center gap-3 rounded-lg border border-[var(--color-border)] p-3 text-left hover:bg-[var(--color-surface-muted)]"><Plus size={17} strokeWidth={1.5} /><span className="flex-1 text-sm font-medium">Create a portfolio</span><kbd className="text-xs text-[var(--color-ink-muted)]">New</kbd></button>
          {portfolios.isPending && <p className="px-3 py-3 text-sm text-[var(--color-ink-muted)]">Loading portfolios…</p>}
          {portfolios.isError && <div className="px-3 py-3 text-sm text-[var(--color-negative)]"><p role="alert">Search is unavailable.</p><button className="mt-1 font-semibold underline" onClick={() => void portfolios.refetch()}>Try again</button></div>}
          {portfolios.data?.map((portfolio) => <Link key={portfolio.id} onClick={() => setCommandOpen(false)} to={`/portfolios/${portfolio.id}`} className="flex items-center gap-3 rounded-lg p-3 hover:bg-[var(--color-surface-muted)]"><Users size={17} strokeWidth={1.5} /><span className="flex-1 text-sm font-medium">{portfolio.name}</span><span className="text-xs text-[var(--color-ink-muted)]">{portfolio.baseCurrency}</span></Link>)}
          {portfolios.data?.length === 0 && <p className="px-3 py-3 text-sm text-[var(--color-ink-muted)]">No portfolios yet. Create one to get started.</p>}
        </div>
      </Dialog>
    </div>
  )
}

function Brand() {
  return <Link to="/portfolios" className="inline-flex flex-col leading-none text-[var(--color-ink)]" aria-label="FinTrack by Finnet Technologies">
    <span className="text-[22px] font-bold tracking-[-.05em]">Fin<span className="text-[var(--color-accent)]">Track</span></span>
    <span className="mt-1 text-[10px] tracking-wide text-[var(--color-ink-muted)]">by Finnet Technologies</span>
  </Link>
}

function readUser(): { name?: string; email?: string } | null {
  const stored = window.localStorage.getItem('fintrack.user')
  if (!stored) return null
  const parsed: unknown = JSON.parse(stored)
  if (typeof parsed !== 'object' || parsed === null) throw new Error('The saved user profile is invalid. Sign out and sign in again.')
  return {
    name: 'name' in parsed && typeof parsed.name === 'string' ? parsed.name : undefined,
    email: 'email' in parsed && typeof parsed.email === 'string' ? parsed.email : undefined,
  }
}

function navClass(active: boolean): string {
  return `flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition ${active ? 'bg-[var(--color-accent-light)] text-[var(--color-nav-active-text)]' : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-ink)]'}`
}
