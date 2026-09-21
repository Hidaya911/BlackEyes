import { useEffect, useState } from 'react';
import { FaFileInvoiceDollar, FaReceipt, FaSearch, FaSyncAlt } from 'react-icons/fa';
import { pressRequest, type PressOrder } from '../../../api/press';
import { customerMoney } from '../../../api/customer';
import { DocumentPreview } from './DocumentPreview';
import '../../../style/OrderDocuments.css';

export function DocumentCenter() {
  const [orders, setOrders] = useState<PressOrder[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<{ id: number; kind: 'invoice' | 'receipt' } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    pressRequest<PressOrder[]>('/orders', { signal: controller.signal }).then(setOrders).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function refresh() {
    setLoading(true); setError('');
    try { setOrders(await pressRequest<PressOrder[]>('/orders')); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  const visible = orders.filter(o => `${o.order_id} ${o.customer_name} ${o.customer_email}`.toLowerCase().includes(query.toLowerCase()) && (filter !== 'receipts' || o.amount_paid > 0) && (filter !== 'unpaid' || o.amount_due > 0));
  return <section className="document-center"><header className="document-center-hero"><div><span className="document-eyebrow">THE FINISHING TOUCH</span><h2>Good work. Beautifully documented.</h2><p>Branded invoices and payment receipts, ready to hand over.</p></div><div className="document-hero-art" aria-hidden="true"><FaFileInvoiceDollar /><FaReceipt /></div></header>
    <div className="document-summary"><div><FaFileInvoiceDollar /><strong>{orders.length}</strong><span>Order invoices</span></div><div><FaReceipt /><strong>{orders.filter(o => o.amount_paid > 0).length}</strong><span>Receipts available</span></div><div><strong>{customerMoney(orders.reduce((sum, o) => sum + o.amount_due, 0))}</strong><span>Outstanding balance</span></div></div>
    <div className="document-toolbar"><label><FaSearch /><input aria-label="Search invoices and receipts" placeholder="Find a customer or order…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter documents" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All orders</option><option value="receipts">Receipt available</option><option value="unpaid">Balance outstanding</option></select><button className="btn btn-outline-dark" disabled={loading} onClick={refresh}><FaSyncAlt /> Refresh</button></div>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{loading ? <p role="status">Loading documents…</p> : <div className="document-order-grid">{visible.map(order => <article className="document-order-card" key={order.order_id}><div className="document-card-top"><span>ORDER / {String(order.order_id).padStart(6, '0')}</span><span className={order.amount_due ? 'document-due' : 'document-paid'}>{order.amount_due ? 'Balance due' : 'Settled'}</span></div><h3>{order.customer_name}</h3><p>{new Date(order.created_at).toLocaleDateString('en-GB')} · {order.items.length} line items</p><div className="document-card-amounts"><div><small>ORDER TOTAL</small><strong>{customerMoney(order.total)}</strong></div><div><small>RECEIVED</small><strong>{customerMoney(order.amount_paid)}</strong></div></div><div className="document-card-actions"><button onClick={() => setSelected({ id: order.order_id, kind: 'invoice' })}><FaFileInvoiceDollar /> Invoice</button><button disabled={order.amount_paid <= 0} title={order.amount_paid > 0 ? 'Preview payment receipt' : 'Verify a received payment in Orders to enable receipts'} onClick={() => setSelected({ id: order.order_id, kind: 'receipt' })}><FaReceipt /> Receipt</button></div>{order.amount_paid <= 0 && <small className="document-receipt-hint">Receipt unlocks after payment is verified in Orders.</small>}</article>)}{!visible.length && <p className="text-secondary">No matching orders.</p>}</div>}
    {selected && <DocumentPreview key={`${selected.id}-${selected.kind}`} orderId={selected.id} kind={selected.kind} onClose={() => setSelected(null)} />}
  </section>;
}
