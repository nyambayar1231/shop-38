import { createFileRoute, Link } from '@tanstack/react-router'
import { RiPrinterLine } from '@remixicon/react'
import { toast } from 'sonner'
import type { UpdateOrderStatusInput } from '@shop-38/contracts'
import {
  ErrorBox,
  Loading,
  MoneyText,
  PageHeader,
  Pill,
  Stat,
  num,
} from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOrderQuery, useUpdateOrderStatus } from '@/features/order/order-api'
import { OrderReceipt } from '@/features/order/order-receipt'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/features/order/order-status'
import { variantLabel } from '@/features/product/variant-drafts'
import { formatDateTime } from '@/lib/date'

export const Route = createFileRoute('/orders/$orderId')({
  component: OrderPage,
})

const STATUS_TOASTS: Record<UpdateOrderStatusInput['status'], string> = {
  completed: 'Захиалгыг биелсэн гэж тэмдэглэлээ.',
  cancelled: 'Захиалгыг цуцаллаа.',
}

function OrderPage() {
  const { orderId } = Route.useParams()
  const order = useOrderQuery(orderId)
  const updateStatus = useUpdateOrderStatus()

  if (order.isPending) return <Loading />
  if (order.error) return <ErrorBox error={order.error} />

  const detail = order.data

  async function changeStatus(status: UpdateOrderStatusInput['status']) {
    try {
      await updateStatus.mutateAsync({ id: detail.id, input: { status } })
      toast.success(STATUS_TOASTS[status])
    } catch {
      // Shown in the ErrorBox, from `updateStatus.error`.
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/orders', label: 'Захиалга' }}
        title={
          <>
            <span className="tabular-nums">Захиалга №{detail.number}</span>
            <Pill tone={ORDER_STATUS_TONES[detail.status]}>{ORDER_STATUS_LABELS[detail.status]}</Pill>
          </>
        }
        description={`Үүсгэсэн: ${formatDateTime(detail.createdAt)}`}
        actions={
          <>
            <Button variant="outline" onClick={() => window.print()}>
              <RiPrinterLine data-icon="inline-start" />
              Хэвлэх
            </Button>
            {detail.status === 'pending' && (
              <>
                <Button
                  variant="outline"
                  disabled={updateStatus.isPending}
                  onClick={() => void changeStatus('cancelled')}
                >
                  Цуцлах
                </Button>
                <Button
                  disabled={updateStatus.isPending}
                  onClick={() => void changeStatus('completed')}
                >
                  Биелсэн гэж тэмдэглэх
                </Button>
              </>
            )}
          </>
        }
      />

      <OrderReceipt order={detail} />
      <ErrorBox error={updateStatus.error} />

      <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Нийт дүн">
          <MoneyText value={detail.totalAmount} />
        </Stat>
        <Stat label="Тоо ширхэг">
          {detail.items.reduce((sum, item) => sum + item.quantity, 0)}
        </Stat>
      </div>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Хэрэглэгч</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-1 text-sm">
          <Link
            to="/customers/$customerId"
            params={{ customerId: detail.customer.id }}
            className="font-medium hover:underline"
          >
            {detail.customer.name}
          </Link>
          <span className="tabular-nums">{detail.customer.phone}</span>
          {detail.customer.email && <span>{detail.customer.email}</span>}
          {detail.customer.address && (
            <span className="whitespace-pre-line text-muted-foreground">
              {detail.customer.address}
            </span>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Бараа</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Бараа</TableHead>
                <TableHead>Код</TableHead>
                <TableHead className={num}>Нэгж үнэ</TableHead>
                <TableHead className={num}>Тоо</TableHead>
                <TableHead className={num}>Дүн</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.productId ? (
                      <Link
                        to="/products/$productId"
                        params={{ productId: item.productId }}
                        className="hover:underline"
                      >
                        {item.productName}
                      </Link>
                    ) : (
                      item.productName
                    )}
                    {item.optionValues.length > 0 && (
                      <div className="text-xs font-normal text-muted-foreground">
                        {variantLabel(item.optionValues)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {[item.productCode, item.sku].filter(Boolean).join(' · ') || '—'}
                  </TableCell>
                  <TableCell className={num}>
                    <MoneyText value={item.unitPrice} />
                  </TableCell>
                  <TableCell className={num}>{item.quantity}</TableCell>
                  <TableCell className={num}>
                    <MoneyText value={item.lineTotal} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Нийт
                </TableCell>
                <TableCell className={`${num} font-semibold`}>
                  <MoneyText value={detail.totalAmount} />
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {detail.note && (
            <p className="mt-6 text-sm whitespace-pre-line">
              <span className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Тэмдэглэл
              </span>
              <br />
              {detail.note}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}
