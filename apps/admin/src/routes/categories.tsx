import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export const Route = createFileRoute('/categories')({
  component: Categories,
})

function useCategoriesQuery() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const res = await apiClient.categories.$get()
      if (!res.ok) throw new Error('Ангилалын жагсаалтыг татаж чадсангүй')
      return res.json()
    },
  })
}

function Categories() {
  const { data: categories, isPending, isError } = useCategoriesQuery()

  if (isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // eslint-disable-next-line react/no-array-index-key
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <Card className="flex flex-1 items-center justify-center text-destructive">
        Ангилалын жагсаалтыг татаж чадсангүй.
      </Card>
    )
  }

  if (categories.length === 0) {
    return (
      <Card className="flex flex-1 items-center justify-center text-muted-foreground">
        Ангилал алга байна.
      </Card>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => (
        <Card key={category.id}>
          <CardHeader>
            <CardTitle>{category.name}</CardTitle>
            <CardDescription>{category.slug}</CardDescription>
          </CardHeader>
          {category.description && (
            <CardContent className="text-sm text-muted-foreground">
              {category.description}
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  )
}
