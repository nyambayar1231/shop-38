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
import { useDeleteProduct } from './product-api'
import type { Product } from './product-api'

type ProductDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function ProductDeleteDialog({ open, onOpenChange, product }: ProductDeleteDialogProps) {
  const deleteProduct = useDeleteProduct()

  async function handleDelete() {
    if (!product) return
    try {
      await deleteProduct.mutateAsync(product.id)
      toast.success(`"${product.name}" барааг устгалаа.`)
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
          <AlertDialogTitle>Барааг устгах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            {product ? `"${product.name}" барааг устгана. ` : ''}
            Энэ үйлдлийг буцаах боломжгүй.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteProduct.isPending}>Болих</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteProduct.isPending}
          >
            {deleteProduct.isPending ? 'Устгаж байна…' : 'Устгах'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
