export async function adminRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin${path}`, {
    ...options, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail :
    Array.isArray(data.detail) ? data.detail.map((e: { msg: string }) => e.msg).join(' ') : 'Unable to complete request.');
  return data;
}

export interface AdminCustomer {
  id: number; kind: 'account' | 'walk_in'; full_name: string; email: string;
  phone: string; address: string; status: string;
}
export interface InventoryData {
  items: { item_id: number; name: string; unit: string; quantity: number; threshold: number; low: boolean }[];
  products: { product_id: number; name: string }[];
  materials: { product_id: number; item_id: number; quantity: number }[];
}
export interface AdminReport {
  order_count: number; sales: number; collected: number; outstanding: number; vendor_due: number;
  stages: Record<string, number>;
  products: { name: string; quantity: number; sales: number }[];
  customers: { name: string; kind: string; id: number; orders: number; sales: number; due: number }[];
  daily: { date: string; sales: number }[];
  usage: { name: string; unit: string; quantity: number }[];
  recent: { id: number; customer: string; stage: string; total: number }[];
  low_stock: { id: number; name: string; quantity: number; unit: string; threshold: number }[];
}
export const usd = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
