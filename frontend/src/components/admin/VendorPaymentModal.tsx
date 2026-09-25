import { useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { recordVendorOrderPayment, type PaymentInput, type VendorOrder } from '../../api/vendorLedger';
import { LedgerField as Field, MethodSelect, money, today, paymentMethods } from './VendorLedgerFields';

interface Props {
  adminId: number;
  purchase: VendorOrder;
  onClose: () => void;
  onSaved: () => void;
}

export function VendorPaymentModal({ adminId, purchase, onClose, onSaved }: Props) {
  const [form, setForm] = useState<PaymentInput>(() => ({
    request_key: crypto.randomUUID(),
    amount: purchase.remaining,
    payment_date: today(),
    method: 'cash',
    reference: '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await recordVendorOrderPayment(adminId, purchase.order_id, form);
      onSaved();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to record payment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal show onHide={() => !busy && onClose()} size="lg" centered backdrop={busy ? 'static' : true} keyboard={!busy} contentClassName="vendor-modal" aria-labelledby="payment-title">
      <Modal.Header closeButton={!busy}>
        <Modal.Title id="payment-title">Vendor order #{purchase.order_id} · Payments</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <h5>{purchase.vendor_name}</h5>
        <p className="text-secondary">{purchase.lines.length} items · {purchase.invoice_reference || 'No invoice reference'} · {purchase.purchase_date}</p>
        <div className="ledger-purchase-preview">
          <span>Total <strong>{money(purchase.cost)}</strong></span>
          <span>Paid <strong>{money(purchase.paid)}</strong></span>
          <span>Remaining <strong>{money(purchase.remaining)}</strong></span>
        </div>
        <h6 className="mt-4">Payment history</h6>
        {!purchase.payments.length ? <p className="text-secondary small">No payments recorded yet.</p> : (
          <div className="ledger-payment-history">
            {purchase.payments.map(entry => (
              <article key={entry.vendor_payment_id}>
                <strong>{money(entry.amount)}</strong>
                <span>{entry.payment_date} · {paymentMethods.find(method => method.value === entry.method)?.label}</span>
                <small>{entry.reference || 'No reference'} · Recorded by {entry.recorded_by}</small>
              </article>
            ))}
          </div>
        )}
        {purchase.payment_status !== 'paid' && (
          <form className="ledger-settle-form" onSubmit={event => void submit(event)}>
            <h6>Record a payment</h6>
            <p className="text-secondary small">Record money already paid to this vendor. This does not send a payment.</p>
            <fieldset disabled={busy} className="ledger-form-grid">
              <Field label="Amount paid (USD) *">
                <input className="form-control" type="number" min="0.01" max={purchase.remaining} step="0.01" required value={form.amount} onChange={event => setForm({ ...form, amount: event.target.value })} />
              </Field>
              <Field label="Payment date *">
                <input className="form-control" type="date" required min={purchase.purchase_date} max={today()} value={form.payment_date} onChange={event => setForm({ ...form, payment_date: event.target.value })} />
              </Field>
              <Field label="Method">
                <MethodSelect value={form.method} onChange={method => setForm({ ...form, method })} />
              </Field>
              <Field label="Receipt / transfer reference">
                <input className="form-control" maxLength={100} value={form.reference} onChange={event => setForm({ ...form, reference: event.target.value })} />
              </Field>
            </fieldset>
            {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
            <button type="submit" className="btn vendor-primary mt-3" disabled={busy}>{busy ? 'Recording…' : 'Record payment'}</button>
          </form>
        )}
      </Modal.Body>
      <Modal.Footer>
        <button type="button" className="btn btn-light" disabled={busy} onClick={onClose}>Close</button>
      </Modal.Footer>
    </Modal>
  );
}
