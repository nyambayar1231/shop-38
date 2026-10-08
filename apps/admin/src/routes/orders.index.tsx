import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { RiAddLine } from '@remixicon/react'
import { ORDER_STATUSES, type OrderStatus } from '@shop-38/contracts'
import { Empty, ErrorBox, Loading, MoneyText, PageHeader, Pill, num } from '@/components/common'
import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useOrdersQuery } from '@/features/order/order-api'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from '@/features/order/order-status'
import { formatDateTime } from '@/lib/date'

export const Route = createFileRoute('/orders/')({
  component: Orders,
})

function Orders() {
  const orders = useOrdersQuery()
  const [status, setStatus] = useState<OrderStatus | ''>('')

  const visible = (orders.data ?? []).filter((order) => !status || order.status === status)

  return (
    <>
      <PageHeader
        title="Захиалга"
        description="Захиалгын мөр бүр үүсгэх үеийн барааны нэр, код, үнийг хадгална."
        actions={
          <Button render={<Link to="/orders/new" />}>
            <RiAddLine data-icon="inline-start" />
            Шинэ захиалга
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <NativeSelect
          aria-label="Төлөв"
          value={status}
          onChange={(event) => setStatus(event.target.value as OrderStatus | '')}
        >
          <NativeSelectOption value="">Бүх төлөв</NativeSelectOption>
          {ORDER_STATUSES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {ORDER_STATUS_LABELS[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>

      <ErrorBox error={orders.error} />
      {orders.isPending ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty>
          {orders.data?.length
            ? 'Тохирох захиалга алга.'
            : 'Захиалга алга. «Шинэ захиалга» дарж эхлээрэй.'}
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дугаар</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className={num}>Тоо ширхэг</TableHead>
              <TableHead className={num}>Нийт дүн</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-medium tabular-nums">
                  <Link
                    to="/orders/$orderId"
                    params={{ orderId: order.id }}
                    className="hover:underline"
                  >
                    №{order.number}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{formatDateTime(order.createdAt)}</TableCell>
                <TableCell>
                  <Pill tone={ORDER_STATUS_TONES[order.status]}>
                    {ORDER_STATUS_LABELS[order.status]}
                  </Pill>
                </TableCell>
                <TableCell className={num}>{order.quantity}</TableCell>
                <TableCell className={num}>
                  <MoneyText value={order.totalAmount} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
