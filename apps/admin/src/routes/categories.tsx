import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
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
import { useCategoriesQuery } from '@/features/category/category-api'
import type { Category } from '@/features/category/category-api'
import { CategoryDeleteDialog } from '@/features/category/category-delete-dialog'
import { CategoryFormDialog } from '@/features/category/category-form-dialog'
import { CATEGORY_STATUS_LABELS } from '@/features/category/category-status'

export const Route = createFileRoute('/categories')({
  component: Categories,
})

function Categories() {
  const { data: categories, isPending, isError } = useCategoriesQuery()
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
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Барааны ангилалыг үүсгэх, засах, устгах.
        </p>
        <Button onClick={openCreate}>
          <Plus data-icon="inline-start" />
          Шинэ ангилал
        </Button>
      </div>

      <CategoryList
        categories={categories}
        isPending={isPending}
        isError={isError}
        onEdit={openEdit}
        onDelete={setDeleting}
      />

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

function CategoryList({
  categories,
  isPending,
  isError,
  onEdit,
  onDelete,
}: {
  categories: Category[] | undefined
  isPending: boolean
  isError: boolean
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
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
        Ангилалын жагсаалтыг татаж чадсангүй.
      </Card>
    )
  }

  if (!categories || categories.length === 0) {
    return (
      <Card className="flex flex-1 items-center justify-center text-muted-foreground">
        Ангилал алга байна. «Шинэ ангилал» дарж эхлээрэй.
      </Card>
    )
  }

  return (
    <Card className="flex-1 overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Нэр</TableHead>
            <TableHead>Слаг</TableHead>
            <TableHead>Төлөв</TableHead>
            <TableHead className="w-full whitespace-normal">Тайлбар</TableHead>
            <TableHead className="w-0">
              <span className="sr-only">Үйлдэл</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium">{category.name}</TableCell>
              <TableCell className="text-muted-foreground">{category.slug}</TableCell>
              <TableCell>
                <Badge variant={category.status === 'active' ? 'default' : 'secondary'}>
                  {CATEGORY_STATUS_LABELS[category.status]}
                </Badge>
              </TableCell>
              <TableCell className="max-w-0 truncate whitespace-normal text-muted-foreground">
                {category.description || '—'}
              </TableCell>
              <TableCell>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={<Button variant="ghost" size="icon-sm" />}
                    aria-label={`${category.name} ангилалын үйлдэл`}
                  >
                    <MoreHorizontal />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(category)}>
                      <Pencil />
                      Засах
                    </DropdownMenuItem>
                    <DropdownMenuItem variant="destructive" onClick={() => onDelete(category)}>
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
