import { useEffect, useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { RiAddLine, RiDeleteBinLine, RiUserAddLine } from '@remixicon/react'
import { toast } from 'sonner'
import { z } from 'zod'
import { MAX_ORDER_ITEMS, MAX_ORDER_QUANTITY } from '@shop-38/contracts'
import { ErrorBox, FormField, MoneyText, PageHeader, num } from '@/components/common'
import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useCustomersQuery } from '@/features/customer/customer-api'
import { CustomerFormDialog } from '@/features/customer/customer-form-dialog'
import {
  UnavailableVariantsError,
  UnknownCustomerError,
  useCreateOrder,
} from '@/features/order/order-api'
import { useProductQuery, useProductsQuery } from '@/features/product/product-api'
import { variantLabel } from '@/features/product/variant-drafts'
import { formatMoney } from '@/lib/money'

export const Route = createFileRoute('/orders/new')({
  // A customer's page links here with the customer already picked.
  validateSearch: z.object({ customerId: z.string().optional() }),
  component: NewOrder,
})

type LineDraft = {
  key: string
  productId: string
  variantId: string
  /** What the picked variant costs now, for the running total. The API prices the order itself. */
  unitPrice: number | null
  quantity: number | null
}

const newLine = (): LineDraft => ({
  key: crypto.randomUUID(),
  productId: '',
  variantId: '',
  unitPrice: null,
  quantity: 1,
})

type LineErrors = Record<string, string>

function NewOrder() {
  const navigate = useNavigate()
  const search = Route.useSearch()
  const customers = useCustomersQuery()
  const [customerId, setCustomerId] = useState(search.customerId ?? '')
  const [customerError, setCustomerError] = useState<string>()
  const [isCustomerFormOpen, setIsCustomerFormOpen] = useState(false)
  const [lines, setLines] = useState<LineDraft[]>(() => [newLine()])
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<LineErrors>({})
  const create = useCreateOrder()

  const update = (key: string, patch: Partial<LineDraft>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  const total = lines.reduce(
    (sum, line) => sum + (line.unitPrice ?? 0) * (line.quantity ?? 0),
    0,
  )

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (create.isPending) return

    const next: LineErrors = {}
    const seen = new Set<string>()
    for (const line of lines) {
      if (!line.variantId) next[line.key] = 'Бараа, хувилбараа сонгоно уу.'
      else if (seen.has(line.variantId)) next[line.key] = 'Энэ хувилбар өөр мөрөнд аль хэдийн байна. Тоог нь нэмнэ үү.'
      else if (!line.quantity || line.quantity > MAX_ORDER_QUANTITY) {
        next[line.key] = `Тоо 1–${MAX_ORDER_QUANTITY} байх ёстой.`
      }
      seen.add(line.variantId)
    }
    setErrors(next)
    const nextCustomerError = customerId ? undefined : 'Хэрэглэгчээ сонгоно уу.'
    setCustomerError(nextCustomerError)
    if (Object.keys(next).length > 0 || nextCustomerError) return

    try {
      const order = await create.mutateAsync({
        customerId,
        items: lines.map((line) => ({ variantId: line.variantId, quantity: line.quantity! })),
        note: note.trim() || null,
      })
      toast.success(`Захиалга №${order.number} үүслээ.`)
      void navigate({ to: '/orders/$orderId', params: { orderId: order.id } })
    } catch (error) {
      if (error instanceof UnknownCustomerError) {
        setCustomerId('')
        setCustomerError(error.message)
        return
      }
      if (error instanceof UnavailableVariantsError) {
        setErrors(
          Object.fromEntries(
            lines
              .filter((line) => error.variantIds.includes(line.variantId))
              .map((line) => [line.key, 'Энэ хувилбарыг одоо захиалах боломжгүй.']),
          ),
        )
      }
      // Anything else shows in the ErrorBox, from `create.error`.
    }
  }

  return (
    <>
      <PageHeader back={{ to: '/orders', label: 'Захиалга' }} title="Шинэ захиалга" />

      <form className="space-y-8" onSubmit={(event) => void submit(event)} noValidate>
        <Card>
          <CardHeader>
            <CardTitle>Хэрэглэгч</CardTitle>
            <CardDescription>Захиалга бүр нэг хэрэглэгчид хамаарна.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-4">
            <FormField label="Хэрэглэгч" error={customerError} className="min-w-64 flex-1">
              <NativeSelect
                className="w-full"
                value={customerId}
                disabled={customers.isPending}
                aria-invalid={Boolean(customerError) || undefined}
                onChange={(event) => {
                  setCustomerId(event.target.value)
                  setCustomerError(undefined)
                }}
              >
                <NativeSelectOption value="">
                  {customers.isPending ? 'Ачаалж байна…' : 'Сонгох…'}
                </NativeSelectOption>
                {(customers.data ?? []).map((customer) => (
                  <NativeSelectOption key={customer.id} value={customer.id}>
                    {customer.name} · {customer.phone}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <Button type="button" variant="outline" onClick={() => setIsCustomerFormOpen(true)}>
              <RiUserAddLine data-icon="inline-start" />
              Шинэ хэрэглэгч
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Бараа</CardTitle>
            <CardDescription>
              Үнийг захиалга үүсгэх үеийн одоогийн үнээр тооцож хадгална.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {lines.map((line) => (
              <LineEditor
                key={line.key}
                line={line}
                error={errors[line.key]}
                onChange={(patch) => update(line.key, patch)}
                onRemove={
                  lines.length > 1
                    ? () => setLines((current) => current.filter((l) => l.key !== line.key))
                    : undefined
                }
              />
            ))}
            <div className="flex flex-wrap items-center justify-between gap-4 border-t pt-4">
              <Button
                type="button"
                variant="outline"
                disabled={lines.length >= MAX_ORDER_ITEMS}
                onClick={() => setLines((current) => [...current, newLine()])}
              >
                <RiAddLine data-icon="inline-start" />
                Мөр нэмэх
              </Button>
              <p className="font-heading text-lg font-semibold">
                Нийт: <MoneyText value={total} />
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Тэмдэглэл</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              aria-label="Тэмдэглэл"
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Захиалагчийн нэр, утас, хүргэлтийн хаяг гэх мэт"
            />
          </CardContent>
        </Card>

        <ErrorBox
          error={
            create.error instanceof UnavailableVariantsError ||
            create.error instanceof UnknownCustomerError
              ? null
              : create.error
          }
        />
        {(Object.keys(errors).length > 0 || customerError) && (
          <p className="text-sm text-destructive">Улаанаар тэмдэглэсэн талбаруудыг засна уу.</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Үүсгэж байна…' : 'Захиалга үүсгэх'}
          </Button>
          <Button type="button" variant="outline" render={<Link to="/orders" />}>
            Болих
          </Button>
        </div>
      </form>

      <CustomerFormDialog
        open={isCustomerFormOpen}
        onOpenChange={setIsCustomerFormOpen}
        customer={null}
        onSaved={(customer) => {
          setCustomerId(customer.id)
          setCustomerError(undefined)
        }}
      />
    </>
  )
}

function LineEditor({
  line,
  error,
  onChange,
  onRemove,
}: {
  line: LineDraft
  error: string | undefined
  onChange: (patch: Partial<LineDraft>) => void
  onRemove: (() => void) | undefined
}) {
  const products = useProductsQuery()
  // Archived products cannot be ordered; the API would refuse them.
  const choices = (products.data ?? []).filter((product) => product.status !== 'archived')

  return (
    <div className="space-y-2">
      <div className="grid items-end gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_7rem_8rem_auto]">
        <FormField label="Бараа">
          <NativeSelect
            className="w-full"
            value={line.productId}
            aria-invalid={Boolean(error) || undefined}
            onChange={(event) =>
              onChange({ productId: event.target.value, variantId: '', unitPrice: null })
            }
          >
            <NativeSelectOption value="">Сонгох…</NativeSelectOption>
            {choices.map((product) => (
              <NativeSelectOption key={product.id} value={product.id}>
                {product.code ? `${product.name} (${product.code})` : product.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        {line.productId ? (
          <VariantPicker productId={line.productId} line={line} onChange={onChange} />
        ) : (
          <FormField label="Хувилбар">
            <NativeSelect className="w-full" disabled value="">
              <NativeSelectOption value="">—</NativeSelectOption>
            </NativeSelect>
          </FormField>
        )}
        <FormField label="Тоо">
          <IntegerInput value={line.quantity} onChange={(quantity) => onChange({ quantity })} />
        </FormField>
        <div className={`${num} pb-2 text-sm`}>
          <MoneyText
            value={line.unitPrice === null ? null : line.unitPrice * (line.quantity ?? 0)}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Мөр устгах"
          disabled={!onRemove}
          onClick={onRemove}
        >
          <RiDeleteBinLine />
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Its own component so the product's variants load only once a product is picked. */
function VariantPicker({
  productId,
  line,
  onChange,
}: {
  productId: string
  line: LineDraft
  onChange: (patch: Partial<LineDraft>) => void
}) {
  const product = useProductQuery(productId)
  // Without a price the API cannot fill in the line.
  const variants = (product.data?.variants ?? []).filter((variant) => variant.price !== null)
  const only = variants.length === 1 ? variants[0] : undefined

  // A product with a single variant has nothing to choose: take it.
  useEffect(() => {
    if (only && !line.variantId) onChange({ variantId: only.id, unitPrice: only.price })
  }, [only, line.variantId, onChange])

  return (
    <FormField label="Хувилбар">
      <NativeSelect
        className="w-full"
        value={line.variantId}
        disabled={product.isPending || variants.length === 0}
        onChange={(event) => {
          const variant = variants.find((v) => v.id === event.target.value)
          onChange({ variantId: event.target.value, unitPrice: variant?.price ?? null })
        }}
      >
        <NativeSelectOption value="">
          {product.isPending ? 'Ачаалж байна…' : variants.length === 0 ? 'Үнэтэй хувилбар алга' : 'Сонгох…'}
        </NativeSelectOption>
        {variants.map((variant) => (
          <NativeSelectOption key={variant.id} value={variant.id}>
            {variantLabel(variant.optionValues)}
            {variant.sku ? ` · ${variant.sku}` : ''}
            {` · ${formatMoney(variant.price!)}`}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </FormField>
  )
}
