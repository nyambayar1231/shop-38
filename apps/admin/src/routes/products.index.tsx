import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RiAddLine, RiSearchLine } from '@remixicon/react'
import { PRODUCT_STATUSES, type ProductStatus } from '@shop-38/contracts'
import {
  Empty,
  ErrorBox,
  Loading,
  PageHeader,
  StatusPill,
  num,
} from '@/components/common'
import { Thumbnail } from '@/components/thumbnail'
import { Button } from '@/components/ui/button'
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
import { useCategoriesQuery } from '@/features/category/category-api'
import { useProductsQuery } from '@/features/product/product-api'
import { PRODUCT_STATUS_LABELS } from '@/features/product/product-status'
import { formatPriceRange } from '@/lib/money'

export const Route = createFileRoute('/products/')({
  component: Products,
})

/**
 * Filtered in the browser: the API returns every product at once, and a shop
 * this size is better served by instant filtering than by a round trip per keystroke.
 */
function Products() {
  const products = useProductsQuery()
  const categories = useCategoriesQuery()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<ProductStatus | ''>('')
  const [categoryId, setCategoryId] = useState('')

  const needle = q.trim().toLocaleLowerCase()
  const visible = (products.data ?? []).filter(
    (product) =>
      (!status || product.status === status) &&
      (!categoryId || product.categoryId === categoryId) &&
      (!needle ||
        product.name.toLocaleLowerCase().includes(needle) ||
        product.slug.includes(needle) ||
        product.code?.toLocaleLowerCase().includes(needle)),
  )

  return (
    <>
      <PageHeader
        title="Бараа"
        description="Бараа бүр нэг буюу хэд хэдэн хувилбартай; үнэ хувилбар дээр байна."
        actions={
          <Button render={<Link to="/products/new" />}>
            <RiAddLine data-icon="inline-start" />
            Шинэ бараа
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="relative min-w-60 flex-1">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-6"
            placeholder="Нэр, код, slug-аар хайх"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        <NativeSelect
          aria-label="Төлөв"
          value={status}
          onChange={(event) => setStatus(event.target.value as ProductStatus | '')}
        >
          <NativeSelectOption value="">Бүх төлөв</NativeSelectOption>
          {PRODUCT_STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {PRODUCT_STATUS_LABELS[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label="Ангилал"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          <NativeSelectOption value="">Бүх ангилал</NativeSelectOption>
          {(categories.data ?? []).map((category) => (
            <NativeSelectOption key={category.id} value={category.id}>
              {category.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <ErrorBox error={products.error} />
      {products.isPending ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty>
          {products.data?.length ? 'Тохирох бараа алга.' : 'Бараа алга. «Шинэ бараа» дарж эхлээрэй.'}
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">
                <span className="sr-only">Зураг</span>
              </TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Ангилал</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className={num}>Хувилбар</TableHead>
              <TableHead className={num}>Үнэ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((product) => (
              <TableRow key={product.id}>
                <TableCell>
                  <Thumbnail src={product.imageUrl} />
                </TableCell>
                <TableCell className="font-medium">
                  <Link
                    to="/products/$productId"
                    params={{ productId: product.id }}
                    className="hover:underline"
                  >
                    {product.name}
                  </Link>
                  {product.code && (
                    <div className="text-xs font-normal text-muted-foreground">{product.code}</div>
                  )}
                </TableCell>
                <TableCell>{product.category.name}</TableCell>
                <TableCell>
                  <StatusPill status={product.status} />
                </TableCell>
                <TableCell className={num}>{product.variantCount}</TableCell>
                <TableCell className={num}>
                  {formatPriceRange(product.minPrice, product.maxPrice)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
