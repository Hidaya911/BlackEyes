export type PaymentMethod = 'cash' | 'bank_transfer' | 'whish_money' | 'other';

export interface InventoryItem {
  item_id: number;
  name: string;
  type: string;
  unit: string;
  quantity_on_hand: string;
  low_stock_threshold: string;
}

export interface VendorPayment {
  vendor_payment_id: number;
  amount: string;
  method: PaymentMethod;
  payment_date: string;
  reference: string | null;
  recorded_by: string;
}

export interface VendorPurchase {
  purchase_id: number;
  vendor_id: number;
  vendor_name: string;
  item_id: number;
  item_name: string;
  unit: string;
  quantity: string;
  unit_price: string;
  cost: string;
  paid: string;
  remaining: string;
  payment_status: 'paid' | 'partial' | 'unpaid';
  purchase_date: string;
  invoice_reference: string | null;
  created_by: string;
  payments: VendorPayment[];
}

export interface VendorLedgerData {
  purchases: VendorPurchase[];
  items: InventoryItem[];
  total_cost: string;
  total_paid: string;
  remaining: string;
}

export interface PurchaseInput {
  request_key: string;
  item_id: number | null;
  item_name: string;
  item_type: string;
  unit: string;
  low_stock_threshold: string;
  quantity: string;
  unit_price: string;
  purchase_date: string;
  invoice_reference: string;
  initial_payment: string;
  payment_method: PaymentMethod;
}

export interface PaymentInput {
  request_key: string;
  amount: string;
  payment_date: string;
  method: PaymentMethod;
  reference: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/${path}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string'
      ? body.detail
      : Array.isArray(body.detail)
        ? body.detail.map((issue: { msg: string }) => issue.msg).join(' ')
        : 'Unable to load or save the vendor ledger. Please try again.';
    throw new Error(detail);
  }
  return response.json();
}

export function getVendorLedger(adminId: number, signal?: AbortSignal) {
  return request<VendorLedgerData>(`vendor-ledger?admin_id=${adminId}`, { signal });
}

export function createVendorPurchase(adminId: number, vendorId: number, input: PurchaseInput) {
  return request<{ purchase_id: number }>(`vendors/${vendorId}/purchases`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: adminId, ...input }),
  });
}

export function recordVendorPayment(adminId: number, purchaseId: number, input: PaymentInput) {
  return request<{ vendor_payment_id: number }>(`vendor-purchases/${purchaseId}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: adminId, ...input }),
  });
}
