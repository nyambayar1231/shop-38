import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react'
import { Empty, ErrorBox, Loading, PageHeader, Pill } from '@/components/common'
import { Thumbnail } from '@/components/thumbnail'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCategoriesQuery } from '@/features/category/category-api'
import type { Category } from '@/features/category/category-api'
import { CategoryDeleteDialog } from '@/features/category/category-delete-dialog'
import { CategoryFormDialog } from '@/features/category/category-form-dialog'
import { CATEGORY_STATUS_LABELS } from '@/features/category/category-status'

export const Route = createFileRoute('/categories')({
  component: Categories,
})

function Categories() {
  const categories = useCategoriesQuery()
  const [editing, setEditing] = useState<Category | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [deleting, setDeleting] = useState<Category | null>(null)

  function openCreate() {
    setEditing(null)
    setIsFormOpen(true)
  }

  function openEdit(category: Category) {
    setEditing(category)
    setIsFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Ангилал"
        description="Дэлгүүрт бараа ангилан харуулах хэсгүүд."
        actions={
          <Button onClick={openCreate}>
            <RiAddLine data-icon="inline-start" />
            Шинэ ангилал
          </Button>
        }
      />

      <ErrorBox error={categories.error} />
      {categories.isPending ? (
        <Loading />
      ) : !categories.data || categories.data.length === 0 ? (
        <Empty>Ангилал алга. «Шинэ ангилал» дарж эхлээрэй.</Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0">
                <span className="sr-only">Зураг</span>
              </TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Slug</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="w-full whitespace-normal">Тайлбар</TableHead>
              <TableHead className="w-0">
                <span className="sr-only">Үйлдэл</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.data.map((category) => (
              <TableRow key={category.id}>
                <TableCell>
                  <Thumbnail src={category.imageUrl} />
                </TableCell>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell className="text-muted-foreground">{category.slug}</TableCell>
                <TableCell>
                  <Pill tone={category.status === 'active' ? 'ok' : 'dead'}>
                    {CATEGORY_STATUS_LABELS[category.status]}
                  </Pill>
                </TableCell>
                <TableCell className="max-w-0 truncate whitespace-normal text-muted-foreground">
                  {category.description || '—'}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => openEdit(category)}
                      aria-label={`${category.name} ангилалыг засах`}
                    >
                      <RiPencilLine />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setDeleting(category)}
                      aria-label={`${category.name} ангилалыг устгах`}
                    >
                      <RiDeleteBinLine />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CategoryFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} category={editing} />
      <CategoryDeleteDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null)
        }}
        category={deleting}
      />
    </>
  )
}
