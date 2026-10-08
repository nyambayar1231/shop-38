import { createPortal } from 'react-dom'
import { variantLabel } from '@/features/product/variant-drafts'
import { formatDateTime } from '@/lib/date'
import { formatMoney } from '@/lib/money'
import type { OrderDetail } from './order-api'
import { ORDER_STATUS_LABELS } from './order-status'

/**
 * The paper copy handed to the customer. Rendered straight into <body>, outside
 * the admin shell, and shown only when printing: `.print-root` in index.css hides
 * everything else on paper and this on screen. So "print" is just `window.print()`.
 */
export function OrderReceipt({ order }: { order: OrderDetail }) {
  const quantity = order.items.reduce((sum, item) => sum + item.quantity, 0)

  return createPortal(
    <div className="print-root font-sans text-[11pt] leading-snug text-black">
      <header className="mb-6 flex items-start justify-between gap-6 border-b-2 border-black pb-4">
        <div>
          <p className="font-heading text-2xl font-bold tracking-tight">Shop 38</p>
          <p className="text-sm">Захиалгын баримт</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-heading text-lg font-semibold tabular-nums">№{order.number}</p>
          <p className="tabular-nums">{formatDateTime(order.createdAt)}</p>
          <p>{ORDER_STATUS_LABELS[order.status]}</p>
        </div>
      </header>

      <section className="mb-6 text-sm">
        <p className="mb-1 text-xs font-semibold tracking-wider uppercase">Хэрэглэгч</p>
        <p className="font-semibold">{order.customer.name}</p>
        <p className="tabular-nums">{order.customer.phone}</p>
        {order.customer.email && <p>{order.customer.email}</p>}
        {order.customer.address && <p className="whitespace-pre-line">{order.customer.address}</p>}
      </section>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-1.5 pr-2 font-semibold">№</th>
            <th className="py-1.5 pr-2 font-semibold">Бараа</th>
            <th className="py-1.5 pr-2 font-semibold">Код</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Нэгж үнэ</th>
            <th className="py-1.5 pr-2 text-right font-semibold">Тоо</th>
            <th className="py-1.5 text-right font-semibold">Дүн</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item, index) => (
            <tr key={item.id} className="break-inside-avoid border-b border-neutral-300 align-top">
              <td className="py-1.5 pr-2 tabular-nums">{index + 1}</td>
              <td className="py-1.5 pr-2">
                {item.productName}
                {item.optionValues.length > 0 && (
                  <span className="block text-xs">{variantLabel(item.optionValues)}</span>
                )}
              </td>
              <td className="py-1.5 pr-2 text-xs">
                {[item.productCode, item.sku].filter(Boolean).join(' · ') || '—'}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(item.unitPrice)}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{item.quantity}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4} className="pt-3 pr-2 text-right font-semibold">
              Нийт
            </td>
            <td className="pt-3 pr-2 text-right font-semibold tabular-nums">{quantity}</td>
            <td className="pt-3 text-right text-base font-bold tabular-nums">
              {formatMoney(order.totalAmount)}
            </td>
          </tr>
        </tfoot>
      </table>

      {order.note && (
        <section className="mt-6 text-sm break-inside-avoid">
          <p className="mb-1 text-xs font-semibold tracking-wider uppercase">Тэмдэглэл</p>
          <p className="whitespace-pre-line">{order.note}</p>
        </section>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-10 text-sm break-inside-avoid">
        <div className="border-t border-black pt-1">Хүлээлгэн өгсөн</div>
        <div className="border-t border-black pt-1">Хүлээн авсан</div>
      </footer>
      <p className="mt-8 text-center text-sm">Худалдан авалт хийсэнд баярлалаа!</p>
    </div>,
    document.body,
  )
}
