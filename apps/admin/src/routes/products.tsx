import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Thumbnail } from '@/components/thumbnail'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useProductsQuery } from '@/features/product/product-api'
import type { Product } from '@/features/product/product-api'
import { ProductDeleteDialog } from '@/features/product/product-delete-dialog'
import { ProductFormDialog } from '@/features/product/product-form-dialog'

export const Route = createFileRoute('/products')({
  component: Products,
})

function Products() {
  const { data: products, isPending, isError } = useProductsQuery()
  const [editing, setEditing] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Product | null>(null)

  function openCreate() {
    setEditing(null)
    setIsFormOpen(true)
  }

  function openEdit(product: Product) {
    setEditing(product)
    setIsFormOpen(true)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">Барааг бүртгэх, засах, устгах.</p>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Шинэ бараа
        </Button>
      </div>

      <ProductList
        products={products}
        isPending={isPending}
        isError={isError}
        onEdit={openEdit}
        onDelete={setDeleting}
      />

      <ProductFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} product={editing} />
      <ProductDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        product={deleting}
      />
    </>
  )
}

function ProductList({
  products,
  isPending,
  isError,
  onEdit,
  onDelete,
}: {
  products: Product[] | undefined
  isPending: boolean
  isError: boolean
  onEdit: (product: Product) => void
  onDelete: (product: Product) => void
}) {
  if (isPending) {
    return (
      <Card className="flex flex-1 flex-col gap-3 p-4">
        {Array.from({ length: 4 }).map((_, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={index} className="h-10" />
        ))}
      </Card>
    )
  }

  if (isError) {
    return (
      <Card className="flex flex-1 items-center justify-center text-destructive">
        Барааны жагсаалтыг татаж чадсангүй.
      </Card>
    )
  }

  if (!products || products.length === 0) {
    return (
      <Card className="flex flex-1 items-center justify-center text-muted-foreground">
        Бараа алга байна. «Шинэ бараа» дарж эхлээрэй.
      </Card>
    )
  }

  return (
    <Card className="flex-1 overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-0">
              <span className="sr-only">Зураг</span>
            </TableHead>
            <TableHead>Нэр</TableHead>
            <TableHead>Код</TableHead>
            <TableHead>Ангилал</TableHead>
            <TableHead>Слаг</TableHead>
            <TableHead className="w-full whitespace-normal">Тайлбар</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Үйлдэл</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <Thumbnail src={product.imageUrl} />
              </TableCell>
              <TableCell className="font-medium">{product.name}</TableCell>
              <TableCell className="text-muted-foreground">{product.code || '—'}</TableCell>
              <TableCell>{product.category.name}</TableCell>
              <TableCell className="text-muted-foreground">{product.slug}</TableCell>
              <TableCell className="max-w-0 truncate whitespace-normal text-muted-foreground">
                {product.description || '—'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" />}
                    aria-label={`${product.name} барааны үйлдэл`}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(product)}>
                      <Pencil />
                      Засах
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(product)}>
                      <Trash2 />
                      Устгах
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}
