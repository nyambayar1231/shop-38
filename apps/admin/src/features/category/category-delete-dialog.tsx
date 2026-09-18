import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useDeleteCategory } from './category-api'
import type { Category } from './category-api'

type CategoryDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
}

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
}: CategoryDeleteDialogProps) {
  const deleteCategory = useDeleteCategory()

  async function handleDelete() {
    if (!category) return
    try {
      await deleteCategory.mutateAsync(category.id)
      toast.success(`"${category.name}" ангилалыг устгалаа.`)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Алдаа гарлаа.')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Trash2 className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Ангилалыг устгах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            {category ? `"${category.name}" ангилалыг устгана. ` : ''}
            Энэ үйлдлийг буцаах боломжгүй.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCategory.isPending}>Болих</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCategory.isPending}
          >
            {deleteCategory.isPending ? 'Устгаж байна…' : 'Устгах'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
