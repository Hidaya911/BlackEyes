import { useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import type { Vendor } from '../../api/vendors';
import { createVendorPurchase, type InventoryItem, type PurchaseInput } from '../../api/vendorLedger';
import { LedgerField as Field, MethodSelect, today } from './VendorLedgerFields';
import { cents, formatCents, purchaseTotalCents } from '../../utils/vendorMoney';

interface Props {
  adminId: number;
  vendors: Vendor[];
  items: InventoryItem[];
  initialVendor: string;
  onClose: () => void;
  onSaved: () => void;
}

export function VendorPurchaseModal({ adminId, vendors, items, initialVendor, onClose, onSaved }: Props) {
  const [vendorId, setVendorId] = useState(initialVendor || String(vendors[0]?.vendor_id ?? ''));
  const [form, setForm] = useState<PurchaseInput>(() => ({
    request_key: crypto.randomUUID(),
    item_id: null,
    item_name: '',
    item_type: 'paper',
    unit: 'sheets',
    low_stock_threshold: '0',
    quantity: '',
    unit_price: '',
    purchase_date: today(),
    invoice_reference: '',
    initial_payment: '0',
    payment_method: 'cash',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = <K extends keyof PurchaseInput>(key: K, value: PurchaseInput[K]) => {
    setForm(current => ({ ...current, [key]: value }));
  };
  const selectedItem = items.find(item => item.item_id === form.item_id);
  const total = purchaseTotalCents(form.quantity, form.unit_price);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !vendorId) return;
    setBusy(true);
    setError('');
    try {
      await createVendorPurchase(adminId, Number(vendorId), form);
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to record purchase.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show onHide={() => !busy && onClose()} size="lg" centered backdrop={busy ? 'static' : true} keyboard={!busy} contentClassName="vendor-modal" aria-labelledby="purchase-title">
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="purchase-title">Record a material purchase</Modal.Title>
      </Modal.Header>
      <form onSubmit={event => void submit(event)}>
        <Modal.Body>
          <p className="text-secondary small">Record materials already received. Saving adds them to inventory and records any amount paid now.</p>
          <fieldset disabled={busy} className="ledger-form-grid">
            <Field label="Vendor *">
              <select className="form-select" value={vendorId} required onChange={event => setVendorId(event.target.value)}>
                <option value="">Choose vendor</option>
                {vendors.map(vendor => <option key={vendor.vendor_id} value={vendor.vendor_id}>{vendor.name}</option>)}
              </select>
            </Field>
            <Field label="Purchase date *">
              <input className="form-control" type="date" required max={today()} value={form.purchase_date} onChange={event => update('purchase_date', event.target.value)} />
            </Field>
            <Field label="Inventory item *" wide>
              <select className="form-select" value={form.item_id ?? ''} onChange={event => update('item_id', event.target.value ? Number(event.target.value) : null)}>
                <option value="">+ Create a new material</option>
                {items.map(item => <option key={item.item_id} value={item.item_id}>{item.name} ({item.type}, {item.unit})</option>)}
              </select>
            </Field>
            {!form.item_id && (
              <>
                <Field label="Item name *">
                  <input className="form-control" placeholder="A4 paper, 80 gsm" required maxLength={255} value={form.item_name} onChange={event => update('item_name', event.target.value)} />
                </Field>
                <Field label="Material type *">
                  <select className="form-select" value={form.item_type} onChange={event => update('item_type', event.target.value)}>
                    <option value="paper">Paper</option>
                    <option value="ink">Ink</option>
                    <option value="other">Other</option>
                  </select>
                </Field>
                <Field label="Quantity unit *">
                  <input className="form-control" placeholder="sheets, reams, litres…" required maxLength={30} value={form.unit} onChange={event => update('unit', event.target.value)} />
                </Field>
                <Field label="Low-stock alert quantity">
                  <input className="form-control" type="number" min="0" step="0.001" required value={form.low_stock_threshold} onChange={event => update('low_stock_threshold', event.target.value)} />
                </Field>
              </>
            )}
            <Field label={`Quantity received (${selectedItem?.unit || form.unit || 'units'}) *`}>
              <input className="form-control" type="number" min="0.001" step="0.001" required value={form.quantity} onChange={event => update('quantity', event.target.value)} />
            </Field>
            <Field label="Price per unit (USD) *">
              <input className="form-control" type="number" min="0" step="0.01" required value={form.unit_price} onChange={event => update('unit_price', event.target.value)} />
            </Field>
            <Field label="Vendor invoice / bill reference" wide>
              <input className="form-control" placeholder="Optional, e.g. INV-2026-001" maxLength={100} value={form.invoice_reference} onChange={event => update('invoice_reference', event.target.value)} />
            </Field>
            <Field label="Paid now (USD)">
              <input className="form-control" type="number" min="0" step="0.01" required value={form.initial_payment} onChange={event => update('initial_payment', event.target.value)} />
            </Field>
            <Field label="Payment method">
              <MethodSelect value={form.payment_method} onChange={value => update('payment_method', value)} />
            </Field>
          </fieldset>
          <div className="ledger-purchase-preview">
            <span>Estimated total <strong>{formatCents(total)}</strong></span>
            <span>Remaining <strong>{formatCents(total - cents(form.initial_payment))}</strong></span>
          </div>
          <p className="text-secondary small mb-0">Leave paid now at zero to record a purchase on credit. Totals are rounded to the nearest cent.</p>
          {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button type="button" className="btn btn-light" disabled={busy} onClick={onClose}>Cancel</button>
          <button className="btn vendor-primary" type="submit" disabled={busy}>{busy ? 'Recording…' : 'Record purchase & update stock'}</button>
        </Modal.Footer>
      </form>
    </Modal>
  );
}
