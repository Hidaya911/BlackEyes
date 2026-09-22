import { pressRequest } from './press';

export type LedgerKind = 'account' | 'walk_in';
export interface LedgerCustomer {
  id: number; kind: LedgerKind; name: string; phone: string; email: string;
  total: number; paid: number; due: number; order_count: number; unpaid_orders: number;
}
export interface LedgerOverview {
  customers: LedgerCustomer[]; total: number; paid: number; due: number; owing_customers: number;
}
export interface LedgerOrder {
  order_id: number; created_at: string; total: number; paid: number; due: number;
  stage: string; payment_status: string;
}
export interface LedgerEntry {
  key: string; order_id: number; date: string; type: 'charge' | 'payment'; description: string;
  charge: number; payment: number; balance: number; method: string | null;
  reference: string | null; recorded_by: string | null; note: string | null;
}
export interface CustomerStatement {
  customer: { id: number; kind: LedgerKind; name: string; phone: string; email: string; address: string };
  total: number; paid: number; due: number; orders: LedgerOrder[]; entries: LedgerEntry[]; generated_at: string;
}
export interface SettlementInput {
  request_key: string; order_id: number; amount: number; method: 'cash' | 'whish_money'; reference: string; note: string;
}
export const getLedger = (signal?: AbortSignal) => pressRequest<LedgerOverview>('/customer-ledger', { signal });
export const getStatement = (kind: LedgerKind, id: number, signal?: AbortSignal) => pressRequest<CustomerStatement>(`/customer-ledger/${kind}/${id}`, { signal });
export const settleCustomerOrder = (kind: LedgerKind, id: number, payload: SettlementInput) =>
  pressRequest<{ transaction_id: number; statement: CustomerStatement }>(`/customer-ledger/${kind}/${id}/payments`, { method: 'POST', body: JSON.stringify(payload) });
