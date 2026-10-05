import { createFileRoute, Link } from '@tanstack/react-router'
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
  const totalStock = list.reduce((sum, product) => sum + product.totalStock, 0)
  const outOfStock = list.filter((product) => product.status === 'active' && product.totalStock <= 0)

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
            <Stat label="Нийт нөөц">{totalStock}</Stat>
            <Stat label="Ангилал">{categories.data?.length ?? 0}</Stat>
          </div>

          {outOfStock.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Дууссан бараа
              </h2>
              <ul className="divide-y border-y">
                {outOfStock.map((product) => (
                  <li key={product.id} className="py-2.5 text-sm">
                    <Link
                      to="/products/$productId"
                      params={{ productId: product.id }}
                      className="font-medium hover:underline"
                    >
                      {product.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </>
  )
}
