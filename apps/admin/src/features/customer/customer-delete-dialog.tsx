import { toast } from 'sonner'
import { RiDeleteBinLine } from '@remixicon/react'
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
import { useDeleteCustomer, type CustomerDetail } from './customer-api'

type CustomerDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Pick<CustomerDetail, 'id' | 'name'>
  onDeleted?: () => void
}

/** Only a customer without orders can go; the API refuses the rest and the toast says why. */
export function CustomerDeleteDialog({ open, onOpenChange, customer, onDeleted }: CustomerDeleteDialogProps) {
  const deleteCustomer = useDeleteCustomer()

  async function handleDelete() {
    try {
      await deleteCustomer.mutateAsync(customer.id)
      toast.success(`"${customer.name}" хэрэглэгчийг устгалаа.`)
      onOpenChange(false)
      onDeleted?.()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Алдаа гарлаа.')
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <RiDeleteBinLine className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>Хэрэглэгчийг устгах уу?</AlertDialogTitle>
          <AlertDialogDescription>
            "{customer.name}" хэрэглэгчийг устгана. Энэ үйлдлийг буцаах боломжгүй.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteCustomer.isPending}>Болих</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteCustomer.isPending}
          >
            {deleteCustomer.isPending ? 'Устгаж байна…' : 'Устгах'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
