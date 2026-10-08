import { useState, type ReactNode } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { RiAddLine, RiDeleteBinLine, RiPencilLine } from '@remixicon/react'
import { Empty, ErrorBox, Loading, MoneyText, PageHeader, Pill, num } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCustomerQuery } from '@/features/customer/customer-api'
import { CustomerDeleteDialog } from '@/features/customer/customer-delete-dialog'
import { CustomerFormDialog } from '@/features/customer/customer-form-dialog'
import { useOrdersQuery } from '@/features/order/order-api'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/features/order/order-status'
import { formatDateTime } from '@/lib/date'

export const Route = createFileRoute('/customers/$customerId')({
  component: CustomerPage,
})

function CustomerPage() {
  const { customerId } = Route.useParams()
  const navigate = useNavigate()
  const customer = useCustomerQuery(customerId)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  if (customer.isPending) return <Loading />
  if (customer.error) return <ErrorBox error={customer.error} />

  const detail = customer.data

  return (
    <>
      <PageHeader
        back={{ to: '/customers', label: 'Хэрэглэгч' }}
        title={detail.name}
        description={`Бүртгэсэн: ${formatDateTime(detail.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => setIsDeleteOpen(true)}>
              <RiDeleteBinLine data-icon="inline-start" />
              Устгах
            </Button>
            <Button variant="outline" onClick={() => setIsEditOpen(true)}>
              <RiPencilLine data-icon="inline-start" />
              Засах
            </Button>
            <Button
              render={<Link to="/orders/new" search={{ customerId: detail.id }} />}
            >
              <RiAddLine data-icon="inline-start" />
              Захиалга үүсгэх
            </Button>
          </>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Мэдээлэл</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 text-sm">
              <Detail label="Утас">
                <span className="tabular-nums">{detail.phone}</span>
              </Detail>
              <Detail label="Имэйл">{detail.email ?? '—'}</Detail>
              <Detail label="Хаяг">{detail.address ?? '—'}</Detail>
              {detail.note && <Detail label="Тэмдэглэл">{detail.note}</Detail>}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Захиалгууд</CardTitle>
          </CardHeader>
          <CardContent>
            <CustomerOrders customerId={detail.id} />
          </CardContent>
        </Card>
      </div>

      <CustomerFormDialog open={isEditOpen} onOpenChange={setIsEditOpen} customer={detail} />
      <CustomerDeleteDialog
        open={isDeleteOpen}
        onOpenChange={setIsDeleteOpen}
        customer={detail}
        onDeleted={() => void navigate({ to: '/customers' })}
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="whitespace-pre-line">{children}</dd>
    </div>
  )
}

function CustomerOrders({ customerId }: { customerId: string }) {
  const orders = useOrdersQuery({ customerId })

  if (orders.isPending) return <Loading />
  if (orders.error) return <ErrorBox error={orders.error} />
  if (orders.data.length === 0) return <Empty>Энэ хэрэглэгч захиалга өгөөгүй байна.</Empty>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Дугаар</TableHead>
          <TableHead>Огноо</TableHead>
          <TableHead>Төлөв</TableHead>
          <TableHead className={num}>Нийт дүн</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {orders.data.map((order) => (
          <TableRow key={order.id}>
            <TableCell className="font-medium tabular-nums">
              <Link to="/orders/$orderId" params={{ orderId: order.id }} className="hover:underline">
                №{order.number}
              </Link>
            </TableCell>
            <TableCell className="tabular-nums">{formatDateTime(order.createdAt)}</TableCell>
            <TableCell>
              <Pill tone={ORDER_STATUS_TONES[order.status]}>{ORDER_STATUS_LABELS[order.status]}</Pill>
            </TableCell>
            <TableCell className={num}>
              <MoneyText value={order.totalAmount} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
