import { useState, type KeyboardEvent } from 'react'
import { RiCloseLine } from '@remixicon/react'
import { cn } from 'cn'

type OptionValuesInputProps = {
  id: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  invalid?: boolean
}

/**
 * Values as chips: type one and press Enter (or a comma) to add it, Backspace in
 * the empty field to take the last one back. A duplicate is ignored rather than
 * reported — it was clearly meant to be there already.
 */
export function OptionValuesInput({ id, values, onChange, placeholder, invalid }: OptionValuesInputProps) {
  const [draft, setDraft] = useState('')

  function commit() {
    const value = draft.trim()
    setDraft('')
    if (!value) return
    const taken = values.some((existing) => existing.toLocaleLowerCase() === value.toLocaleLowerCase())
    if (!taken) onChange([...values, value])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter would otherwise submit the whole product form.
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && draft === '' && values.length > 0) {
      event.preventDefault()
      setDraft(values.at(-1)!)
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div
      className={cn(
        'flex min-h-10 flex-wrap items-center gap-1.5 border-b border-input py-1.5 focus-within:border-ring',
        invalid && 'border-destructive',
      )}
    >
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 bg-secondary py-0.5 pr-1 pl-2 text-sm text-secondary-foreground"
        >
          {value}
          <button
            type="button"
            className="inline-flex size-5 items-center justify-center text-muted-foreground hover:text-foreground"
            onClick={() => onChange(values.filter((existing) => existing !== value))}
            aria-label={`«${value}» утгыг хасах`}
          >
            <RiCloseLine className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(event) => setDraft(event.target.value.replace(/[\p{Cc}]/gu, ''))}
        onKeyDown={handleKeyDown}
        onBlur={commit}
        placeholder={values.length === 0 ? placeholder : 'Утга нэмэх…'}
        aria-invalid={invalid}
        className="min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground md:text-sm"
      />
    </div>
  )
}
