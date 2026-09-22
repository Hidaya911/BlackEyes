import { useEffect, useState } from 'react';
import { FaArrowLeft, FaDownload, FaPlus, FaSyncAlt } from 'react-icons/fa';
import { customerMoney } from '../../../api/customer';
import { getStatement, type CustomerStatement, type LedgerKind } from '../../../api/customerLedger';
import { exportStatement, ledgerDate, paymentLabel } from '../../../utils/customerLedger';
import { CustomerSettlementModal } from './CustomerSettlementModal';
import { DocumentPreview } from '../documents/DocumentPreview';

interface Props { kind: LedgerKind; customerId: number; onBack: () => void; onChanged: () => void }

export function CustomerLedgerDetail({ kind, customerId, onBack, onChanged }: Props) {
  const [data, setData] = useState<CustomerStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [payment, setPayment] = useState<{ orderId?: number } | null>(null);
  const [document, setDocument] = useState<{ id: number; kind: 'invoice' | 'receipt' } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getStatement(kind, customerId, controller.signal).then(setData)
      .catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [kind, customerId]);
  async function refresh() {
    setLoading(true); setError('');
    try { setData(await getStatement(kind, customerId)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  return <div className="debt-detail">
    <div className="debt-detail-toolbar"><button className="debt-button" onClick={onBack}><FaArrowLeft /> All customer balances</button><div><button className="debt-button" disabled={loading} onClick={refresh}><FaSyncAlt /> Refresh</button><button className="debt-button" disabled={!data || loading || !!error} onClick={() => data && exportStatement(data)}><FaDownload /> Export statement</button></div></div>
    {notice && <div className="alert alert-success" role="status">{notice}</div>}{error && <div className="alert alert-danger" role="alert">{error}</div>}
    {loading ? <div className="debt-empty" role="status">Loading the customer statement…</div> : data && !error && <>
      <div className="debt-customer-heading"><div><span className="debt-kicker">{data.customer.kind === 'account' ? 'PORTAL CUSTOMER' : 'WALK-IN CUSTOMER'} / STATEMENT</span><h2>{data.customer.name}</h2><p>{[data.customer.phone, data.customer.email, data.customer.address].filter(Boolean).join(' · ') || 'No contact details recorded'}</p></div><button className="debt-button debt-button-primary" disabled={data.due <= 0} onClick={() => setPayment({})}><FaPlus /> Record payment</button></div>
      <div className="debt-totals"><article><span>Total charges</span><strong>{customerMoney(data.total)}</strong><small>All orders for this customer</small></article><article><span>Verified payments</span><strong>{customerMoney(data.paid)}</strong><small>Money received and confirmed</small></article><article className="debt-total-due"><span>Outstanding balance</span><strong>{customerMoney(data.due)}</strong><small>{data.due ? 'Available for partial or full settlement' : 'All orders are settled'}</small></article></div>
      <section className="debt-panel"><div className="debt-section-heading"><div><span className="debt-kicker">ORDER BY ORDER</span><h3>Charges & balances</h3></div><span>{data.orders.length} orders</span></div><div className="debt-table-wrap"><table className="debt-table"><thead><tr><th>Order / date</th><th>Total</th><th>Paid</th><th>Outstanding</th><th>Actions</th></tr></thead><tbody>{data.orders.map(order => <tr key={order.order_id}><td><strong>#{order.order_id}</strong><small>{ledgerDate(order.created_at)}</small><small>{order.stage}</small></td><td>{customerMoney(order.total)}</td><td className="debt-paid-text">{customerMoney(order.paid)}</td><td><span className={order.due ? 'debt-due-badge' : 'debt-settled-badge'}>{order.due ? customerMoney(order.due) : 'Settled'}</span></td><td><div className="debt-row-actions"><button className="debt-button" onClick={() => setDocument({ id: order.order_id, kind: 'invoice' })}>Invoice</button>{order.paid > 0 && <button className="debt-button" onClick={() => setDocument({ id: order.order_id, kind: 'receipt' })}>Receipt</button>}{order.due > 0 && <button className="debt-button debt-button-primary" onClick={() => setPayment({ orderId: order.order_id })}>Add payment</button>}</div></td></tr>)}{!data.orders.length && <tr><td colSpan={5}>No orders for this customer yet.</td></tr>}</tbody></table></div></section>
      <section className="debt-panel"><div className="debt-section-heading"><div><span className="debt-kicker">THE COMPLETE PICTURE</span><h3>Customer ledger</h3></div><span>Oldest first · USD</span></div><p className="debt-explanation">Each order adds a charge; each verified payment reduces the running balance. Earlier cumulative payments are labeled “Previous verified payment”.</p><div className="debt-table-wrap"><table className="debt-table"><thead><tr><th>Date (UTC) / entry</th><th>Charge</th><th>Payment</th><th>Running balance</th><th>Recorded details</th></tr></thead><tbody>{data.entries.map(entry => <tr key={entry.key} className={entry.type === 'payment' ? 'debt-payment-row' : ''}><td><small>{ledgerDate(entry.date)}</small><strong>{entry.description}</strong><small>Order #{entry.order_id}</small></td><td>{entry.charge ? customerMoney(entry.charge) : '—'}</td><td className="debt-paid-text">{entry.payment ? customerMoney(entry.payment) : '—'}</td><td><strong>{customerMoney(entry.balance)}</strong></td><td>{entry.type === 'payment' && <><span>{paymentLabel(entry.method)}</span><small>{entry.recorded_by ? `Recorded by ${entry.recorded_by}` : 'Previous records'}</small>{entry.reference && <small>Reference: {entry.reference}</small>}{entry.note && <small className="debt-note">{entry.note}</small>}</>}</td></tr>)}{!data.entries.length && <tr><td colSpan={5}>No charges or payments recorded.</td></tr>}</tbody></table></div><p className="debt-footnote">Statement prepared {ledgerDate(data.generated_at)} UTC. Receipts show the order’s cumulative verified payments; this ledger lists the individual entries.</p></section>
    </>}
    {data && payment && <CustomerSettlementModal statement={data} initialOrderId={payment.orderId} onClose={() => { setPayment(null); void refresh(); onChanged(); }} onSaved={saved => { setData(saved); setPayment(null); setNotice('Payment recorded. The customer balance and order payment status have been updated.'); onChanged(); }} />}
    {document && <DocumentPreview key={`${document.id}-${document.kind}`} orderId={document.id} kind={document.kind} onClose={() => setDocument(null)} />}
  </div>;
}
