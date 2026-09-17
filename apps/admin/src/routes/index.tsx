import { createFileRoute } from '@tanstack/react-router'
import { Package, Receipt, Shapes, Users } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

const stats = [
  { label: 'Ангилал', value: '4', icon: Shapes },
  { label: 'Бараа', value: '0', icon: Package },
  { label: 'Захиалга', value: '0', icon: Receipt },
  { label: 'Харилцагч', value: '0', icon: Users },
]

function Dashboard() {
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
              <div>
                <CardDescription>{stat.label}</CardDescription>
                <CardTitle className="text-2xl">{stat.value}</CardTitle>
              </div>
              <stat.icon className="size-5 text-muted-foreground" />
            </CardHeader>
          </Card>
        ))}
      </div>
      <Card className="flex flex-1 items-center justify-center text-muted-foreground">
        Удахгүй нэмэгдэнэ.
      </Card>
    </>
  )
}
