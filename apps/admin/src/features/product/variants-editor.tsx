import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { RiAddLine, RiArrowRightSLine, RiCloseLine, RiDeleteBinLine } from '@remixicon/react'
import { FormField } from '@/components/common'
import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
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

/**
 * The options staff can add, for now: they pick one and only type its values.
 * A product saved earlier with another option name keeps it — it is shown, just
 * not offered for new ones.
 */
const OPTION_TYPES = [
  { name: 'Хэмжээ', placeholder: 'S, M, L эсвэл 24см, 28см' },
  { name: 'Өнгө', placeholder: 'Хар, Цагаан, Улаан' },
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
 * own price; its SKU is made by the API on save. After that, price history lives
 * on the variant's own page.
 */
export function VariantsEditor({ editor, errors, liveVariants }: VariantsEditorProps) {
  const { options, variants, removed, setOptions } = editor
  const hasOptions = usableOptions(options).length > 0
  const unusedTypes = OPTION_TYPES.filter(
    (type) => !options.some((option) => option.name === type.name),
  )

  function updateOption(index: number, patch: Partial<OptionDraft>) {
    setOptions(options.map((option, i) => (i === index ? { ...option, ...patch } : option)))
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="space-y-1">
          <h3 className="text-xs font-semibold tracking-wider uppercase">Сонголтууд</h3>
          <p className="text-sm text-muted-foreground">
            Хэмжээ эсвэл өнгөөр ялгаатай бол нэмээд утгуудаа бичнэ. Утгуудын хослол бүр тусдаа
            хувилбар болно.
          </p>
        </div>
        {options.map((option, index) => {
          const type = OPTION_TYPES.find((t) => t.name === option.name)
          const optionErrors = errors.options[index]
          return (
            <div
              key={option.key}
              className="grid gap-3 border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
            >
              <FormField
                label={option.name}
                hint="Бичээд Enter дарна."
                error={optionErrors?.values ?? optionErrors?.name}
              >
                <OptionValuesInput
                  id={option.key}
                  values={option.values}
                  onChange={(values) => updateOption(index, { values })}
                  placeholder={type?.placeholder ?? 'Утга бичих'}
                  invalid={Boolean(optionErrors?.values)}
                />
              </FormField>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="sm:mt-5"
                onClick={() => setOptions(options.filter((_, i) => i !== index))}
                aria-label={`«${option.name}» сонголтыг устгах`}
              >
                <RiDeleteBinLine />
              </Button>
            </div>
          )
        })}
        {unusedTypes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unusedTypes.map((type) => (
              <Button
                key={type.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setOptions([...options, { key: newOptionKey(), name: type.name, values: [] }])
                }
              >
                <RiAddLine data-icon="inline-start" />
                {type.name}
              </Button>
            ))}
          </div>
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
                <TableCell className="pt-4 text-sm text-muted-foreground tabular-nums">
                  {variant.sku || 'Хадгалахад үүснэ'}
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
