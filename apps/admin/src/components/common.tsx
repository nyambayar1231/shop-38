import type { ReactNode } from 'react'
import { Link, type LinkProps } from '@tanstack/react-router'
import { RiArrowLeftLine, RiErrorWarningLine } from '@remixicon/react'
import { cn } from 'cn'
import type { ProductStatus } from '@shop-38/contracts'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { PRODUCT_STATUS_LABELS } from '@/features/product/product-status'
import { formatMoney } from '@/lib/money'

/** Whole tögrög, or a dash for a variant that has no price yet. */
export function MoneyText({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return <span className="tabular-nums">{formatMoney(value)}</span>
}

export type Tone = 'neutral' | 'warn' | 'ok' | 'dead'

const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-muted-foreground',
  warn: 'bg-amber-500',
  ok: 'bg-emerald-600',
  dead: 'bg-border',
}

/** A status as a coloured dot and a word. The preset's badge is text-only. */
export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-semibold tracking-widest whitespace-nowrap uppercase">
      <span className={cn('size-1.5 shrink-0 rounded-full', TONE_DOT[tone])} aria-hidden="true" />
      {children}
    </span>
  )
}

const PRODUCT_TONES: Record<ProductStatus, Tone> = {
  draft: 'neutral',
  active: 'ok',
  archived: 'dead',
}

export function StatusPill({ status }: { status: ProductStatus }) {
  return <Pill tone={PRODUCT_TONES[status]}>{PRODUCT_STATUS_LABELS[status]}</Pill>
}

/** Stock as a number, red at zero: the one figure staff scan a list for. */
export function StockText({ value }: { value: number }) {
  return <span className={cn('tabular-nums', value <= 0 && 'text-destructive')}>{value}</span>
}

export function Loading() {
  return (
    <div className="space-y-3" role="status" aria-label="Ачаалж байна">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)
  return (
    <Alert variant="destructive">
      <RiErrorWarningLine />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  )
}

/**
 * A label above its control. Wraps it in a <label>, so no ids are needed — pass
 * `htmlFor` only when the control is not a native input (a custom widget).
 */
export function FormField({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Label
      className={cn(
        'flex flex-col items-stretch gap-1.5 text-sm font-normal tracking-normal normal-case',
        className,
      )}
    >
      <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs font-normal text-destructive">{error}</span>
      ) : (
        hint && <span className="text-xs font-normal text-muted-foreground">{hint}</span>
      )}
    </Label>
  )
}

/** Fields side by side on a wide screen, stacked on a narrow one. */
export function FormRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
}

export function PageHeader({
  title,
  description,
  back,
  actions,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  back?: { label: string } & Pick<LinkProps, 'to' | 'params'>
  actions?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="mb-8 space-y-3">
      {back && (
        <Link
          to={back.to}
          params={back.params}
          className="inline-flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase hover:text-foreground"
        >
          <RiArrowLeftLine className="size-3.5" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h1 className="flex flex-wrap items-center gap-3 font-heading text-2xl font-semibold">
            {title}
          </h1>
          {description && <div className="text-sm text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  )
}

/** One figure with its caption, for the top of a detail page or the dashboard. */
export function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border p-4">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-heading text-2xl font-semibold tabular-nums">{children}</p>
    </div>
  )
}

/** Numeric table cells: right-aligned, digits in columns. */
export const num = 'text-right tabular-nums'
