import { useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { FaCheck, FaCoins, FaLock } from 'react-icons/fa';
import { customerMoney } from '../../../api/customer';
import { settleCustomerOrder, type CustomerStatement, type SettlementInput } from '../../../api/customerLedger';

interface Props { statement: CustomerStatement; initialOrderId?: number; onClose: () => void; onSaved: (statement: CustomerStatement) => void }

export function CustomerSettlementModal({ statement, initialOrderId, onClose, onSaved }: Props) {
  const orders = statement.orders.filter(order => order.due > 0);
  const [orderId, setOrderId] = useState(initialOrderId ?? orders[0]?.order_id ?? 0);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'whish_money'>('cash');
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // Keep the exact submitted request for retries if a response was lost.
  const [submission, setSubmission] = useState<SettlementInput | null>(null);
  const order = orders.find(row => row.order_id === orderId);
  const parsed = /^\d+(\.\d{1,2})?$/.test(amount) ? Math.round(Number(amount) * 100) : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !order) return;
    if (!submission && (!confirmed || parsed <= 0 || parsed > order.due)) { setError('Enter a received amount no greater than the balance due and confirm receipt.'); return; }
    const payload = submission ?? { request_key: crypto.randomUUID(), order_id: orderId, amount: parsed, method, reference: reference.trim(), note: note.trim() };
    setSubmission(payload); setBusy(true); setError('');
    try { const result = await settleCustomerOrder(statement.customer.kind, statement.customer.id, payload); onSaved(result.statement); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <Modal show centered onHide={() => !busy && onClose()} backdrop="static" keyboard={!busy} contentClassName="debt-payment-modal" aria-labelledby="debt-payment-title"><form onSubmit={submit}>
    <Modal.Header closeButton={!busy}><div><span className="debt-kicker">RECORD A RECEIVED PAYMENT</span><Modal.Title id="debt-payment-title">A little closer to settled.</Modal.Title></div></Modal.Header><Modal.Body>
      <div className="debt-payment-person"><span><FaCoins /></span><div><strong>{statement.customer.name}</strong><small>Total outstanding: {customerMoney(statement.due)}</small></div></div>
      <fieldset disabled={busy || !!submission}>
        <label className="debt-field">Apply payment to order<select value={orderId} onChange={e => { setOrderId(Number(e.target.value)); setAmount(''); setConfirmed(false); }}>{orders.map(o => <option key={o.order_id} value={o.order_id}>Order #{o.order_id} · {customerMoney(o.due)} due</option>)}</select></label>
        <div className="debt-payment-balance"><span>Order balance</span><strong>{customerMoney(order?.due ?? 0)}</strong></div>
        <label className="debt-field">Amount received (USD)<input type="number" inputMode="decimal" required min="0.01" max={((order?.due ?? 0) / 100).toFixed(2)} step="0.01" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} /></label>
        <button className="debt-text-button" type="button" onClick={() => setAmount(((order?.due ?? 0) / 100).toFixed(2))}>Use full remaining balance</button>
        <div className="debt-payment-fields"><label className="debt-field">Method<select value={method} onChange={e => setMethod(e.target.value as typeof method)}><option value="cash">Cash at the press</option><option value="whish_money">Whish Money received</option></select></label><label className="debt-field">Reference (optional)<input maxLength={100} value={reference} onChange={e => setReference(e.target.value)} placeholder="Receipt / transfer reference" /></label></div>
        <label className="debt-field">Note (optional)<textarea rows={2} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} placeholder="Any details about this payment…" /></label>
        <label className="debt-confirm"><input type="checkbox" required checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /><span>I confirm this money has been received.</span></label>
      </fieldset>
      <div className="debt-after-payment"><span>Remaining after this payment</span><strong>{customerMoney(Math.max(0, (order?.due ?? 0) - (submission?.amount ?? parsed)))}</strong></div>
      {error && <div className="alert alert-danger mt-3" role="alert">{error}<small className="d-block mt-2">Retry submits the same payment once. To change details, close and refresh the ledger first to check whether it was recorded.</small></div>}
      <p className="debt-payment-hint"><FaLock /> Recorded now, with your name in the payment history.</p>
    </Modal.Body><Modal.Footer><button type="button" className="debt-button" disabled={busy} onClick={onClose}>Close</button><button className="debt-button debt-button-primary" disabled={busy || !order}>{busy ? 'Recording…' : submission ? 'Retry same payment' : 'Record payment'} <FaCheck /></button></Modal.Footer>
  </form></Modal>;
}
