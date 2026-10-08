import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { RiAddLine, RiSearchLine } from '@remixicon/react'
import { Empty, ErrorBox, Loading, PageHeader, num } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useCustomersQuery } from '@/features/customer/customer-api'
import { CustomerFormDialog } from '@/features/customer/customer-form-dialog'
import { formatDateTime } from '@/lib/date'

export const Route = createFileRoute('/customers/')({
  component: Customers,
})

/** Filtered in the browser, like products: instant, and a shop this size can afford it. */
function Customers() {
  const navigate = useNavigate()
  const customers = useCustomersQuery()
  const [q, setQ] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  const needle = q.trim().toLocaleLowerCase()
  const digits = needle.replace(/\D/g, '')
  const visible = (customers.data ?? []).filter(
    (customer) =>
      !needle ||
      customer.name.toLocaleLowerCase().includes(needle) ||
      (digits && customer.phone.includes(digits)) ||
      customer.email?.includes(needle),
  )

  return (
    <>
      <PageHeader
        title="Хэрэглэгч"
        description="Захиалга өгөх хэрэглэгчид. Захиалга бүр нэг хэрэглэгчид хамаарна."
        actions={
          <Button onClick={() => setIsFormOpen(true)}>
            <RiAddLine data-icon="inline-start" />
            Шинэ хэрэглэгч
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div className="relative min-w-60 flex-1">
          <RiSearchLine className="pointer-events-none absolute top-1/2 left-0 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-6"
            placeholder="Нэр, утас, имэйлээр хайх"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
      </div>

      <ErrorBox error={customers.error} />
      {customers.isPending ? (
        <Loading />
      ) : visible.length === 0 ? (
        <Empty>
          {customers.data?.length
            ? 'Тохирох хэрэглэгч алга.'
            : 'Хэрэглэгч алга. «Шинэ хэрэглэгч» дарж эхлээрэй.'}
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Нэр</TableHead>
              <TableHead>Утас</TableHead>
              <TableHead>Имэйл</TableHead>
              <TableHead className={num}>Захиалга</TableHead>
              <TableHead>Бүртгэсэн</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((customer) => (
              <TableRow key={customer.id}>
                <TableCell className="font-medium">
                  <Link
                    to="/customers/$customerId"
                    params={{ customerId: customer.id }}
                    className="hover:underline"
                  >
                    {customer.name}
                  </Link>
                </TableCell>
                <TableCell className="tabular-nums">{customer.phone}</TableCell>
                <TableCell className="text-muted-foreground">{customer.email ?? '—'}</TableCell>
                <TableCell className={num}>{customer.orderCount}</TableCell>
                <TableCell className="tabular-nums">{formatDateTime(customer.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CustomerFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        customer={null}
        onSaved={(customer) =>
          void navigate({ to: '/customers/$customerId', params: { customerId: customer.id } })
        }
      />
    </>
  )
}
