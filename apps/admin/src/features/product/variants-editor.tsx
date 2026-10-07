import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { RiAddLine, RiArrowRightSLine, RiCloseLine, RiDeleteBinLine } from '@remixicon/react'
import { MAX_PRODUCT_OPTIONS } from '@shop-38/contracts'
import { FormField } from '@/components/common'
import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { OptionValuesInput } from './option-values-input'
import type { ProductDetail, ProductVariant } from './product-api'
import {
  initialOptions,
  initialVariants,
  newOptionKey,
  type FormErrors,
} from './product-form'
import {
  regenerateVariants,
  usableOptions,
  variantLabel,
  type OptionDraft,
  type VariantDraft,
} from './variant-drafts'

const OPTION_PLACEHOLDERS = [
  { name: 'Хэмжээ', values: '24см, 28см' },
  { name: 'Өнгө', values: 'Хар, Улаан' },
  { name: 'Материал', values: 'Ган, Ширэм' },
]

/** Options, the variants they generate, and the rows the user removed by hand. */
export function useVariantsEditor(product: ProductDetail | null) {
  const [options, setOptionsState] = useState(() => initialOptions(product))
  const [variants, setVariants] = useState(() => initialVariants(product))
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set())

  function setOptions(next: OptionDraft[]) {
    setVariants(regenerateVariants(variants, options, next, removed))
    setOptionsState(next)
  }

  return {
    options,
    variants,
    removed,
    setOptions,
    setVariants,
    removeVariant(key: string) {
      setRemoved(new Set([...removed, key]))
      setVariants(variants.filter((variant) => variant.key !== key))
    },
    restoreVariants() {
      const none = new Set<string>()
      setRemoved(none)
      setVariants(regenerateVariants(variants, options, options, none))
    },
  }
}

export type VariantsEditorState = ReturnType<typeof useVariantsEditor>

type VariantsEditorProps = {
  editor: VariantsEditorState
  errors: FormErrors
  /** The saved variants as the server has them now, for their links to the variant pages. */
  liveVariants?: ProductVariant[]
}

/**
 * Options on top, the variants they generate below. Each variant row takes its
 * own SKU and price. After that, price history lives on the variant's own page.
 */
export function VariantsEditor({ editor, errors, liveVariants }: VariantsEditorProps) {
  const { options, variants, removed, setOptions } = editor
  const hasOptions = usableOptions(options).length > 0

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions(options.map((option, i) => (i === index ? { ...option, ...patch } : option)))
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wider uppercase">Сонголтууд</h3>
          <p className="text-sm text-muted-foreground">
            Хэмжээ, өнгө гэх мэтээр ялгаатай бол нэмнэ. Утгуудын хослол бүр тусдаа хувилбар болно.
          </p>
        </div>
        {options.map((option, index) => {
          const placeholder = OPTION_PLACEHOLDERS[index] ?? OPTION_PLACEHOLDERS[0]!
          const optionErrors = errors.options[index]
          return (
            <div
              key={option.key}
              className="grid gap-5 border p-4 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-start"
            >
              <FormField label="Сонголтын нэр" error={optionErrors?.name}>
                <Input
                  value={option.name}
                  onChange={(event) => updateOption(index, { name: event.target.value })}
                  placeholder={placeholder.name}
                  aria-invalid={Boolean(optionErrors?.name)}
                />
              </FormField>
              <FormField label="Утгууд" hint="Бичээд Enter дарна." error={optionErrors?.values}>
                <OptionValuesInput
                  id={option.key}
                  values={option.values}
                  onChange={(values) => updateOption(index, { values })}
                  placeholder={placeholder.values}
                  invalid={Boolean(optionErrors?.values)}
                />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="sm:mt-5"
                onClick={() => setOptions(options.filter((_, i) => i !== index))}
                aria-label={`«${option.name || 'Шинэ'}» сонголтыг устгах`}
              >
                <RiDeleteBinLine />
              </Button>
            </div>
          )
        })}
        {options.length < MAX_PRODUCT_OPTIONS && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setOptions([...options, { key: newOptionKey(), name: '', values: [] }])}
          >
            <RiAddLine data-icon="inline-start" />
            {options.length === 0 ? 'Сонголт нэмэх' : 'Өөр сонголт нэмэх'}
          </Button>
        )}
      </section>

      <section className="space-y-4">
        <h3 className="text-xs font-semibold tracking-wider uppercase">
          {hasOptions ? `Хувилбарууд · ${variants.length}` : 'Үнэ'}
        </h3>
        <VariantsTable
          variants={variants}
          onChange={editor.setVariants}
          onRemove={hasOptions ? editor.removeVariant : undefined}
          errors={errors.variants}
          liveVariants={liveVariants}
        />
        {errors.variantsGeneral && (
          <p className="text-xs text-destructive">{errors.variantsGeneral}</p>
        )}
        {removed.size > 0 && (
          <Button type="button" variant="link" size="sm" className="px-0" onClick={editor.restoreVariants}>
            Хассан хувилбаруудыг сэргээх ({removed.size})
          </Button>
        )}
      </section>
    </div>
  )
}

function VariantsTable({
  variants,
  onChange,
  onRemove,
  errors,
  liveVariants,
}: {
  variants: VariantDraft[]
  onChange: (variants: VariantDraft[]) => void
  /** Absent when the product has no options: its single variant cannot go. */
  onRemove?: (key: string) => void
  errors: FormErrors['variants']
  liveVariants?: ProductVariant[]
}) {
  const [bulkPrice, setBulkPrice] = useState<number | null>(null)
  const liveById = new Map((liveVariants ?? []).map((variant) => [variant.id, variant]))
  const hasOptions = variants.some((variant) => variant.optionValues.length > 0)

  function update(key: string, patch: Partial<VariantDraft>) {
    onChange(variants.map((variant) => (variant.key === key ? { ...variant, ...patch } : variant)))
  }

  return (
    <div className="space-y-4">
      {/* Most variants of a product cost the same; typing it forty times is how typos happen. */}
      {variants.length > 1 && (
        <div className="flex flex-wrap items-end gap-4 border border-dashed p-4">
          <FormField label="Бүх хувилбарын үнэ (₮)" className="w-48">
            <IntegerInput value={bulkPrice} onChange={setBulkPrice} placeholder="45 000" />
          </FormField>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={bulkPrice === null}
            onClick={() => onChange(variants.map((variant) => ({ ...variant, price: bulkPrice })))}
          >
            Бүгдэд оноох
          </Button>
        </div>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            {hasOptions && <TableHead>Хувилбар</TableHead>}
            <TableHead>SKU</TableHead>
            <TableHead className="w-36">Үнэ (₮)</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Үйлдэл</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((variant) => {
            const rowErrors = errors[variant.key] ?? {}
            const label = variantLabel(variant.optionValues)
            const live = variant.id ? liveById.get(variant.id) : undefined
            return (
              <TableRow key={variant.key} className="align-top">
                {hasOptions && (
                  <TableCell className="pt-4 font-medium whitespace-nowrap">
                    {live ? (
                      <Link
                        to="/variants/$variantId"
                        params={{ variantId: live.id }}
                        className="hover:underline"
                      >
                        {label}
                      </Link>
                    ) : (
                      label
                    )}
                    {!variant.id && liveVariants && (
                      <span className="ml-2 text-[0.625rem] font-semibold tracking-widest text-muted-foreground uppercase">
                        шинэ
                      </span>
                    )}
                  </TableCell>
                )}
                <TableCell className="min-w-32">
                  <Input
                    value={variant.sku}
                    onChange={(event) => update(variant.key, { sku: event.target.value })}
                    placeholder="Заавал биш"
                    aria-label={`${label} — SKU`}
                    aria-invalid={Boolean(rowErrors.sku)}
                  />
                  <CellError message={rowErrors.sku} />
                </TableCell>
                <TableCell>
                  <IntegerInput
                    value={variant.price}
                    onChange={(price) => update(variant.key, { price })}
                    placeholder="0"
                    aria-label={`${label} — үнэ`}
                    aria-invalid={Boolean(rowErrors.price)}
                  />
                  <CellError message={rowErrors.price} />
                </TableCell>
                <TableCell className="pt-3">
                  <div className="flex justify-end gap-1">
                    {live && !hasOptions && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link to="/variants/$variantId" params={{ variantId: live.id }} />}
                        aria-label="Үнийн дэлгэрэнгүй"
                      >
                        <RiArrowRightSLine />
                      </Button>
                    )}
                    {onRemove && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => onRemove(variant.key)}
                        aria-label={`${label} хувилбарыг хасах`}
                      >
                        <RiCloseLine />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

function CellError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1 text-xs whitespace-normal text-destructive">{message}</p>
}
