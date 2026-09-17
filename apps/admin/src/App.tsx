import { Package, Receipt, Shapes, Users } from 'lucide-react'
import { AppSidebar } from '@/components/app-sidebar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'

const stats = [
  { label: 'Ангилал', value: '4', icon: Shapes },
  { label: 'Бараа', value: '0', icon: Package },
  { label: 'Захиалга', value: '0', icon: Receipt },
  { label: 'Харилцагч', value: '0', icon: Users },
]

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 my-6" />
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>Нүүр</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4">
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
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default App
