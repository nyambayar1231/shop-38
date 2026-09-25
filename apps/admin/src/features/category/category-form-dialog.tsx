import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ChevronRight } from 'lucide-react'
import type { ZodError } from 'zod'
import {
  createCategorySchema,
  type CategoryStatus,
  type CreateCategoryInput,
  type UpdateCategoryInput,
} from '@shop-38/contracts'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { CategoryConflictError, useCreateCategory, useUpdateCategory } from './category-api'
import type { Category } from './category-api'
import { CategoryImageField } from './category-image-field'
import { CATEGORY_STATUS_OPTIONS } from './category-status'

type FormField = 'name' | 'slug' | 'status' | 'description'

type FieldErrors = Partial<Record<FormField, string>>

/** zod carries English messages, so each field's failures get Mongolian copy here. */
const FIELD_MESSAGES: Record<FormField, { invalid: string; tooLong: string }> = {
  name: {
    invalid: 'Ангилалын нэрийг оруулна уу.',
    tooLong: 'Нэр 150 тэмдэгтээс урт байж болохгүй.',
  },
  slug: {
    invalid: 'Слаг зөвхөн жижиг латин үсэг, тоо болон дан зураасаас бүрдэнэ (жишээ нь: gar-utas).',
    tooLong: 'Слаг 120 тэмдэгтээс урт байж болохгүй.',
  },
  status: {
    invalid: 'Төлөвөө сонгоно уу.',
    tooLong: 'Төлөвөө сонгоно уу.',
  },
  description: {
    invalid: 'Тайлбар буруу байна.',
    tooLong: 'Тайлбар 300 тэмдэгтээс урт байж болохгүй.',
  },
}

const CONFLICT_MESSAGES: Record<'name' | 'slug', string> = {
  name: 'Ийм нэртэй ангилал аль хэдийн бүртгэгдсэн байна.',
  slug: 'Ийм слагтай ангилал аль хэдийн бүртгэгдсэн байна.',
}

function toFieldErrors(error: ZodError): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0] as FormField
    const messages = FIELD_MESSAGES[field]
    // First issue per field wins — showing one reason at a time is enough.
    if (!messages || errors[field]) continue
    errors[field] = issue.code === 'too_big' ? messages.tooLong : messages.invalid
  }
  return errors
}

/** Only the fields the user actually changed, so an untouched edit is a no-op PATCH. */
function changedFields(category: Category, next: CreateCategoryInput): UpdateCategoryInput {
  const patch: UpdateCategoryInput = {}
  if (next.name !== category.name) patch.name = next.name
  if (next.slug !== category.slug) patch.slug = next.slug
  if (next.status !== category.status) patch.status = next.status
  if ((next.description ?? null) !== category.description) patch.description = next.description
  if ((next.imageFileId ?? null) !== category.imageFileId) patch.imageFileId = next.imageFileId
  return patch
}

type CategoryFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The category to edit, or `null` to create a new one. */
  category: Category | null
}

export function CategoryFormDialog({ open, onOpenChange, category }: CategoryFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <CategoryForm
          key={category?.id ?? 'new'}
          category={category}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function CategoryForm({
  category,
  onSaved,
}: {
  category: Category | null
  onSaved: () => void
}) {
  const fieldId = useId()
  const [name, setName] = useState(category?.name ?? '')
  const [slug, setSlug] = useState(category?.slug ?? '')
  const [status, setStatus] = useState<CategoryStatus>(category?.status ?? 'active')
  const [description, setDescription] = useState(category?.description ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSeoOpen, setIsSeoOpen] = useState(false)
  const [imageFileId, setImageFileId] = useState<string | null>(category?.imageFileId ?? null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const isPending = createCategory.isPending || updateCategory.isPending

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The submit button is disabled meanwhile, but Enter in a text input still submits.
    if (isUploadingImage) return

    const parsed = createCategorySchema.safeParse({
      name: name.trim(),
      // On create the API derives the slug; an existing one is only ever sent back
      // as the user left it, never re-derived from a renamed category.
      ...(category ? { slug: slug.trim() } : {}),
      status,
      description: description.trim() || null,
      imageFileId,
    })
    if (!parsed.success) {
      const fieldErrors = toFieldErrors(parsed.error)
      if (fieldErrors.slug) setIsSeoOpen(true)
      setErrors(fieldErrors)
      return
    }
    setErrors({})

    try {
      if (category) {
        await updateCategory.mutateAsync({
          id: category.id,
          input: changedFields(category, parsed.data),
        })
        toast.success('Ангилалын мэдээллийг шинэчиллээ.')
      } else {
        await createCategory.mutateAsync(parsed.data)
        toast.success('Шинэ ангилал нэмэгдлээ.')
      }
      onSaved()
    } catch (error) {
      if (error instanceof CategoryConflictError) {
        // The create form has no slug input to pin a slug conflict to — and the API
        // de-duplicates derived slugs, so getting one there would be extraordinary.
        if (error.field === 'slug' && !category) {
          toast.error(CONFLICT_MESSAGES.slug)
          return
        }
        if (error.field === 'slug') setIsSeoOpen(true)
        setErrors({ [error.field]: CONFLICT_MESSAGES[error.field] })
        return
      }
      toast.error(error instanceof Error ? error.message : 'Алдаа гарлаа.')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
      <DialogHeader>
        <DialogTitle>{category ? 'Ангилал засах' : 'Шинэ ангилал'}</DialogTitle>
        <DialogDescription>
          {category
            ? 'Ангилалын мэдээллийг шинэчилж хадгална уу.'
            : 'Барааг ангилахад ашиглах шинэ ангилал үүсгэнэ.'}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <Field
          id={`${fieldId}-name`}
          label="Нэр"
          error={errors.name}
          control={
            <Input
              id={`${fieldId}-name`}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Гар утас"
              autoFocus
              aria-invalid={Boolean(errors.name)}
            />
          }
        />

        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-image`}>Зураг</Label>
          <CategoryImageField
            id={`${fieldId}-image`}
            initialUrl={category?.imageUrl ?? null}
            onChange={setImageFileId}
            onUploadingChange={setIsUploadingImage}
          />
        </div>

        <Field
          id={`${fieldId}-status`}
          label="Төлөв"
          error={errors.status}
          control={
            <Select
              value={status}
              onValueChange={(value) => {
                if (value) setStatus(value)
              }}
              items={CATEGORY_STATUS_OPTIONS}
            >
              <SelectTrigger id={`${fieldId}-status`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <Field
          id={`${fieldId}-description`}
          label="Тайлбар"
          hint="Заавал биш. Дээд тал нь 300 тэмдэгт."
          error={errors.description}
          control={
            <Textarea
              id={`${fieldId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Ангилалын тухай товч тайлбар"
              aria-invalid={Boolean(errors.description)}
            />
          }
        />

        {/*
          Only an existing category has a slug worth showing: it is a live URL, so
          it is never re-derived from the name and changing it is a deliberate act.
        */}
        {category && (
          <Collapsible open={isSeoOpen} onOpenChange={setIsSeoOpen}>
            <CollapsibleTrigger
              render={<Button type="button" variant="ghost" size="sm" className="-ml-4" />}
            >
              <ChevronRight
                data-icon="inline-start"
                className="transition-transform group-data-[panel-open]/button:rotate-90"
              />
              Хайлтын тохиргоо
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-4">
              <Field
                id={`${fieldId}-slug`}
                label="Слаг"
                hint="Хаяг дахь нэр. Өөрчилбөл хуучин холбоосууд ажиллахаа болино."
                error={errors.slug}
                control={
                  <Input
                    id={`${fieldId}-slug`}
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="gar-utas"
                    aria-invalid={Boolean(errors.slug)}
                  />
                }
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" disabled={isPending} />}>
          Болих
        </DialogClose>
        <Button type="submit" disabled={isPending || isUploadingImage}>
          {isPending ? 'Хадгалж байна…' : isUploadingImage ? 'Зураг хуулж байна…' : 'Хадгалах'}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  control,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  control: ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {control}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}
