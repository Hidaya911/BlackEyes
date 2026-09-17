import { useEffect, useState } from 'react';
import { FaArrowDown, FaBoxOpen, FaMoneyBillWave, FaPlus, FaReceipt, FaSyncAlt } from 'react-icons/fa';
import type { Vendor } from '../../api/vendors';
import { getVendorLedger, type VendorLedgerData, type VendorPurchase } from '../../api/vendorLedger';
import { VendorPurchaseModal } from './VendorPurchaseModal';
import { VendorPaymentModal } from './VendorPaymentModal';
import { money } from './VendorLedgerFields';
import { cents, formatCents } from '../../utils/vendorMoney';
import '../../style/VendorLedger.css';

export function VendorLedger({ adminId, vendors }: { adminId?: number; vendors: Vendor[] }) {
  const [data, setData] = useState<VendorLedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [vendorFilter, setVendorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showPurchase, setShowPurchase] = useState(false);
  const [selected, setSelected] = useState<VendorPurchase | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    if (!adminId) {
      setData(null);
      setLoadError('Please sign in to view the vendor ledger.');
      setLoading(false);
      return;
    }
    getVendorLedger(adminId, controller.signal)
      .then(setData)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setLoadError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [adminId, reload, vendors]);

  const accountFilter = vendors.some(vendor => String(vendor.vendor_id) === vendorFilter) ? vendorFilter : '';
  const vendorPurchases = (data?.purchases ?? []).filter(entry => !accountFilter || entry.vendor_id === Number(accountFilter));
  const filtered = vendorPurchases.filter(entry => statusFilter === 'all' || entry.payment_status === statusFilter);
  const totals = vendorPurchases.reduce((sum, entry) => ({
    cost: sum.cost + cents(entry.cost),
    paid: sum.paid + cents(entry.paid),
    remaining: sum.remaining + cents(entry.remaining),
  }), { cost: 0n, paid: 0n, remaining: 0n });
  const unavailable = loading || !!loadError || !data;

  return (
    <section className="vendor-ledger" aria-label="Vendor purchases and payments">
      <div className="ledger-heading">
        <div>
          <span className="vendor-eyebrow">FROM DELIVERY TO SETTLEMENT</span>
          <h2>Purchases & payments</h2>
          <p>Record incoming materials. Keep every payment and every balance in view.</p>
        </div>
        <button className="btn vendor-primary" disabled={unavailable || !vendors.length} onClick={() => setShowPurchase(true)}>
          <FaPlus className="me-2" /> Record purchase
        </button>
      </div>
      {message && <div className="alert alert-success" role="status">{message}</div>}
      <div className="ledger-toolbar">
        <label>
          <span>Vendor account</span>
          <select className="form-select" value={accountFilter} onChange={event => setVendorFilter(event.target.value)}>
            <option value="">All vendors</option>
            {vendors.map(vendor => <option value={vendor.vendor_id} key={vendor.vendor_id}>{vendor.name}</option>)}
          </select>
        </label>
        <label>
          <span>Payment status</span>
          <select className="form-select" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="unpaid">Unpaid</option>
            <option value="partial">Partially paid</option>
            <option value="paid">Paid</option>
          </select>
        </label>
        <button className="btn btn-light" disabled={loading} onClick={() => setReload(value => value + 1)}>
          <FaSyncAlt className="me-2" /> Refresh ledger
        </button>
      </div>
      {loading ? <p className="vendor-empty" role="status">Loading purchases and balances…</p> : loadError ? (
        <div className="alert alert-danger" role="alert">{loadError} Use Refresh ledger to try again.</div>
      ) : (
        <>
          <div className="ledger-totals">
            <article>
              <FaReceipt /><span>Total purchased</span><strong>{formatCents(totals.cost)}</strong>
            </article>
            <article>
              <FaMoneyBillWave /><span>Total paid</span><strong>{formatCents(totals.paid)}</strong>
            </article>
            <article className="ledger-balance">
              <FaArrowDown /><span>Still owed to vendors</span><strong>{formatCents(totals.remaining)}</strong>
            </article>
          </div>
          <p className="ledger-currency">Amounts in USD · Totals cover all purchases for the selected vendor account.</p>
          <div className="ledger-table-wrap">
            <table className="table ledger-table align-middle">
              <thead>
                <tr>
                  <th>Purchase / vendor</th><th>Materials received</th><th>Total</th>
                  <th>Paid / remaining</th><th>Status</th><th>Payments</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(entry => (
                  <tr key={entry.purchase_id}>
                    <td>
                      <strong>{entry.vendor_name}</strong>
                      <small>#{entry.purchase_id} · {entry.purchase_date}</small>
                      <small>{entry.invoice_reference || 'No invoice reference'}</small>
                      <small>Recorded by {entry.created_by}</small>
                    </td>
                    <td>
                      <strong>{entry.item_name}</strong>
                      <small>{Number(entry.quantity)} {entry.unit} × {money(entry.unit_price)}</small>
                    </td>
                    <td className="text-nowrap">{money(entry.cost)}</td>
                    <td>
                      <strong>{money(entry.paid)} paid</strong>
                      <small>{money(entry.remaining)} remaining</small>
                    </td>
                    <td>
                      <span className={`ledger-status ledger-status-${entry.payment_status}`}>
                        {entry.payment_status === 'partial' ? 'Partially paid' : entry.payment_status}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm ledger-payment-button" onClick={() => setSelected(entry)}>
                        {entry.payment_status === 'paid' ? 'View history' : 'Pay / history'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!filtered.length && (
              <div className="vendor-empty">
                <FaReceipt size={28} className="mb-3" />
                <h3>No purchases to show</h3>
                <p>{!vendors.length ? 'Create a vendor above, then record your first purchase.' : 'Record a purchase or change your filters.'}</p>
              </div>
            )}
          </div>
          <details className="ledger-inventory">
            <summary>
              <FaBoxOpen className="me-2" /> Inventory on hand
              <span>{data?.items.length ?? 0} materials</span>
            </summary>
            <p className="text-secondary small mt-3">Shared stock across all vendors. Every recorded purchase adds its received quantity.</p>
            <div className="ledger-stock-grid">
              {data?.items.map(item => (
                <article key={item.item_id}>
                  <span>{item.type}</span>
                  <strong>{item.name}</strong>
                  <p>{Number(item.quantity_on_hand)} {item.unit}</p>
                  <small className={Number(item.quantity_on_hand) <= Number(item.low_stock_threshold) ? 'text-danger' : 'text-secondary'}>
                    {Number(item.quantity_on_hand) <= Number(item.low_stock_threshold) ? 'Low stock' : 'In stock'} · Alert at {Number(item.low_stock_threshold)} {item.unit}
                  </small>
                </article>
              ))}
            </div>
            {!data?.items.length && <p className="text-secondary small">Your first purchase will create an inventory item.</p>}
          </details>
        </>
      )}
      {showPurchase && adminId && data && (
        <VendorPurchaseModal
          adminId={adminId}
          vendors={vendors}
          items={data.items}
          initialVendor={accountFilter}
          onClose={() => setShowPurchase(false)}
          onSaved={() => {
            setShowPurchase(false);
            setMessage('Purchase recorded. Inventory and the vendor balance have been updated.');
            setReload(value => value + 1);
          }}
        />
      )}
      {selected && adminId && (
        <VendorPaymentModal
          adminId={adminId}
          purchase={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            setMessage('Payment recorded in the vendor ledger.');
            setReload(value => value + 1);
          }}
        />
      )}
    </section>
  );
}
