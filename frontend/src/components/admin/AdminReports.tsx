import { useEffect, useState } from 'react';
import { adminRequest, usd, type AdminReport } from '../../api/admin';
import { FaArrowRight, FaBoxOpen, FaChartLine, FaCoins, FaDownload, FaExclamationTriangle, FaFileInvoiceDollar, FaSyncAlt, FaWallet } from 'react-icons/fa';
import { ProductRanking, ProductionChart, SalesChart } from './ReportVisuals';
import '../../style/AdminInsights.css';

export function AdminReports({ dashboard = false, onNavigate }: { dashboard?: boolean; onNavigate?: (section: string) => void }) {
  const [data, setData] = useState<AdminReport | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [applied, setApplied] = useState({ start: '', end: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (!dashboard && start) params.set('start', start);
      if (!dashboard && end) params.set('end', end);
      setData(await adminRequest<AdminReport>(`/reports?${params}`));
      setApplied({ start: dashboard ? '' : start, end: dashboard ? '' : end });
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    adminRequest<AdminReport>('/reports').then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  function exportCsv() {
    if (!data) return;
    const rows: (string | number)[][] = [['Report', 'Name', 'Quantity / orders', 'Sales USD', 'Outstanding USD'],
      ...data.products.map(p => ['Product', p.name, p.quantity, p.sales, '']),
      ...data.customers.map(c => ['Customer', c.name, c.orders, c.sales, c.due]),
      ...data.daily.map(d => ['Daily sales', d.date, '', d.sales, '']),
      ...data.usage.map(u => ['Material usage', `${u.name} (${u.unit})`, u.quantity, '', ''])];
    const csv = rows.map(row => row.map(value => { const text = String(value); return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`; }).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `blackeyes-report-${applied.start || 'all'}-${applied.end || 'current'}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  return <div className="admin-insights"><div className="insight-hero"><div><span className="insight-eyebrow">BLACKEYES / {dashboard ? 'STUDIO OVERVIEW' : 'BUSINESS INTELLIGENCE'}</span><h2>{dashboard ? 'A clear view of your press.' : 'Every order tells a story.'}</h2><p>{dashboard ? 'From the first sheet to the final pickup. Your sales, production, and materials in one place.' : 'Explore what sells, understand your customers, and keep every material accounted for.'}</p></div><div className="insight-actions"><button className="insight-button ghost" disabled={loading} onClick={load}><FaSyncAlt />Refresh</button>{dashboard ? <button className="insight-button primary" onClick={() => onNavigate?.('New walk-in order')}>New order <FaArrowRight /></button> : <button className="insight-button primary" disabled={!data || loading || !!error} onClick={exportCsv}><FaDownload />Export CSV</button>}</div></div>
    {!dashboard && <form className="insight-filter" onSubmit={e => { e.preventDefault(); void load(); }}><div className="me-auto"><span className="insight-eyebrow">YOUR REPORTING WINDOW</span><div className="small mt-1 text-secondary">Choose a period to explore</div></div><label>FROM (UTC)<input type="date" value={start} onChange={e => setStart(e.target.value)} /></label><label>THROUGH (UTC)<input type="date" min={start} value={end} onChange={e => setEnd(e.target.value)} /></label><button className="insight-button" disabled={loading}>Apply dates <FaArrowRight /></button></form>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{loading && <div className="insight-loading" role="status">Gathering your press insights…</div>}
    {data && !loading && !error && <><div className="insight-period"><i />{dashboard ? 'All-time performance' : `${applied.start || 'Beginning'} — ${applied.end || 'Today'}`}<span className="ms-auto">USD · Current stock & vendor balances</span></div>
      <div className="insight-metrics">{[
        { label: 'Order sales', value: usd(data.sales), caption: 'Value of placed orders', Icon: FaChartLine },
        { label: 'Orders', value: data.order_count, caption: 'Online & at the counter', Icon: FaBoxOpen },
        { label: 'Collected', value: usd(data.collected), caption: 'Verified payments', Icon: FaCoins },
        { label: 'Customer balances', value: usd(data.outstanding), caption: 'Awaiting collection', Icon: FaWallet },
        { label: 'Vendor balances', value: usd(data.vendor_due), caption: 'Current amount payable', Icon: FaFileInvoiceDollar },
      ].map(({ label, value, caption, Icon }) => <article className="insight-metric" key={label}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon /></span></div><strong>{value}</strong><small>{caption}</small></article>)}</div>
      <div className="insight-grid"><SalesChart daily={data.daily} /><ProductionChart stages={data.stages} total={data.order_count} /></div>
      <div className="insight-grid"><ProductRanking products={data.products} /><section className="insight-card stock-panel"><div className="insight-card-heading"><div><span className="insight-eyebrow">MATERIAL WATCH</span><h3>Keep the press running</h3></div><span className="insight-chip">{data.low_stock.length} alerts</span></div>{data.low_stock.length ? data.low_stock.map(i => <div className="stock-alert-row" key={i.id}><span><FaExclamationTriangle /></span><div><strong>{i.name}</strong><small>{Number(i.quantity)} {i.unit} left · alert at {Number(i.threshold)}</small></div></div>) : <div className="stock-clear">All stocked materials are above their alert threshold.</div>}<button className="insight-button" onClick={() => onNavigate?.('Products')}>Manage inventory <FaArrowRight /></button></section></div>
      {dashboard ? <section className="insight-card"><div className="insight-card-heading"><div><span className="insight-eyebrow">LATEST ACTIVITY</span><h3>Fresh from the order desk</h3></div><button className="insight-button" onClick={() => onNavigate?.('Orders')}>All orders <FaArrowRight /></button></div><div className="table-responsive"><table className="insight-table"><thead><tr><th>Order</th><th>Customer</th><th>Production stage</th><th>Order value</th></tr></thead><tbody>{data.recent.map(o => <tr key={o.id}><td>#{String(o.id).padStart(4, '0')}</td><td>{o.customer}</td><td><span className="order-stage">{o.stage}</span></td><td>{usd(o.total)}</td></tr>)}{!data.recent.length && <tr><td colSpan={4} className="insight-empty">Your latest orders will appear here.</td></tr>}</tbody></table></div></section> : <div className="report-tables">
        <ReportTable title="Product sales" headers={['Product', 'Units sold', 'Sales']} rows={data.products.map(p => [p.name, p.quantity, usd(p.sales)])} />
        <ReportTable title="Customer activity & balances" headers={['Customer', 'Type', 'Orders', 'Sales', 'Outstanding']} rows={data.customers.map(c => [c.name, c.kind === 'account' ? 'Portal' : 'Walk-in', c.orders, usd(c.sales), usd(c.due)])} />
        <ReportTable title="Daily sales" headers={['Date (UTC)', 'Sales']} rows={data.daily.map(d => [d.date, usd(d.sales)])} />
        <ReportTable title="Material usage" headers={['Material', 'Used', 'Unit']} rows={data.usage.map(u => [u.name, Number(u.quantity), u.unit])} />
      </div>}
      <p className="insight-footnote">Sales follow order creation dates. Collections are current verified payments for those orders. Material usage follows deduction dates. Stock alerts and vendor balances show the current position.</p>
    </>}
  </div>;
}

function ReportTable({ title, headers, rows }: { title: string; headers: string[]; rows: (string | number)[][] }) {
  return <section className="insight-card"><div className="insight-card-heading"><div><span className="insight-eyebrow">IN DETAIL</span><h3>{title}</h3></div><span className="insight-chip">{rows.length} records</span></div><div className="table-responsive"><table className="insight-table"><thead><tr>{headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{row.map((value, n) => <td key={n}>{value}</td>)}</tr>)}{!rows.length && <tr><td colSpan={headers.length} className="insight-empty">No records in this period.</td></tr>}</tbody></table></div></section>;
}
