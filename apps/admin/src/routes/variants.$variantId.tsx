import { useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import type { ManualStockReason } from '@shop-38/contracts'
import {
  Empty,
  ErrorBox,
  FormField,
  Loading,
  MoneyText,
  PageHeader,
  Pill,
  Stat,
  StatusPill,
  StockText,
  num,
} from '@/components/common'
import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { variantLabel } from '@/features/product/variant-drafts'
import {
  InsufficientStockError,
  useChangePrice,
  useCreateStockMovement,
  usePricesQuery,
  useStockMovementsQuery,
  useVariantQuery,
  type VariantDetail,
} from '@/features/variant/variant-api'
import {
  MANUAL_STOCK_REASON_OPTIONS,
  STOCK_REASON_LABELS,
  STOCK_REASON_MODE,
} from '@/features/variant/stock-reason'
import { formatDateTime } from '@/lib/date'

export const Route = createFileRoute('/variants/$variantId')({
  component: VariantPage,
})

/** One variant's price and stock: what they are now, how to change them, and every change so far. */
function VariantPage() {
  const { variantId } = Route.useParams()
  const variant = useVariantQuery(variantId)

  if (variant.isPending) return <Loading />
  if (variant.error) return <ErrorBox error={variant.error} />

  const detail = variant.data

  return (
    <>
      <PageHeader
        back={{
          to: '/products/$productId',
          params: { productId: detail.product.id },
          label: detail.product.name,
        }}
        title={
          <>
            {variantLabel(detail.optionValues)} <StatusPill status={detail.product.status} />
          </>
        }
        description={detail.sku ? `SKU: ${detail.sku}` : 'SKU оноогоогүй'}
      />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Одоогийн үнэ">
          <MoneyText value={detail.price} />
        </Stat>
        <Stat label="Байгаа">
          <StockText value={detail.stock} />
        </Stat>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <PriceCard variantId={detail.id} />
        <StockCard variant={detail} />
      </div>
    </>
  )
}

function PriceCard({ variantId }: { variantId: string }) {
  const prices = usePricesQuery(variantId)
  const changePrice = useChangePrice()
  const [amount, setAmount] = useState<number | null>(null)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (amount === null) return
    await changePrice.mutateAsync({ id: variantId, input: { price: amount } })
    toast.success('Үнийг өөрчиллөө.')
    setAmount(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Үнэ</CardTitle>
        <CardDescription>
          Үнэ өөрчлөхөд одоогийн мөрийг хааж шинэ мөр нэмнэ — хуучин үнэ түүхэнд үлдэнэ.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="flex flex-wrap items-end gap-4" onSubmit={(event) => void submit(event).catch(() => {})}>
          <FormField label="Шинэ үнэ (₮)" className="min-w-40 flex-1">
            <IntegerInput value={amount} onChange={setAmount} placeholder="45 000" />
          </FormField>
          <Button type="submit" disabled={changePrice.isPending || amount === null}>
            {changePrice.isPending ? 'Хадгалж байна…' : 'Үнэ өөрчлөх'}
          </Button>
        </form>
        <ErrorBox error={changePrice.error ?? prices.error} />

        {prices.data && prices.data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Үнэ</TableHead>
                <TableHead>Эхэлсэн</TableHead>
                <TableHead>Дууссан</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prices.data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <MoneyText value={row.amount} />
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDateTime(row.validFrom)}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.validTo ? formatDateTime(row.validTo) : <Pill tone="ok">Одоогийн</Pill>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * The person says what happened — "12 arrived", "2 broke", "the count says 7" —
 * and the form works out the signed change the ledger stores.
 */
function StockCard({ variant }: { variant: VariantDetail }) {
  const movements = useStockMovementsQuery(variant.id)
  const move = useCreateStockMovement()
  const [reason, setReason] = useState<ManualStockReason>('receipt')
  const [amount, setAmount] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [problem, setProblem] = useState<string | null>(null)

  const mode = STOCK_REASON_MODE[reason]
  const delta =
    amount === null ? null : mode === 'add' ? amount : mode === 'remove' ? -amount : amount - variant.stock
  const result = delta === null ? null : variant.stock + delta

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (delta === null || (mode !== 'set' && amount === 0)) {
      setProblem('Тоо ширхэгийг оруулна уу.')
      return
    }
    if (delta === 0) {
      setProblem('Одоогийн үлдэгдэлтэй ижил байна — өөрчлөх зүйл алга.')
      return
    }
    if (result !== null && result < 0) {
      setProblem(`Үлдэгдэл хасах болохгүй. Одоо ${variant.stock} ширхэг байна.`)
      return
    }
    setProblem(null)
    try {
      const { stock } = await move.mutateAsync({
        id: variant.id,
        input: { quantity: delta, reason, note: note.trim() || null },
      })
      toast.success(`Бүртгэлээ. Одоо ${stock} ширхэг байна.`)
      setAmount(null)
      setNote('')
    } catch (error) {
      // Someone else moved stock since this page loaded.
      if (error instanceof InsufficientStockError) {
        setProblem(`Үлдэгдэл хүрэлцэхгүй. Одоо ${error.stock} ширхэг байна.`)
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Нөөцийн хөдөлгөөн</CardTitle>
        <CardDescription>
          Орлого, буцаалт нэмнэ; гэмтэл, алдагдал хасна; тооллого үлдэгдлийг тоолсон тоогоор тогтооно.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form className="space-y-6" onSubmit={submit} noValidate>
          <ErrorBox
            error={problem ?? (move.error instanceof InsufficientStockError ? null : move.error)}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Шалтгаан">
              <NativeSelect
                className="w-full"
                value={reason}
                onChange={(event) => setReason(event.target.value as ManualStockReason)}
              >
                {MANUAL_STOCK_REASON_OPTIONS.map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </FormField>
            <FormField
              label={mode === 'add' ? 'Нэмэх тоо' : mode === 'remove' ? 'Хасах тоо' : 'Тоолсон үлдэгдэл'}
              hint={
                <>
                  Одоо {variant.stock} →{' '}
                  <span className="font-semibold text-foreground tabular-nums">
                    {result ?? variant.stock}
                  </span>{' '}
                  ширхэг
                </>
              }
            >
              <IntegerInput value={amount} onChange={setAmount} placeholder="0" />
            </FormField>
          </div>
          <FormField label="Тэмдэглэл">
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Нийлүүлэгч, падаан, эсвэл шалтгаан"
              maxLength={300}
            />
          </FormField>
          <Button type="submit" disabled={move.isPending}>
            {move.isPending ? 'Бүртгэж байна…' : 'Хөдөлгөөн бүртгэх'}
          </Button>
        </form>

        <ErrorBox error={movements.error} />
        {movements.data &&
          (movements.data.length === 0 ? (
            <Empty>Хөдөлгөөн бүртгэгдээгүй байна.</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Огноо</TableHead>
                  <TableHead>Шалтгаан</TableHead>
                  <TableHead className={num}>Тоо</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.data.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="tabular-nums">{formatDateTime(movement.occurredAt)}</TableCell>
                    <TableCell className="whitespace-normal">
                      {STOCK_REASON_LABELS[movement.reason]}
                      {movement.note && (
                        <div className="text-xs text-muted-foreground">{movement.note}</div>
                      )}
                    </TableCell>
                    <TableCell className={`${num} font-semibold ${movement.quantity < 0 ? 'text-destructive' : ''}`}>
                      {movement.quantity > 0 ? `+${movement.quantity}` : movement.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ))}
      </CardContent>
    </Card>
  )
}
