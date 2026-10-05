import { PRODUCT_STATUSES, type ProductStatus } from '@shop-38/contracts'
import { FormField } from '@/components/common'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { useCategoriesQuery } from '@/features/category/category-api'
import type { DetailErrors, DetailsDraft } from './product-form'
import { PRODUCT_STATUS_HINTS, PRODUCT_STATUS_LABELS } from './product-status'

type DetailsFieldsProps = {
  draft: DetailsDraft
  onChange: (patch: Partial<DetailsDraft>) => void
  errors: DetailErrors
  /** An existing product shows its slug; its status is changed from the page header instead. */
  isExisting: boolean
}

export function DetailsFields({ draft, onChange, errors, isExisting }: DetailsFieldsProps) {
  const categories = useCategoriesQuery()
  const hasNoCategories = categories.isSuccess && categories.data.length === 0

  return (
    <div className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <FormField label="Нэр" error={errors.name} className="sm:col-span-2">
          <Input
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            placeholder="Хайруулын таваг"
            autoFocus={!isExisting}
            aria-invalid={Boolean(errors.name)}
          />
        </FormField>
        <FormField
          label="Ангилал"
          error={errors.categoryId}
          hint={
            hasNoCategories
              ? 'Ангилал алга. Эхлээд «Ангилал» хэсэгт үүсгэнэ үү.'
              : categories.isError
                ? 'Ангилалын жагсаалтыг татаж чадсангүй.'
                : undefined
          }
        >
          <NativeSelect
            className="w-full"
            value={draft.categoryId}
            onChange={(event) => onChange({ categoryId: event.target.value })}
            disabled={!categories.isSuccess || hasNoCategories}
            aria-invalid={Boolean(errors.categoryId)}
          >
            <NativeSelectOption value="" disabled>
              {categories.isPending ? 'Ачаалж байна…' : 'Сонгох'}
            </NativeSelectOption>
            {(categories.data ?? []).map((category) => (
              <NativeSelectOption key={category.id} value={category.id}>
                {category.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </FormField>
        {isExisting ? (
          <FormField
            label="Slug"
            error={errors.slug}
            hint="Хаяг дахь нэр. Өөрчилбөл хуучин холбоос ажиллахаа болино."
          >
            <Input
              value={draft.slug}
              onChange={(event) => onChange({ slug: event.target.value })}
              aria-invalid={Boolean(errors.slug)}
            />
          </FormField>
        ) : (
          <FormField label="Төлөв" hint={PRODUCT_STATUS_HINTS[draft.status]}>
            <NativeSelect
              className="w-full"
              value={draft.status}
              onChange={(event) => onChange({ status: event.target.value as ProductStatus })}
            >
              {PRODUCT_STATUSES.map((status) => (
                <NativeSelectOption key={status} value={status}>
                  {PRODUCT_STATUS_LABELS[status]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
        )}
        <FormField label="Барааны код" error={errors.code} hint="Заавал биш. Давхардахгүй.">
          <Input
            value={draft.code}
            onChange={(event) => onChange({ code: event.target.value })}
            placeholder="PAN-001"
            aria-invalid={Boolean(errors.code)}
          />
        </FormField>
      </div>
      <FormField label="Тайлбар" error={errors.description} hint="Заавал биш. 2000 тэмдэгт хүртэл.">
        <Textarea
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          placeholder="Барааны тухай товч тайлбар"
          rows={4}
          aria-invalid={Boolean(errors.description)}
        />
      </FormField>
    </div>
  )
}
