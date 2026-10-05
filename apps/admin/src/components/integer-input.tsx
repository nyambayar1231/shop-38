import { useState, type ComponentProps } from 'react'
import { cn } from 'cn'
import { Input } from '@/components/ui/input'

const grouped = new Intl.NumberFormat('mn-MN', { maximumFractionDigits: 0 })

type IntegerInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onChange: (value: number | null) => void
  /** Shown after the number, e.g. `₮`. */
  suffix?: string
}

/**
 * A whole, non-negative number. Grouped (`45 000`) when idle and plain while
 * focused, so the caret never jumps as separators appear. Anything but digits is
 * dropped as it is typed, and an empty field is `null`, not `0`.
 */
export function IntegerInput({ value, onChange, suffix, className, onFocus, onBlur, ...props }: IntegerInputProps) {
  const [isFocused, setIsFocused] = useState(false)
  const text = value === null ? '' : isFocused ? String(value) : grouped.format(value)

  return (
    <div className="relative">
      <Input
        {...props}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={text}
        className={cn('tabular-nums', suffix && 'pr-5', className)}
        onFocus={(event) => {
          setIsFocused(true)
          onFocus?.(event)
        }}
        onBlur={(event) => {
          setIsFocused(false)
          onBlur?.(event)
        }}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 12)
          onChange(digits ? Number(digits) : null)
        }}
      />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center text-sm text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  )
}
