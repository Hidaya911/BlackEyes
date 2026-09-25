export interface InvoiceRow {
  item_name: string; quantity: string; unit_price: string; line_total: string;
  source: string; warning: string;
  unit?: string; item_type?: string;
}
export interface ParsedInvoice {
  invoice_reference: string; purchase_date: string; total: string | null;
  currency: string | null; items: InvoiceRow[]; warnings: string[];
  subtotal?: string | null; tax?: string | null;
  raw_text: string; text_confidence: number; engine: string; suggested_vendor_id: number | null;
}
export async function parseVendorInvoice(file: File, signal: AbortSignal): Promise<ParsedInvoice> {
  const response = await fetch('/api/admin/vendor-invoices/parse', {
    method: 'POST', credentials: 'same-origin', signal,
    headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Unable to read this invoice. Please retry.');
  return body;
}
