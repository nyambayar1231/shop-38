import { createFileRoute } from '@tanstack/react-router'
import { ErrorBox, Loading, PageHeader, Stat } from '@/components/common'
import { useCategoriesQuery } from '@/features/category/category-api'
import { useProductsQuery } from '@/features/product/product-api'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const products = useProductsQuery()
  const categories = useCategoriesQuery()

  const list = products.data ?? []
  const variantCount = list.reduce((sum, product) => sum + product.variantCount, 0)

  return (
    <>
      <PageHeader title="Нүүр" description="Дэлгүүрийн өнөөдрийн байдал." />

      <ErrorBox error={products.error ?? categories.error} />
      {products.isPending || categories.isPending ? (
        <Loading />
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Бараа">{list.length}</Stat>
            <Stat label="Хувилбар">{variantCount}</Stat>
            <Stat label="Ангилал">{categories.data?.length ?? 0}</Stat>
          </div>
        </>
      )}
    </>
  )
}
