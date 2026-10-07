import { useState, type FormEvent } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  ErrorBox,
  FormField,
  Loading,
  MoneyText,
  PageHeader,
  Pill,
  Stat,
  StatusPill,
} from '@/components/common'
import { IntegerInput } from '@/components/integer-input'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
  useChangePrice,
  usePricesQuery,
  useVariantQuery,
} from '@/features/variant/variant-api'
import { formatDateTime } from '@/lib/date'

export const Route = createFileRoute('/variants/$variantId')({
  component: VariantPage,
})

/** One variant's price: what it is now, how to change it, and every change so far. */
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
      </div>

      <PriceCard variantId={detail.id} />
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
