import { useState, type FormEvent } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { RiDeleteBinLine } from '@remixicon/react'
import {
  PRODUCT_STATUSES,
  productDetailsSchema,
  updateProductVariantsSchema,
  type UpdateProductVariantsInput,
} from '@shop-38/contracts'
import { Empty, ErrorBox, Loading, PageHeader, StatusPill } from '@/components/common'
import { ImageUploadField } from '@/components/image-upload-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailsFields } from '@/features/product/details-fields'
import {
  ProductConflictError,
  ProductNotFoundError,
  useProductQuery,
  useSaveProduct,
  useUpdateProduct,
  type ProductDetail,
} from '@/features/product/product-api'
import { ProductDeleteDialog } from '@/features/product/product-delete-dialog'
import {
  CONFLICT_MESSAGES,
  NO_ERRORS,
  changedDetails,
  detailsPayload,
  hasErrors,
  incompleteOptionErrors,
  initialDetails,
  initialOptions,
  initialVariants,
  mergeErrors,
  toFormErrors,
  variantsPayload,
  type FormErrors,
} from '@/features/product/product-form'
import { PRODUCT_STATUS_LABELS } from '@/features/product/product-status'
import { VariantsEditor, useVariantsEditor } from '@/features/product/variants-editor'

export const Route = createFileRoute('/products/$productId')({
  component: EditProduct,
})

function EditProduct() {
  const { productId } = Route.useParams()
  const navigate = useNavigate()
  const product = useProductQuery(productId)
  const setStatus = useUpdateProduct()
  const [isDeleting, setIsDeleting] = useState(false)
  // Bumped after each save, so that card starts over from what was saved. Keyed
  // on these rather than the query data: a background refetch must not throw
  // away edits in progress in the other card.
  const [detailsRevision, setDetailsRevision] = useState(0)
  const [variantsRevision, setVariantsRevision] = useState(0)

  if (product.isPending) return <Loading />
  if (product.error) {
    return product.error instanceof ProductNotFoundError ? (
      <Empty>Бараа олдсонгүй. Устгагдсан байж магадгүй.</Empty>
    ) : (
      <ErrorBox error={product.error} />
    )
  }

  const detail = product.data

  return (
    <>
      <PageHeader
        back={{ to: '/products', label: 'Бараа' }}
        title={
          <>
            {detail.name} <StatusPill status={detail.status} />
          </>
        }
        description={detail.slug}
        actions={
          <>
            {PRODUCT_STATUSES.filter((status) => status !== detail.status).map((status) => (
              <Button
                key={status}
                variant="outline"
                size="sm"
                disabled={setStatus.isPending}
                onClick={() => setStatus.mutate({ id: detail.id, input: { status } })}
              >
                {PRODUCT_STATUS_LABELS[status]} болгох
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              onClick={() => setIsDeleting(true)}
            >
              <RiDeleteBinLine data-icon="inline-start" />
              Устгах
            </Button>
          </>
        }
      >
        <ErrorBox error={setStatus.error} />
      </PageHeader>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <DetailsCard
          key={`details-${detailsRevision}`}
          product={detail}
          onSaved={() => setDetailsRevision((r) => r + 1)}
        />
        <ImageCard product={detail} />
      </div>

      <VariantsCard
        key={`variants-${variantsRevision}`}
        product={detail}
        onSaved={() => setVariantsRevision((r) => r + 1)}
      />

      <ProductDeleteDialog
        open={isDeleting}
        onOpenChange={setIsDeleting}
        product={detail}
        onDeleted={() => void navigate({ to: '/products' })}
      />
    </>
  )
}

function DetailsCard({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const [draft, setDraft] = useState(() => initialDetails(product))
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const save = useSaveProduct()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Status and image are saved by their own controls; send back what the
    // server has now, so this form never reverts a change made there.
    const parsed = productDetailsSchema.safeParse({
      ...detailsPayload(draft, true),
      status: product.status,
      imageFileId: product.imageFileId,
    })
    if (!parsed.success) {
      setErrors(toFormErrors(parsed.error, []))
      return
    }
    setErrors(NO_ERRORS)
    const patch = changedDetails(product, parsed.data)
    if (!patch) {
      toast('Өөрчлөлт алга.')
      return
    }
    try {
      await save.mutateAsync({ id: product.id, details: patch, variants: null })
      toast.success('Мэдээллийг хадгаллаа.')
      onSaved()
    } catch (error) {
      if (error instanceof ProductConflictError && (error.field === 'slug' || error.field === 'code')) {
        setErrors({ ...NO_ERRORS, details: { [error.field]: CONFLICT_MESSAGES[error.field] } })
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Мэдээлэл</CardTitle>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit} noValidate>
          <ErrorBox error={save.error instanceof ProductConflictError ? null : save.error} />
          <DetailsFields
            draft={draft}
            onChange={(patch) => setDraft({ ...draft, ...patch })}
            errors={errors.details}
            isExisting
          />
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Хадгалж байна…' : 'Хадгалах'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

/** Saved the moment an upload completes or the image is removed: there is nothing else to fill in. */
function ImageCard({ product }: { product: ProductDetail }) {
  const save = useSaveProduct()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Зураг</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ErrorBox error={save.error} />
        <ImageUploadField
          id="product-image"
          initialUrl={product.imageUrl}
          onChange={(imageFileId) =>
            save.mutate(
              { id: product.id, details: { imageFileId }, variants: null },
              { onSuccess: () => toast.success(imageFileId ? 'Зургийг хадгаллаа.' : 'Зургийг устгалаа.') },
            )
          }
          onUploadingChange={() => {}}
        />
      </CardContent>
    </Card>
  )
}

function VariantsCard({ product, onSaved }: { product: ProductDetail; onSaved: () => void }) {
  const editor = useVariantsEditor(product)
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const [initialJson] = useState(() =>
    JSON.stringify(variantsPayload(initialOptions(product), initialVariants(product))),
  )
  const save = useSaveProduct()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending) return

    const payload = variantsPayload(editor.options, editor.variants)
    const parsed = updateProductVariantsSchema.safeParse(payload)
    let next: FormErrors = { ...NO_ERRORS, options: incompleteOptionErrors(editor.options) }
    if (!parsed.success) next = mergeErrors(next, toFormErrors(parsed.error, editor.variants))
    if (editor.variants.length === 0) next.variantsGeneral = 'Дор хаяж нэг хувилбар үлдээнэ үү.'
    setErrors(next)
    if (hasErrors(next) || !parsed.success) return

    if (JSON.stringify(payload) === initialJson) {
      toast('Өөрчлөлт алга.')
      return
    }
    try {
      await save.mutateAsync({
        id: product.id,
        details: null,
        variants: parsed.data as UpdateProductVariantsInput,
      })
      toast.success('Хувилбаруудыг хадгаллаа.')
      onSaved()
    } catch (error) {
      if (error instanceof ProductConflictError && error.field === 'sku') {
        const draft = editor.variants.find((variant) => variant.sku.trim() === error.value)
        if (draft) setErrors({ ...NO_ERRORS, variants: { [draft.key]: { sku: CONFLICT_MESSAGES.sku } } })
      }
    }
  }

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>Хувилбарууд</CardTitle>
        <CardDescription>
          Үнийн түүх харахын тулд хувилбарын нэр дээр дарна. Үнэ өөрчилбөл хуучин
          үнэ түүхэнд үлдэнэ.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-6" onSubmit={submit} noValidate>
          <ErrorBox error={save.error instanceof ProductConflictError ? null : save.error} />
          <VariantsEditor editor={editor} errors={errors} liveVariants={product.variants} />
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Хадгалж байна…' : 'Хувилбар хадгалах'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
