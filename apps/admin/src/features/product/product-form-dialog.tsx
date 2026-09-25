import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { ChevronRight } from 'lucide-react'
import type { ZodError } from 'zod'
import {
  createProductSchema,
  type CreateProductInput,
  type UpdateProductInput,
} from '@shop-38/contracts'
import { ImageUploadField } from '@/components/image-upload-field'
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
import { useCategoriesQuery } from '@/features/category/category-api'
import { ProductConflictError, useCreateProduct, useUpdateProduct } from './product-api'
import type { Product } from './product-api'

type FormField = 'name' | 'slug' | 'code' | 'categoryId' | 'description'

type FieldErrors = Partial<Record<FormField, string>>

/** zod carries English messages, so each field's failures get Mongolian copy here. */
const FIELD_MESSAGES: Record<FormField, { invalid: string; tooLong: string }> = {
  name: {
    invalid: 'Барааны нэрийг оруулна уу.',
    tooLong: 'Нэр 200 тэмдэгтээс урт байж болохгүй.',
  },
  slug: {
    invalid: 'Слаг зөвхөн жижиг латин үсэг, тоо болон дан зураасаас бүрдэнэ (жишээ нь: iphone-15).',
    tooLong: 'Слаг 120 тэмдэгтээс урт байж болохгүй.',
  },
  code: {
    invalid: 'Код буруу байна.',
    tooLong: 'Код 64 тэмдэгтээс урт байж болохгүй.',
  },
  categoryId: {
    invalid: 'Ангилалаа сонгоно уу.',
    tooLong: 'Ангилалаа сонгоно уу.',
  },
  description: {
    invalid: 'Тайлбар буруу байна.',
    tooLong: 'Тайлбар 2000 тэмдэгтээс урт байж болохгүй.',
  },
}

const CONFLICT_MESSAGES: Record<'slug' | 'code', string> = {
  slug: 'Ийм слагтай бараа аль хэдийн бүртгэгдсэн байна.',
  code: 'Ийм кодтой бараа аль хэдийн бүртгэгдсэн байна.',
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
function changedFields(product: Product, next: CreateProductInput): UpdateProductInput {
  const patch: UpdateProductInput = {}
  if (next.name !== product.name) patch.name = next.name
  if (next.slug !== product.slug) patch.slug = next.slug
  if ((next.code ?? null) !== product.code) patch.code = next.code
  if (next.categoryId !== product.categoryId) patch.categoryId = next.categoryId
  if ((next.description ?? null) !== product.description) patch.description = next.description
  if ((next.imageFileId ?? null) !== product.imageFileId) patch.imageFileId = next.imageFileId
  return patch
}

type ProductFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The product to edit, or `null` to create a new one. */
  product: Product | null
}

export function ProductFormDialog({ open, onOpenChange, product }: ProductFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ProductForm
          key={product?.id ?? 'new'}
          product={product}
          onSaved={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function ProductForm({ product, onSaved }: { product: Product | null; onSaved: () => void }) {
  const fieldId = useId()
  const [name, setName] = useState(product?.name ?? '')
  const [slug, setSlug] = useState(product?.slug ?? '')
  const [code, setCode] = useState(product?.code ?? '')
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? '')
  const [description, setDescription] = useState(product?.description ?? '')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSeoOpen, setIsSeoOpen] = useState(false)
  const [imageFileId, setImageFileId] = useState<string | null>(product?.imageFileId ?? null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)

  const categories = useCategoriesQuery()
  const categoryOptions = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.name,
  }))

  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isPending = createProduct.isPending || updateProduct.isPending

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The submit button is disabled meanwhile, but Enter in a text input still submits.
    if (isUploadingImage) return

    const parsed = createProductSchema.safeParse({
      name: name.trim(),
      // On create the API derives the slug; an existing one is only ever sent back
      // as the user left it, never re-derived from a renamed product.
      ...(product ? { slug: slug.trim() } : {}),
      code: code.trim() || null,
      categoryId,
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
      if (product) {
        await updateProduct.mutateAsync({
          id: product.id,
          input: changedFields(product, parsed.data),
        })
        toast.success('Барааны мэдээллийг шинэчиллээ.')
      } else {
        await createProduct.mutateAsync(parsed.data)
        toast.success('Шинэ бараа нэмэгдлээ.')
      }
      onSaved()
    } catch (error) {
      if (error instanceof ProductConflictError) {
        // The create form has no slug input to pin a slug conflict to — and the API
        // de-duplicates derived slugs, so getting one there would be extraordinary.
        if (error.field === 'slug' && !product) {
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

  const hasNoCategories = categories.isSuccess && categoryOptions.length === 0

  return (
    <form onSubmit={handleSubmit} className="grid gap-6" noValidate>
      <DialogHeader>
        <DialogTitle>{product ? 'Бараа засах' : 'Шинэ бараа'}</DialogTitle>
        <DialogDescription>
          {product
            ? 'Барааны мэдээллийг шинэчилж хадгална уу.'
            : 'Дэлгүүрт зарах шинэ бараа бүртгэнэ.'}
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
              placeholder="iPhone 15"
              autoFocus
              aria-invalid={Boolean(errors.name)}
            />
          }
        />

        <div className="grid gap-1.5">
          <Label htmlFor={`${fieldId}-image`}>Зураг</Label>
          <ImageUploadField
            id={`${fieldId}-image`}
            initialUrl={product?.imageUrl ?? null}
            onChange={setImageFileId}
            onUploadingChange={setIsUploadingImage}
          />
        </div>

        <Field
          id={`${fieldId}-category`}
          label="Ангилал"
          error={errors.categoryId}
          hint={
            hasNoCategories
              ? 'Ангилал алга байна. Эхлээд «Ангилал» хэсэгт ангилал үүсгэнэ үү.'
              : categories.isError
                ? 'Ангилалын жагсаалтыг татаж чадсангүй.'
                : undefined
          }
          control={
            <Select
              value={categoryId || null}
              onValueChange={(value) => {
                if (value) setCategoryId(value)
              }}
              items={categoryOptions}
              disabled={!categories.isSuccess || hasNoCategories}
            >
              <SelectTrigger
                id={`${fieldId}-category`}
                className="w-full"
                aria-invalid={Boolean(errors.categoryId)}
              >
                <SelectValue placeholder={categories.isPending ? 'Ачаалж байна…' : 'Ангилал сонгох'} />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <Field
          id={`${fieldId}-code`}
          label="Код"
          hint="Заавал биш. Барааны дотоод код, давхардахгүй."
          error={errors.code}
          control={
            <Input
              id={`${fieldId}-code`}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="SKU-0001"
              aria-invalid={Boolean(errors.code)}
            />
          }
        />

        <Field
          id={`${fieldId}-description`}
          label="Тайлбар"
          hint="Заавал биш. Дээд тал нь 2000 тэмдэгт."
          error={errors.description}
          control={
            <Textarea
              id={`${fieldId}-description`}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Барааны тухай товч тайлбар"
              aria-invalid={Boolean(errors.description)}
            />
          }
        />

        {/*
          Only an existing product has a slug worth showing: it is a live URL, so
          it is never re-derived from the name and changing it is a deliberate act.
        */}
        {product && (
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
                    placeholder="iphone-15"
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
