import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion, useMotionValue, useReducedMotion, useTransform, animate } from 'framer-motion'
import { ArrowLeft, ArrowUpDown, BarChart3, CalendarDays, Download, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { api } from '../../api'
import { downloadCsv } from '../../lib/csv'
import { formatCurrency, formatDate, formatPercent, formatQuantity, signedCurrency } from '../../lib/format'
import type { Currency, Transaction, TransactionType } from '../../types'
import { Button, Dialog, EmptyState, ErrorState, Field, useToast } from '../../shared/ui'
import { knownInstruments } from '../../api/mock'
import { transactionSchema, type TransactionValues } from '../transactions/schemas'

const chartColors = ['var(--color-navy)', 'var(--color-accent)', 'var(--color-positive)', 'var(--color-chart-muted)']

export function PortfolioDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const [transactionOpen, setTransactionOpen] = useState(false)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const [showChartData, setShowChartData] = useState(false)
  const queryClient = useQueryClient()
  const { notify } = useToast()
  const portfolio = useQuery({ queryKey: ['portfolio', id], queryFn: () => api.getPortfolio(id), enabled: Boolean(id) })
  const summary = useQuery({ queryKey: ['summary', id], queryFn: () => api.getSummary(id), enabled: Boolean(id) })
  const transactions = useQuery({ queryKey: ['transactions', id], queryFn: () => api.getTransactions(id), enabled: Boolean(id) })
  const form = useForm<TransactionValues>({ resolver: zodResolver(transactionSchema), defaultValues: { instrument: '', type: 'BUY', quantity: 0, unitPrice: 0, tradeDate: new Date().toISOString().slice(0, 10) } })
  const instrument = form.watch('instrument').trim().toUpperCase()
  const type = form.watch('type')
  const quantity = Number(form.watch('quantity')) || 0
  const unitPrice = Number(form.watch('unitPrice')) || 0
  const tradeDate = form.watch('tradeDate')
  const availableQuantity = (transactions.data ?? [])
    .filter((item) => item.instrument === instrument && item.tradeDate <= tradeDate)
    .reduce((held, item) => held + (item.type === 'BUY' ? item.quantity : -item.quantity), 0)
  const oversell = type === 'SELL' && quantity > availableQuantity

  const addTransaction = useMutation({
    mutationFn: (values: TransactionValues) => api.createTransaction(id, values),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', id] }),
        queryClient.invalidateQueries({ queryKey: ['summary', id] }),
      ])
      form.reset({ instrument: '', type: 'BUY', quantity: 0, unitPrice: 0, tradeDate: new Date().toISOString().slice(0, 10) })
      setTransactionOpen(false)
      notify('Transaction added', 'Portfolio values and holdings have been updated.')
    },
    onError: (error: Error) => notify('Transaction could not be added', error.message, 'error'),
  })
  const removeTransaction = useMutation({
    mutationFn: (transactionId: string) => api.deleteTransaction(transactionId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions', id] }),
        queryClient.invalidateQueries({ queryKey: ['summary', id] }),
      ])
      setDeleting(null)
      notify('Transaction deleted', 'Holdings and totals have been recalculated.')
    },
    onError: (error: Error) => notify('Transaction could not be deleted', error.message, 'error'),
  })

  const filteredTransactions = useMemo(() => {
    const all = transactions.data ?? []
    const instrumentFilter = params.get('instrument') ?? ''
    const typeFilter = params.get('type') ?? ''
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    const sort = params.get('sort') ?? 'date-desc'
    return all.filter((transaction) =>
      (!instrumentFilter || transaction.instrument === instrumentFilter) &&
      (!typeFilter || transaction.type === typeFilter) &&
      (!from || transaction.tradeDate >= from) &&
      (!to || transaction.tradeDate <= to),
    ).sort((a, b) => sort === 'date-asc'
      ? a.tradeDate.localeCompare(b.tradeDate)
      : b.tradeDate.localeCompare(a.tradeDate))
  }, [params, transactions.data])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  if (portfolio.isPending || summary.isPending || transactions.isPending) return <DetailSkeleton />
  if (portfolio.isError || summary.isError || transactions.isError) {
    const error = portfolio.error ?? summary.error ?? transactions.error
    return <ErrorState message={error?.message ?? 'Please try again.'} onRetry={() => { void portfolio.refetch(); void summary.refetch(); void transactions.refetch() }} />
  }
  const currentPortfolio = portfolio.data
  const gain = summary.data.unrealisedGainLoss
  const gainPercent = summary.data.totalInvested === 0 ? 0 : (gain / summary.data.totalInvested) * 100

  return (
    <motion.section initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }} className="space-y-7">
      <header>
        <Link to="/portfolios" className="mb-4 inline-flex items-center gap-2 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"><ArrowLeft size={16} strokeWidth={1.5} /> All portfolios</Link>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-sm text-[var(--color-ink-muted)]">{currentPortfolio.clientName} <span className="px-1">·</span> {currentPortfolio.baseCurrency}</p><h2 className="mt-1 text-2xl font-semibold tracking-[-.04em] sm:text-[30px]">{currentPortfolio.name}</h2></div>
          <Button onClick={() => setTransactionOpen(true)}><Plus size={17} /> Add transaction</Button>
        </div>
      </header>

      <section aria-label="Portfolio performance" className="grid gap-3 sm:grid-cols-3">
        <Metric label="Current value" value={summary.data.currentValue} currency={currentPortfolio.baseCurrency} />
        <Metric label="Total invested" value={summary.data.totalInvested} currency={currentPortfolio.baseCurrency} />
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5">
          <p className="text-sm text-[var(--color-ink-muted)]">Unrealised gain / loss</p>
          <p aria-label={`${gain >= 0 ? 'Gain' : 'Loss'} ${signedCurrency(gain, currentPortfolio.baseCurrency)}`} className={`tabular mt-2 text-xl font-semibold tracking-tight ${gain >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{signedCurrency(gain, currentPortfolio.baseCurrency)}</p>
          <p className={`mt-1 flex items-center gap-1 text-xs font-medium ${gain >= 0 ? 'text-[var(--color-positive)]' : 'text-[var(--color-negative)]'}`}>{gain >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />} {formatPercent(gainPercent)} against invested</p>
        </div>
      </section>

      <section aria-labelledby="holdings-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h3 id="holdings-title" className="text-lg font-semibold">Holdings</h3><p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">Average cost and current allocation by instrument.</p></div><Button variant="secondary" disabled={!summary.data.holdings.length} onClick={() => downloadCsv(`${safeFilename(currentPortfolio.name)}-holdings.csv`, ['Instrument', 'Quantity', `Average cost (${currentPortfolio.baseCurrency})`, `Invested (${currentPortfolio.baseCurrency})`, `Current value (${currentPortfolio.baseCurrency})`], summary.data.holdings.map((holding) => [holding.instrument, holding.quantity, holding.averageCost, holding.totalInvested, holding.totalValue]))}><Download size={16} /> Export holdings</Button></div>
        {summary.data.holdings.length === 0 ? <EmptyState title="No holdings yet" description="Add a buy transaction to start tracking this portfolio’s holdings." icon={<BarChart3 size={25} strokeWidth={1.5} />} action={<Button onClick={() => setTransactionOpen(true)}><Plus size={16} /> Add transaction</Button>} /> :
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,1fr)]">
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              <table className="w-full min-w-[600px] border-collapse text-sm">
                <caption className="sr-only">Holdings with quantity, average cost, invested amount, and current value</caption>
                <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-ink-muted)]"><tr><th scope="col" className="px-4 py-3 text-left font-medium">Instrument</th><th scope="col" className="px-4 py-3 text-right font-medium">Net quantity</th><th scope="col" className="px-4 py-3 text-right font-medium">Average cost</th><th scope="col" className="px-4 py-3 text-right font-medium">Invested</th><th scope="col" className="px-4 py-3 text-right font-medium">Value</th></tr></thead>
                <tbody>{summary.data.holdings.map((holding) => <tr key={holding.instrument} className="border-t border-[var(--color-border)]"><th scope="row" className="px-4 py-3.5 text-left font-semibold">{holding.instrument}</th><td className="tabular px-4 py-3.5 text-right">{formatQuantity(holding.quantity)}</td><td className="tabular px-4 py-3.5 text-right">{formatCurrency(holding.averageCost, currentPortfolio.baseCurrency)}</td><td className="tabular px-4 py-3.5 text-right">{formatCurrency(holding.totalInvested, currentPortfolio.baseCurrency)}</td><td className="tabular px-4 py-3.5 text-right font-medium">{formatCurrency(holding.totalValue, currentPortfolio.baseCurrency)}</td></tr>)}</tbody>
              </table>
            </div>
            <AllocationChart holdings={summary.data.holdings} currency={currentPortfolio.baseCurrency} showData={showChartData} onToggle={() => setShowChartData((value) => !value)} />
          </div>}
      </section>

      <section aria-labelledby="transactions-title" className="space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div><h3 id="transactions-title" className="text-lg font-semibold">Transactions</h3><p className="mt-0.5 text-sm text-[var(--color-ink-muted)]">A record of activity in this portfolio.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="secondary" className="col-span-2 sm:col-span-1" disabled={!filteredTransactions.length} onClick={() => downloadCsv(`${safeFilename(currentPortfolio.name)}-transactions.csv`, ['Trade date', 'Instrument', 'Type', 'Quantity', `Unit price (${currentPortfolio.baseCurrency})`, `Total (${currentPortfolio.baseCurrency})`], filteredTransactions.map((transaction) => [transaction.tradeDate, transaction.instrument, transaction.type, transaction.quantity, transaction.unitPrice, transaction.quantity * transaction.unitPrice]))}><Download size={16} /> Export CSV</Button>
            <label className="sr-only" htmlFor="filter-instrument">Filter by instrument</label><select id="filter-instrument" className="field h-10 py-2 text-sm" value={params.get('instrument') ?? ''} onChange={(event) => setFilter('instrument', event.target.value)}><option value="">All instruments</option>{[...new Set(transactions.data.map((item) => item.instrument))].sort().map((item) => <option key={item}>{item}</option>)}</select>
            <label className="sr-only" htmlFor="filter-type">Filter by transaction type</label><select id="filter-type" className="field h-10 py-2 text-sm" value={params.get('type') ?? ''} onChange={(event) => setFilter('type', event.target.value)}><option value="">Buy and sell</option><option value="BUY">Buy only</option><option value="SELL">Sell only</option></select>
            <label className="sr-only" htmlFor="filter-from">From date</label><input id="filter-from" type="date" aria-label="From date" className="field h-10 min-w-0 px-2 py-2 text-xs" value={params.get('from') ?? ''} onChange={(event) => setFilter('from', event.target.value)} />
            <label className="sr-only" htmlFor="filter-to">To date</label><input id="filter-to" type="date" aria-label="To date" className="field h-10 min-w-0 px-2 py-2 text-xs" value={params.get('to') ?? ''} onChange={(event) => setFilter('to', event.target.value)} />
          </div>
        </div>
        {filteredTransactions.length === 0 ? <EmptyState title={transactions.data.length ? 'No transactions match these filters' : 'No activity recorded yet'} description={transactions.data.length ? 'Adjust the dates or filters to see more transactions.' : 'Add a transaction to keep a complete record of portfolio activity.'} icon={<CalendarDays size={24} strokeWidth={1.5} />} action={transactions.data.length ? <Button variant="secondary" onClick={() => setParams({}, { replace: true })}>Clear filters</Button> : <Button onClick={() => setTransactionOpen(true)}><Plus size={16} /> Add transaction</Button>} /> :
          <TransactionList transactions={filteredTransactions} currency={currentPortfolio.baseCurrency} sort={params.get('sort') ?? 'date-desc'} onSort={(sort) => setFilter('sort', sort)} onDelete={setDeleting} />}
      </section>

      <TransactionDialog
        open={transactionOpen}
        onClose={() => setTransactionOpen(false)}
        form={form}
        onSubmit={(values) => addTransaction.mutate(values)}
        currency={currentPortfolio.baseCurrency}
        total={quantity * unitPrice}
        oversell={oversell}
        availableQuantity={availableQuantity}
        isSubmitting={addTransaction.isPending}
        error={addTransaction.isError ? addTransaction.error.message : undefined}
      />
      <Dialog open={Boolean(deleting)} onClose={() => setDeleting(null)} title="Delete transaction?" description={deleting ? `${deleting.type} ${formatQuantity(deleting.quantity)} ${deleting.instrument} on ${formatDate(deleting.tradeDate)} will be removed. Portfolio totals will be recalculated.` : undefined}>
        <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setDeleting(null)}>Cancel</Button><Button variant="danger" disabled={removeTransaction.isPending} onClick={() => deleting && removeTransaction.mutate(deleting.id)}><Trash2 size={16} />{removeTransaction.isPending ? 'Deleting…' : 'Delete transaction'}</Button></div>
      </Dialog>
    </motion.section>
  )
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'portfolio'
}

function Metric({ label, value, currency }: { label: string; value: number; currency: Currency }) {
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"><p className="text-sm text-[var(--color-ink-muted)]">{label}</p><AnimatedNumber value={value} currency={currency} /></div>
}

function AnimatedNumber({ value, currency }: { value: number; currency: Currency }) {
  const motionValue = useMotionValue(0)
  const prefersReducedMotion = useReducedMotion()
  const display = useTransform(motionValue, (current) => formatCurrency(current, currency))
  useEffect(() => {
    const controls = animate(motionValue, value, { duration: prefersReducedMotion ? 0 : .65, ease: 'easeOut' })
    return controls.stop
  }, [motionValue, prefersReducedMotion, value])
  return <motion.p className="tabular mt-2 text-xl font-semibold tracking-tight">{display}</motion.p>
}

function AllocationChart({ holdings, currency, showData, onToggle }: { holdings: { instrument: string; totalValue: number }[]; currency: Currency; showData: boolean; onToggle: () => void }) {
  const total = holdings.reduce((sum, item) => sum + item.totalValue, 0)
  const data = holdings.map((holding) => ({ name: holding.instrument, value: holding.totalValue }))
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <div className="flex items-center justify-between"><h4 className="text-sm font-semibold">Allocation</h4><button onClick={onToggle} className="text-xs font-medium text-[var(--color-navy)] underline underline-offset-2">{showData ? 'Hide data' : 'View data'}</button></div>
    {!showData ? <div role="img" aria-label={`Portfolio allocation chart: ${data.map((item) => `${item.name}, ${formatPercent(total ? item.value / total * 100 : 0)}`).join('; ')}`} className="h-[180px]">
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={3} stroke="none" isAnimationActive><Cell fill="var(--color-navy)" />{data.slice(1).map((item, index) => <Cell key={item.name} fill={chartColors[(index + 1) % chartColors.length]} />)}</Pie><Tooltip formatter={(value) => formatCurrency(Number(value), currency)} /></PieChart></ResponsiveContainer>
    </div> : <div className="space-y-3 py-4">{data.map((item, index) => <div key={item.name} className="flex items-center gap-2 text-sm"><span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} /><span className="flex-1">{item.name}</span><span className="tabular text-[var(--color-ink-muted)]">{formatPercent(total ? item.value / total * 100 : 0)}</span><span className="tabular w-28 text-right">{formatCurrency(item.value, currency)}</span></div>)}</div>}
    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1" aria-hidden="true">{data.map((item, index) => <span key={item.name} className="flex items-center gap-1.5 text-[10px] text-[var(--color-ink-muted)]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: chartColors[index % chartColors.length] }} />{item.name}</span>)}</div>
  </div>
}

function TransactionList({ transactions, currency, sort, onSort, onDelete }: { transactions: Transaction[]; currency: Currency; sort: string; onSort: (sort: string) => void; onDelete: (transaction: Transaction) => void }) {
  const nextSort = sort === 'date-desc' ? 'date-asc' : 'date-desc'
  return <>
    <div className="hidden overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] sm:block">
      <table className="w-full border-collapse text-sm">
        <caption className="sr-only">Portfolio transaction history</caption>
        <thead className="bg-[var(--color-surface-muted)] text-xs text-[var(--color-ink-muted)]"><tr>
          <th scope="col" aria-sort={sort === 'date-asc' ? 'ascending' : 'descending'} className="px-4 py-3 text-left font-medium"><button onClick={() => onSort(nextSort)} className="inline-flex items-center gap-1.5">Trade date <ArrowUpDown size={13} /></button></th><th scope="col" className="px-4 py-3 text-left font-medium">Instrument</th><th scope="col" className="px-4 py-3 text-left font-medium">Type</th><th scope="col" className="px-4 py-3 text-right font-medium">Quantity</th><th scope="col" className="px-4 py-3 text-right font-medium">Unit price</th><th scope="col" className="px-4 py-3 text-right font-medium">Total</th><th scope="col" className="px-4 py-3 text-right font-medium"><span className="sr-only">Actions</span></th>
        </tr></thead>
        <tbody>{transactions.map((transaction) => <tr key={transaction.id} className="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-muted)]"><th scope="row" className="px-4 py-3.5 text-left font-medium">{formatDate(transaction.tradeDate)}</th><td className="px-4 py-3.5 font-semibold">{transaction.instrument}</td><td className="px-4 py-3.5"><TypeBadge type={transaction.type} /></td><td className="tabular px-4 py-3.5 text-right">{formatQuantity(transaction.quantity)}</td><td className="tabular px-4 py-3.5 text-right">{formatCurrency(transaction.unitPrice, currency)}</td><td className="tabular px-4 py-3.5 text-right font-medium">{formatCurrency(transaction.quantity * transaction.unitPrice, currency)}</td><td className="px-4 py-3.5 text-right"><button aria-label={`Delete ${transaction.type.toLowerCase()} ${transaction.instrument} transaction from ${formatDate(transaction.tradeDate)}`} onClick={() => onDelete(transaction)} className="rounded-md p-1.5 text-[var(--color-ink-muted)] hover:bg-[var(--color-negative-soft)] hover:text-[var(--color-negative)]"><Trash2 size={16} strokeWidth={1.5} /></button></td></tr>)}</tbody>
      </table>
    </div>
    <div className="space-y-3 sm:hidden">{transactions.map((transaction) => <article key={transaction.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h4 className="font-semibold">{transaction.instrument}</h4><TypeBadge type={transaction.type} /></div><p className="mt-1 text-xs text-[var(--color-ink-muted)]">{formatDate(transaction.tradeDate)}</p></div><button aria-label={`Delete ${transaction.type.toLowerCase()} ${transaction.instrument} transaction from ${formatDate(transaction.tradeDate)}`} onClick={() => onDelete(transaction)} className="rounded-md p-2 text-[var(--color-ink-muted)] hover:bg-[var(--color-negative-soft)]"><Trash2 size={16} strokeWidth={1.5} /></button></div>
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--color-border)] pt-3"><div><p className="text-[10px] text-[var(--color-ink-muted)]">Quantity</p><p className="tabular mt-1 text-xs font-medium">{formatQuantity(transaction.quantity)}</p></div><div><p className="text-[10px] text-[var(--color-ink-muted)]">Unit price</p><p className="tabular mt-1 text-xs font-medium">{formatCurrency(transaction.unitPrice, currency)}</p></div><div className="text-right"><p className="text-[10px] text-[var(--color-ink-muted)]">Total</p><p className="tabular mt-1 text-xs font-semibold">{formatCurrency(transaction.quantity * transaction.unitPrice, currency)}</p></div></div>
    </article>)}</div>
  </>
}

function TypeBadge({ type }: { type: TransactionType }) {
  return <span className={`rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide ${type === 'BUY' ? 'bg-[var(--color-positive-soft)] text-[var(--color-positive)]' : 'bg-[var(--color-accent-light)] text-[var(--color-navy)]'}`}>{type}</span>
}

function TransactionDialog({
  open, onClose, form, onSubmit, currency, total, oversell, availableQuantity, isSubmitting, error,
}: {
  open: boolean
  onClose: () => void
  form: ReturnType<typeof useForm<TransactionValues>>
  onSubmit: (values: TransactionValues) => void
  currency: Currency
  total: number
  oversell: boolean
  availableQuantity: number
  isSubmitting: boolean
  error?: string
}) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = form
  const type = watch('type')
  return <Dialog open={open} onClose={onClose} title="Add transaction" description="Record a buy or sell. Holdings and average cost update automatically.">
    <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="instrument" className="mb-1.5 block text-sm font-medium">Instrument</label>
        <input id="instrument" list="known-instruments" placeholder="Choose or enter a symbol" className="field uppercase" {...register('instrument')} aria-invalid={Boolean(errors.instrument)} aria-describedby={errors.instrument ? 'instrument-error' : undefined} />
        <datalist id="known-instruments">{knownInstruments.map((item) => <option key={item} value={item} />)}</datalist>
        {errors.instrument && <p id="instrument-error" role="alert" className="mt-1.5 text-xs text-[var(--color-negative)]">{errors.instrument.message}</p>}
      </div>
      <fieldset><legend className="mb-1.5 text-sm font-medium">Transaction type</legend><div className="grid grid-cols-2 rounded-lg border border-[var(--color-border)] p-1">
        {(['BUY', 'SELL'] as const).map((value) => <button key={value} type="button" aria-pressed={type === value} onClick={() => setValue('type', value, { shouldValidate: true })} className={`min-h-9 rounded-md text-sm font-semibold transition ${type === value ? 'bg-[var(--color-navy)] text-white' : 'text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-muted)]'}`}>{value === 'BUY' ? 'Buy' : 'Sell'}</button>)}
      </div></fieldset>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Quantity" type="number" step="any" min="0" placeholder="0.00" {...register('quantity', { valueAsNumber: true })} error={errors.quantity?.message} />
        <Field label={`Unit price (${currency})`} type="number" step="any" min="0" placeholder="0.00" {...register('unitPrice', { valueAsNumber: true })} error={errors.unitPrice?.message} />
      </div>
      {type === 'SELL' && <p aria-live="polite" className={`rounded-lg px-3 py-2 text-xs ${oversell ? 'bg-[var(--color-negative-soft)] text-[var(--color-negative)]' : 'bg-[var(--color-surface-muted)] text-[var(--color-ink-muted)]'}`}>{oversell ? `You hold ${formatQuantity(availableQuantity)} ${watch('instrument') || 'units'}. Reduce the quantity or add a buy transaction first.` : `Available to sell: ${formatQuantity(availableQuantity)} ${watch('instrument') || 'units'}.`}</p>}
      <Field label="Trade date" type="date" {...register('tradeDate')} error={errors.tradeDate?.message} />
      <div className="rounded-lg bg-[var(--color-surface-muted)] px-3 py-3"><p className="text-xs text-[var(--color-ink-muted)]">Transaction total</p><p className="tabular mt-1 font-semibold">{formatCurrency(total, currency)}</p></div>
      {error && <p role="alert" className="text-sm text-[var(--color-negative)]">{error}</p>}
      <div className="flex justify-end gap-2 pt-1"><Button type="button" variant="secondary" onClick={onClose}>Cancel</Button><Button type="submit" disabled={isSubmitting || oversell}>{isSubmitting ? 'Saving transaction…' : 'Save transaction'}</Button></div>
    </form>
  </Dialog>
}

function DetailSkeleton() {
  return <div role="status" aria-label="Loading portfolio" className="space-y-6"><span className="sr-only">Loading portfolio</span><div className="h-20 animate-pulse rounded-xl bg-[var(--color-surface-muted)]" /><div className="grid gap-3 sm:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" />)}</div><div className="h-64 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" /><div className="h-80 animate-pulse rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]" /></div>
}
