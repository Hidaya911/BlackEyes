import { useEffect, useState } from 'react';
import { FaArrowRight, FaCoins, FaSearch, FaSyncAlt, FaWallet } from 'react-icons/fa';
import { getLedger, type LedgerOverview, type LedgerKind } from '../../../api/customerLedger';
import { customerMoney } from '../../../api/customer';
import { CustomerLedgerDetail } from './CustomerLedgerDetail';
import '../../../style/CustomerLedger.css';

export function CustomerLedger() {
  const [data, setData] = useState<LedgerOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('outstanding');
  const [selected, setSelected] = useState<{ id: number; kind: LedgerKind } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getLedger(controller.signal).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);
  async function refresh() {
    setLoading(true); setError('');
    try { setData(await getLedger()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  const customers = data?.customers.filter(c => `${c.name} ${c.email} ${c.phone}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (filter === 'all' || (filter === 'outstanding' ? c.due > 0 : c.due === 0))) ?? [];
  return <section className="customer-debt-workspace">
    {selected ? <CustomerLedgerDetail key={`${selected.kind}-${selected.id}`} kind={selected.kind} customerId={selected.id} onBack={() => setSelected(null)} onChanged={() => void refresh()} /> : <>
      <header className="debt-hero"><div><span className="debt-kicker">BLACKEYES / CUSTOMER ACCOUNTS</span><h2>Every payment.<br /><em>A clearer balance.</em></h2><p>Follow customer credit, record received payments, and keep the whole story in one place.</p></div><div className="debt-hero-mark" aria-hidden="true"><FaWallet /><span><FaCoins /></span></div></header>
      <div className="debt-totals"><article><span>Outstanding across customers</span><strong>{data && !error ? customerMoney(data.due) : '—'}</strong><small>{data ? `${data.owing_customers} customers with unpaid orders` : 'Loading accounts'}</small></article><article><span>Verified payments</span><strong>{data && !error ? customerMoney(data.paid) : '—'}</strong><small>Received against all customer orders</small></article><article><span>Total order charges</span><strong>{data && !error ? customerMoney(data.total) : '—'}</strong><small>All-time · Portal and walk-in customers</small></article></div>
      <section className="debt-panel"><div className="debt-section-heading"><div><span className="debt-kicker">CUSTOMER BALANCES</span><h3>Know where each account stands.</h3></div><button className="debt-button" disabled={loading} onClick={refresh}><FaSyncAlt /> Refresh</button></div><div className="debt-toolbar"><label><FaSearch /><input type="search" aria-label="Search customer balances" placeholder="Search customer, email, or phone…" value={query} onChange={e => setQuery(e.target.value)} /></label><select aria-label="Filter customer balances" value={filter} onChange={e => setFilter(e.target.value)}><option value="outstanding">Outstanding balances</option><option value="all">All customer accounts</option><option value="settled">Settled accounts</option></select></div>
        {error && <div className="alert alert-danger" role="alert">{error}</div>}{loading ? <div className="debt-empty" role="status">Loading customer balances…</div> : !error && <div className="debt-table-wrap"><table className="debt-table"><thead><tr><th>Customer</th><th>Orders</th><th>Charges</th><th>Received</th><th>Outstanding</th><th /></tr></thead><tbody>{customers.map(customer => <tr key={`${customer.kind}-${customer.id}`}><td><strong>{customer.name}</strong><small>{customer.kind === 'account' ? 'Portal account' : 'Walk-in contact'} · {customer.phone || customer.email || 'No contact details'}</small></td><td>{customer.order_count}<small>{customer.unpaid_orders} unpaid</small></td><td>{customerMoney(customer.total)}</td><td className="debt-paid-text">{customerMoney(customer.paid)}</td><td><span className={customer.due ? 'debt-due-badge' : 'debt-settled-badge'}>{customerMoney(customer.due)}</span></td><td><button className="debt-button" aria-label={`Open ledger for ${customer.name}`} onClick={() => setSelected({ id: customer.id, kind: customer.kind })}>View ledger <FaArrowRight /></button></td></tr>)}{!customers.length && <tr><td colSpan={6}><div className="debt-empty"><FaWallet /><h4>{filter === 'outstanding' && !query ? 'No outstanding customer balances.' : 'No matching customer accounts.'}</h4><p>Customers appear here once they have an order.</p></div></td></tr>}</tbody></table></div>}
      </section><p className="debt-footnote">All amounts in USD. Only verified receipts reduce outstanding balances. Totals cover all accounts; search and filters affect the list below.</p>
    </>}
  </section>;
}
