import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import type { ZodError } from 'zod'
import {
  createCustomerSchema,
  type CreateCustomerInput,
  type UpdateCustomerInput,
} from '@shop-38/contracts'
import { FormField } from '@/components/common'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  CustomerConflictError,
  useCreateCustomer,
  useUpdateCustomer,
  type CustomerDetail,
} from './customer-api'

type Field = 'name' | 'phone' | 'email' | 'address' | 'note'

type FieldErrors = Partial<Record<Field, string>>

/** zod carries English messages, so each field's failures get Mongolian copy here. */
const FIELD_MESSAGES: Record<Field, { invalid: string; tooLong: string }> = {
  name: { invalid: 'Нэрийг оруулна уу.', tooLong: 'Нэр 150 тэмдэгтээс урт байж болохгүй.' },
  phone: {
    invalid: 'Утасны дугаар 6–15 оронтой тоо байна (жишээ нь: 99112233).',
    tooLong: 'Утасны дугаар хэт урт байна.',
  },
  email: { invalid: 'Имэйл хаяг буруу байна.', tooLong: 'Имэйл хаяг хэт урт байна.' },
  address: { invalid: 'Хаяг буруу байна.', tooLong: 'Хаяг 500 тэмдэгтээс урт байж болохгүй.' },
  note: { invalid: 'Тэмдэглэл буруу байна.', tooLong: 'Тэмдэглэл 1000 тэмдэгтээс урт байж болохгүй.' },
}

const CONFLICT_MESSAGES: Record<'phone' | 'email', string> = {
  phone: 'Энэ утасны дугаартай хэрэглэгч аль хэдийн бүртгэгдсэн байна.',
  email: 'Энэ имэйлтэй хэрэглэгч аль хэдийн бүртгэгдсэн байна.',
}

function toFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as Field
    const messages = FIELD_MESSAGES[field]
    // First issue per field wins — showing one reason at a time is enough.
    if (!messages || errors[field]) continue
    errors[field] = issue.code === 'too_big' ? messages.tooLong : messages.invalid
  }
  return errors
}

/** Only the fields the user actually changed, so an untouched edit is a no-op PATCH. */
function changedFields(customer: CustomerDetail, next: CreateCustomerInput): UpdateCustomerInput {
  const patch: UpdateCustomerInput = {}
  if (next.name !== customer.name) patch.name = next.name
  if (next.phone !== customer.phone) patch.phone = next.phone
  if ((next.email ?? null) !== customer.email) patch.email = next.email
  if ((next.address ?? null) !== customer.address) patch.address = next.address
  if ((next.note ?? null) !== customer.note) patch.note = next.note
  return patch
}

type CustomerFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The customer to edit, or `null` to create a new one. */
  customer: CustomerDetail | null
  /** After a successful save, with the saved customer — the order form selects a new one. */
  onSaved?: (customer: CustomerDetail) => void
}

export function CustomerFormDialog({ open, onOpenChange, customer, onSaved }: CustomerFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CustomerForm
          key={customer?.id ?? 'new'}
          customer={customer}
          onSaved={(saved) => {
            onOpenChange(false)
            onSaved?.(saved)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}

function CustomerForm({
  customer,
  onSaved,
}: {
  customer: CustomerDetail | null
  onSaved: (customer: CustomerDetail) => void
}) {
  const [name, setName] = useState(customer?.name ?? '')
  const [phone, setPhone] = useState(customer?.phone ?? '')
  const [email, setEmail] = useState(customer?.email ?? '')
  const [address, setAddress] = useState(customer?.address ?? '')
  const [note, setNote] = useState(customer?.note ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})

  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isPending = createCustomer.isPending || updateCustomer.isPending

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Stops the submit reaching a form this dialog was opened from, e.g. the order form.
    event.stopPropagation()
    event.preventDefault()
    if (isPending) return

    const parsed = createCustomerSchema.safeParse({
      name,
      phone,
      email: email.trim() || null,
      address: address.trim() || null,
      note: note.trim() || null,
    })
    if (!parsed.success) {
      setErrors(toFieldErrors(parsed.error))
      return
    }
    setErrors({})

    try {
      const saved = customer
        ? await updateCustomer.mutateAsync({
            id: customer.id,
            input: changedFields(customer, parsed.data),
          })
        : await createCustomer.mutateAsync(parsed.data)
      toast.success(customer ? 'Хэрэглэгчийн мэдээллийг шинэчиллээ.' : 'Шинэ хэрэглэгч нэмэгдлээ.')
      onSaved(saved)
    } catch (error) {
      if (error instanceof CustomerConflictError) {
        setErrors({ [error.field]: CONFLICT_MESSAGES[error.field] })
        return
      }
      toast.error(error instanceof Error ? error.message : 'Алдаа гарлаа.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
      <DialogHeader>
        <DialogTitle>{customer ? 'Хэрэглэгч засах' : 'Шинэ хэрэглэгч'}</DialogTitle>
        <DialogDescription>
          {customer
            ? 'Хэрэглэгчийн мэдээллийг шинэчилж хадгална уу.'
            : 'Захиалга өгөх хэрэглэгчийг бүртгэнэ.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <FormField label="Нэр" error={errors.name}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Бат-Эрдэнэ"
            autoFocus
            aria-invalid={Boolean(errors.name)}
          />
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Утас" error={errors.phone}>
            <Input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="99112233"
              aria-invalid={Boolean(errors.phone)}
            />
          </FormField>
          <FormField label="Имэйл" hint="Заавал биш." error={errors.email}>
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="bat@example.com"
              aria-invalid={Boolean(errors.email)}
            />
          </FormField>
        </div>
        <FormField label="Хаяг" hint="Заавал биш. Хүргэлтийн хаяг." error={errors.address}>
          <Textarea
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            placeholder="Дүүрэг, хороо, байр, тоот"
            aria-invalid={Boolean(errors.address)}
          />
        </FormField>
        <FormField label="Тэмдэглэл" hint="Заавал биш." error={errors.note}>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            aria-invalid={Boolean(errors.note)}
          />
        </FormField>
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
          Болих
        </DialogClose>
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Хадгалж байна…' : 'Хадгалах'}
        </Button>
      </DialogFooter>
    </form>
  )
}
