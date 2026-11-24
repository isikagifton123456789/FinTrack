import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { BriefcaseBusiness, Grid2X2, List, MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import type { Portfolio } from '../../types'
import { formatCurrency, signedCurrency } from '../../lib/format'
import { Button, Dialog, EmptyState, ErrorState, Field, PageSkeleton, SelectField, useToast } from '../../shared/ui'
import { portfolioSchema, type PortfolioValues } from './schemas'

export function PortfoliosPage() {
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'name' | 'recent'>('name')
  const [display, setDisplay] = useState<'cards' | 'table'>('cards')
  const [editing, setEditing] = useState<Portfolio | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Portfolio | null>(null)
  const portfolios = useQuery({ queryKey: ['portfolios'], queryFn: api.getPortfolios })
  const form = useForm<PortfolioValues>({ resolver: zodResolver(portfolioSchema), defaultValues: { name: '', clientName: '', baseCurrency: 'KES' } })
  const save = useMutation({
    mutationFn: ({ id, values }: { id?: string; values: PortfolioValues }) => id ? api.updatePortfolio(id, values) : api.createPortfolio(values),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      if (variables.id) await queryClient.invalidateQueries({ queryKey: ['portfolio', variables.id] })
      setEditing(null)
      setFormOpen(false)
      form.reset({ name: '', clientName: '', baseCurrency: 'KES' })
      notify(variables.id ? 'Portfolio updated' : 'Portfolio created', 'Your changes have been saved.')
    },
    onError: (error: Error) => notify('Portfolio could not be saved', error.message, 'error'),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePortfolio(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      setDeleting(null)
      notify('Portfolio deleted', 'The portfolio and its transactions were removed.')
    },
    onError: (error: Error) => notify('Portfolio could not be deleted', error.message, 'error'),
  })

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setSearchParams({}, { replace: true })
      setEditing(null)
      setFormOpen(true)
    }
  }, [searchParams, setSearchParams])
  useEffect(() => {
    if (editing) form.reset({ name: editing.name, clientName: editing.clientName, baseCurrency: editing.baseCurrency })
    else form.reset({ name: '', clientName: '', baseCurrency: 'KES' })
  }, [editing, form])

  const filtered = (portfolios.data ?? [])
    .filter((portfolio) => `${portfolio.name} ${portfolio.clientName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : b.createdAt.localeCompare(a.createdAt))

  function openCreate() {
    setEditing(null)
    form.reset({ name: '', clientName: '', baseCurrency: 'KES' })
    setFormOpen(true)
  }

  return (
    <motion.section initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }} className="space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><p className="text-sm text-[var(--color-ink-muted)]">A considered view of your client accounts.</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em] sm:text-[28px]">Your portfolios</h2></div>
        <Button id="create-portfolio" onClick={openCreate}><Plus size={17} strokeWidth={1.7} /> New portfolio</Button>
      </header>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:flex-row sm:items-center">
        <label className="relative min-w-0 flex-1">
          <Search size={16} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <span className="sr-only">Search portfolios</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by portfolio or client" className="field search-field h-10" />
        </label>
        <div className="flex items-center justify-between gap-2 sm:justify-end">
          <label className="sr-only" htmlFor="portfolio-sort">Sort portfolios</label>
          <select id="portfolio-sort" className="field h-10 w-auto min-w-[145px] py-2 text-sm" value={sort} onChange={(event) => setSort(event.target.value as 'name' | 'recent')}>
            <option value="name">Name, A to Z</option><option value="recent">Recently added</option>
          </select>
          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5" aria-label="Portfolio layout">
            <button onClick={() => setDisplay('cards')} aria-label="Card view" aria-pressed={display === 'cards'} className={`rounded-md p-2 ${display === 'cards' ? 'bg-[var(--color-surface-muted)]' : 'text-[var(--color-ink-muted)]'}`}><Grid2X2 size={16} strokeWidth={1.5} /></button>
            <button onClick={() => setDisplay('table')} aria-label="Table view" aria-pressed={display === 'table'} className={`rounded-md p-2 ${display === 'table' ? 'bg-[var(--color-surface-muted)]' : 'text-[var(--color-ink-muted)]'}`}><List size={16} strokeWidth={1.5} /></button>
          </div>
        </div>
      </div>

      {portfolios.isPending ? <PageSkeleton rows={3} /> : portfolios.isError ? <ErrorState message={portfolios.error.message} onRetry={() => void portfolios.refetch()} /> :
        portfolios.data.length === 0 ? <EmptyState title="A good place to begin" description="Create your first portfolio to bring a client’s holdings and activity into one view." icon={<BriefcaseBusiness size={26} strokeWidth={1.4} />} action={<Button onClick={openCreate}><Plus size={16} /> Create a portfolio</Button>} /> :
          filtered.length === 0 ? <EmptyState title="No portfolios match that search" description="Try a different name or client, or clear your search." icon={<Search size={24} strokeWidth={1.5} />} action={<Button variant="secondary" onClick={() => setSearch('')}>Clear search</Button>} /> :
            display === 'cards' ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((portfolio, index) => <PortfolioCard key={portfolio.id} portfolio={portfolio} index={index} onEdit={() => { setEditing(portfolio); setFormOpen(true) }} onDelete={() => setDeleting(portfolio)} />)}
              </AnimatePresence>
            </div> : <PortfolioTable portfolios={filtered} onEdit={(portfolio) => { setEditing(portfolio); setFormOpen(true) }} onDelete={setDeleting} />}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit portfolio' : 'Create a portfolio'} description="Keep the portfolio details clear for everyone working with this client.">
        <form className="space-y-4" onSubmit={form.handleSubmit((values) => save.mutate({ id: editing?.id, values }))}>
          <Field label="Portfolio name" placeholder="e.g. Wanjiku Family Trust" {...form.register('name')} error={form.formState.errors.name?.message} />
          <Field label="Client name" placeholder="e.g. Grace Wanjiku" {...form.register('clientName')} error={form.formState.errors.clientName?.message} />
          <SelectField label="Base currency" {...form.register('baseCurrency')} error={form.formState.errors.baseCurrency?.message}><option value="KES">KES — Kenyan shilling</option><option value="USD">USD — US dollar</option></SelectField>
          {save.isError && <p role="alert" className="text-sm text-[var(--color-negative)]">{save.error.message}</p>}
          <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>Cancel</Button><Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : editing ? 'Save changes' : 'Create portfolio'}</Button></div>
        </form>
      </Dialog>
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete this portfolio?" description={deleting ? `${deleting.name} and its transaction history will be permanently removed. This can’t be undone.` : undefined}>
        <p className="text-sm leading-6 text-[var(--color-ink-muted)]">Make sure you’ve saved any information you may need. All transactions belonging to this portfolio will also be deleted.</p>
        <div className="mt-6 flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleting(null)}>Keep portfolio</Button><Button variant="danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}><Trash2 size={16} />{remove.isPending ? 'Deleting…' : 'Delete portfolio'}</Button></div>
      </Dialog>
    </motion.section>
  )
}

function PortfolioCard({ portfolio, index, onEdit, onDelete }: { portfolio: Portfolio; index: number; onEdit: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  return <motion.article layout initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 5 }} transition={{ duration: .18, delay: Math.min(index * .045, .18) }} className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition hover:border-[color-mix(in_srgb,var(--color-ink-muted)_45%,transparent)]">
    <div className="flex items-start justify-between gap-3">
      <Link to={`/portfolios/${portfolio.id}`} className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="text-xs font-semibold uppercase tracking-[.13em] text-[var(--color-accent)]">{portfolio.baseCurrency}</span>
        <h3 className="mt-2 truncate text-lg font-semibold tracking-[-.025em]">{portfolio.name}</h3>
        <p className="mt-1 truncate text-sm text-[var(--color-ink-muted)]">{portfolio.clientName}</p>
      </Link>
      <div className="relative z-10">
        <button aria-label={`More actions for ${portfolio.name}`} aria-expanded={menuOpen} onClick={() => setMenuOpen((current) => !current)} className="rounded-md p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]"><MoreHorizontal size={18} strokeWidth={1.5} /></button>
        {menuOpen && <div className="absolute right-0 top-10 z-20 w-40 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-lg">
          <button onClick={() => { setMenuOpen(false); onEdit() }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"><Pencil size={15} strokeWidth={1.5} /> Edit</button>
          <button onClick={() => { setMenuOpen(false); onDelete() }} className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-[var(--color-negative)] hover:bg-[var(--color-negative-soft)]"><Trash2 size={15} strokeWidth={1.5} /> Delete</button>
        </div>}
      </div>
    </div>
    <div className="relative z-10 mt-6 border-t border-[var(--color-border)] pt-4">
      <p className="text-xs text-[var(--color-ink-muted)]">Current value</p>
      <PortfolioValue portfolio={portfolio} />
    </div>
  </motion.article>
}

function PortfolioValue({ portfolio }: { portfolio: Portfolio }) {
  const summary = useQuery({ queryKey: ['summary', portfolio.id], queryFn: () => api.getSummary(portfolio.id) })
  if (summary.isPending) return <div role="status" aria-label="Loading portfolio value" className="mt-2 h-7 w-40 animate-pulse rounded bg-[var(--color-surface-muted)]" />
  if (summary.isError) return <button className="mt-2 text-xs font-medium text-[var(--color-negative)] underline" onClick={() => void summary.refetch()}>Value unavailable · retry</button>
  const gain = summary.data.unrealisedGainLoss
  const gainLabel = gain >= 0 ? `Gain ${signedCurrency(gain, portfolio.baseCurrency)}` : `Loss ${signedCurrency(gain, portfolio.baseCurrency)}`
  return <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
    <span className="tabular text-xl font-semibold tracking-tight">{formatCurrency(summary.data.currentValue, portfolio.baseCurrency)}</span>
    <span aria-label={gainLabel} className={`tabular text-xs font-semibold ${gain >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{signedCurrency(gain, portfolio.baseCurrency)}</span>
  </div>
}

function PortfolioTable({ portfolios, onEdit, onDelete }: { portfolios: Portfolio[]; onEdit: (portfolio: Portfolio) => void; onDelete: (portfolio: Portfolio) => void }) {
  return <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
    <table className="w-full min-w-[640px] border-collapse text-left">
      <caption className="sr-only">Client portfolios and current values</caption>
      <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-ink-muted)]"><tr><th scope="col" className="px-4 py-3 font-medium">Portfolio</th><th scope="col" className="px-4 py-3 font-medium">Client</th><th scope="col" className="px-4 py-3 font-medium">Currency</th><th scope="col" className="px-4 py-3 text-right font-medium">Value</th><th scope="col" className="px-4 py-3 text-right font-medium">Actions</th></tr></thead>
      <tbody>{portfolios.map((portfolio) => <tr key={portfolio.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]">
        <th scope="row" className="px-4 py-4 text-left font-semibold"><Link to={`/portfolios/${portfolio.id}`} className="hover:underline">{portfolio.name}</Link></th><td className="px-4 py-4 text-[var(--color-ink-muted)]">{portfolio.clientName}</td><td className="px-4 py-4">{portfolio.baseCurrency}</td><td className="px-4 py-4 text-right"><PortfolioValue portfolio={portfolio} /></td>
        <td className="px-4 py-4 text-right"><div className="inline-flex gap-1"><button aria-label={`Edit ${portfolio.name}`} onClick={() => onEdit(portfolio)} className="rounded p-2 hover:bg-[var(--color-paper)]"><Pencil size={16} strokeWidth={1.5} /></button><button aria-label={`Delete ${portfolio.name}`} onClick={() => onDelete(portfolio)} className="rounded p-2 text-[var(--color-negative)] hover:bg-[var(--color-negative-soft)]"><Trash2 size={16} strokeWidth={1.5} /></button></div></td>
      </tr>)}</tbody>
    </table>
  </div>
}
