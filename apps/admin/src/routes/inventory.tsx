import { useDeferredValue, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RiSearchLine } from '@remixicon/react'
import { Empty, ErrorBox, Loading, MoneyText, PageHeader, StockText, num } from '@/components/common'
import { Thumbnail } from '@/components/thumbnail'
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
import { variantLabel } from '@/features/product/variant-drafts'
import { useVariantsQuery } from '@/features/variant/variant-api'

export const Route = createFileRoute('/inventory')({
  component: Inventory,
})

/** Every variant's stock in one list: where a shop checks what is running low. */
function Inventory() {
  const [search, setSearch] = useState('')
  // Keeps typing responsive: the query follows the input a render behind.
  const deferredSearch = useDeferredValue(search.trim())
  const variants = useVariantsQuery(deferredSearch)

  return (
    <>
      <PageHeader
        title="Нөөц"
        description="Хувилбар бүрийн үлдэгдэл. Орлого, гэмтэл, тооллогыг хувилбарын хуудсаас бүртгэнэ."
      />

      <div className="mb-4">
        <div className="relative max-w-md">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-6"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Бараа эсвэл SKU-аар хайх"
            aria-label="Бараа эсвэл SKU-аар хайх"
          />
        </div>
      </div>

      <ErrorBox error={variants.error} />
      {variants.isPending ? (
        <Loading />
      ) : !variants.data || variants.data.length === 0 ? (
        <Empty>{deferredSearch ? 'Хайлтад тохирох зүйл олдсонгүй.' : 'Бараа алга.'}</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">
                <span className="sr-only">Зураг</span>
              </TableHead>
              <TableHead>Бараа</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className={num}>Үнэ</TableHead>
              <TableHead className={num}>Байгаа</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Үйлдэл</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.data.map((variant) => (
              <TableRow key={variant.id}>
                <TableCell>
                  <Thumbnail src={variant.imageUrl} />
                </TableCell>
                <TableCell>
                  <Link
                    to="/variants/$variantId"
                    params={{ variantId: variant.id }}
                    className="font-medium hover:underline"
                  >
                    {variant.product.name}
                  </Link>
                  {variant.optionValues.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {variantLabel(variant.optionValues)}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{variant.sku || '—'}</TableCell>
                <TableCell className={num}>
                  <MoneyText value={variant.price} />
                </TableCell>
                <TableCell className={`${num} font-semibold`}>
                  <StockText value={variant.stock} />
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="xs"
                    render={<Link to="/variants/$variantId" params={{ variantId: variant.id }} />}
                  >
                    Тохируулах
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
