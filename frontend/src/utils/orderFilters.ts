import type { PressOrder } from '../api/press';

export interface OrderFiltersValue { from: string; to: string; stage: string; payment: string; channel: string; artwork: string }
export const emptyOrderFilters: OrderFiltersValue = { from: '', to: '', stage: '', payment: '', channel: '', artwork: '' };

export function orderDate(value: string): Date {
  // Older API timestamps may omit the UTC suffix.
  return new Date(/(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}Z`);
}

export function filterOrders(orders: PressOrder[], query: string, filters: OrderFiltersValue) {
  if (filters.from && filters.to && filters.from > filters.to) return [];
  return orders.filter(order => {
    if (!`${order.order_id} ${order.customer_name} ${order.customer_email} ${order.contact_phone ?? ''}`.toLowerCase().includes(query.trim().toLowerCase())) return false;
    if (filters.from || filters.to) {
      const date = orderDate(order.created_at);
      if (Number.isNaN(date.getTime())) return false;
      const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if ((filters.from && day < filters.from) || (filters.to && day > filters.to)) return false;
    }
    if (filters.stage && order.production_stage !== filters.stage) return false;
    if (filters.channel && (order.order_type === 'walk_in' ? 'walk_in' : 'online') !== filters.channel) return false;
    if (filters.payment === 'outstanding' && order.amount_due <= 0) return false;
    if (filters.payment === 'unpaid' && !(order.amount_due > 0 && order.amount_paid === 0)) return false;
    if (filters.payment === 'partial' && !(order.amount_due > 0 && order.amount_paid > 0)) return false;
    if (filters.payment === 'paid' && order.amount_due !== 0) return false;
    if (filters.artwork === 'pending' && !order.files.some(file => file.verification_status !== 'verified')) return false;
    if (filters.artwork === 'approved' && !(order.files.length && order.files.every(file => file.verification_status === 'verified'))) return false;
    if (filters.artwork === 'none' && order.files.length) return false;
    return true;
  });
}
