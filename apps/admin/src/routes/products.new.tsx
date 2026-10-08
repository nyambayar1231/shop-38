import { useState, type FormEvent } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { createProductSchema, type CreateProductInput } from '@shop-38/contracts'
import { ErrorBox, PageHeader } from '@/components/common'
import { ImageUploadField } from '@/components/image-upload-field'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DetailsFields } from '@/features/product/details-fields'
import { ProductConflictError, useCreateProduct } from '@/features/product/product-api'
import {
  CONFLICT_MESSAGES,
  NO_ERRORS,
  detailsPayload,
  hasErrors,
  incompleteOptionErrors,
  initialDetails,
  mergeErrors,
  toFormErrors,
  variantsPayload,
  type FormErrors,
} from '@/features/product/product-form'
import { VariantsEditor, useVariantsEditor } from '@/features/product/variants-editor'

export const Route = createFileRoute('/products/new')({
  component: NewProduct,
})

/** The whole product in one form and one request: it is created with its variants or not at all. */
function NewProduct() {
  const navigate = useNavigate()
  const [details, setDetails] = useState(() => initialDetails(null))
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const editor = useVariantsEditor(null)
  const [errors, setErrors] = useState<FormErrors>(NO_ERRORS)
  const create = useCreateProduct()

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // The submit button is disabled meanwhile, but Enter in a text input still submits.
    if (isUploadingImage || create.isPending) return

    const parsed = createProductSchema.safeParse({
      ...detailsPayload(details, false),
      ...variantsPayload(editor.options, editor.variants),
    })
    let next: FormErrors = { ...NO_ERRORS, options: incompleteOptionErrors(editor.options) }
    if (!parsed.success) next = mergeErrors(next, toFormErrors(parsed.error, editor.variants))
    setErrors(next)
    if (hasErrors(next) || !parsed.success) return

    try {
      const product = await create.mutateAsync(parsed.data as CreateProductInput)
      toast.success('Шинэ бараа нэмэгдлээ.')
      void navigate({ to: '/products/$productId', params: { productId: product.id } })
    } catch (error) {
      if (error instanceof ProductConflictError) {
        if (error.field === 'code') {
          setErrors({ ...NO_ERRORS, details: { code: CONFLICT_MESSAGES.code } })
          return
        }
        if (error.field === 'sku') {
          const draft = editor.variants.find((variant) => variant.sku.trim() === error.value)
          setErrors(
            draft
              ? { ...NO_ERRORS, variants: { [draft.key]: { sku: CONFLICT_MESSAGES.sku } } }
              : { ...NO_ERRORS, variantsGeneral: CONFLICT_MESSAGES.generatedSku },
          )
          return
        }
      }
      // Anything else shows in the ErrorBox, from `create.error`.
    }
  }

  return (
    <>
      <PageHeader back={{ to: '/products', label: 'Бараа' }} title="Шинэ бараа" />

      <form className="space-y-8" onSubmit={submit} noValidate>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Мэдээлэл</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailsFields
                draft={details}
                onChange={(patch) => setDetails({ ...details, ...patch })}
                errors={errors.details}
                isExisting={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Зураг</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUploadField
                id="product-image"
                initialUrl={null}
                onChange={(imageFileId) => setDetails((current) => ({ ...current, imageFileId }))}
                onUploadingChange={setIsUploadingImage}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Хувилбарууд</CardTitle>
            <CardDescription>
              Хувилбар бүрийн үнэ болон одоо байгаа тоо ширхэгийг оруулна уу.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VariantsEditor editor={editor} errors={errors} />
          </CardContent>
        </Card>

        <ErrorBox error={create.error instanceof ProductConflictError ? null : create.error} />
        {hasErrors(errors) && (
          <p className="text-sm text-destructive">Улаанаар тэмдэглэсэн талбаруудыг засна уу.</p>
        )}
        <div className="flex gap-2">
          <Button type="submit" disabled={create.isPending || isUploadingImage}>
            {create.isPending
              ? 'Үүсгэж байна…'
              : isUploadingImage
                ? 'Зураг хуулж байна…'
                : 'Үүсгэх'}
          </Button>
          <Button type="button" variant="outline" render={<Link to="/products" />}>
            Болих
          </Button>
        </div>
      </form>
    </>
  )
}
