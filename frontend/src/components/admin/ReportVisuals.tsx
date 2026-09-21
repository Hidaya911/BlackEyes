import { useState } from 'react';
import { usd, type AdminReport } from '../../api/admin';

export function SalesChart({ daily }: { daily: AdminReport['daily'] }) {
  const [selected, setSelected] = useState<number | null>(null);
  const points = daily.slice(-30);
  const max = Math.max(1, ...points.map(p => Number(p.sales)));
  const active = selected === null ? points.length - 1 : Math.min(selected, points.length - 1);
  return <section className="insight-card sales-panel"><div className="insight-card-heading"><div><span className="insight-eyebrow">SALES PULSE</span><h3>Your press, in motion</h3></div><span className="insight-chip">Last {points.length} active days</span></div>
    {points.length ? <><div className="sales-readout"><strong>{usd(points[active]?.sales ?? 0)}</strong><span>{points[active]?.date} · order sales</span></div><div className="sales-bars" role="group" aria-label="Daily sales chart">{points.map((p, i) => <button key={p.date} className={`sales-bar-slot ${i === active ? 'is-active' : ''}`} onMouseEnter={() => setSelected(i)} onFocus={() => setSelected(i)} onClick={() => setSelected(i)} aria-label={`${p.date}: ${usd(p.sales)}`} aria-pressed={i === active}><span style={{ height: `${Math.max(2, Number(p.sales) / max * 100)}%` }} /></button>)}</div><div className="chart-axis"><span>{points[0].date}</span><span>Hover or select a day</span><span>{points[points.length - 1].date}</span></div></> : <div className="insight-empty">Your sales story starts with the first order.</div>}
  </section>;
}

export function ProductionChart({ stages, total }: { stages: Record<string, number>; total: number }) {
  const colors = ['#19b9c6', '#7667e8', '#f5ad56', '#e86c98', '#448ce0', '#56b79a'];
  const rows = Object.entries(stages);
  let offset = 0;
  const gradient = rows.map(([, count], i) => { const from = offset; offset += count / Math.max(1, total) * 100; return `${colors[i % colors.length]} ${from}% ${offset}%`; }).join(', ');
  return <section className="insight-card"><div className="insight-card-heading"><div><span className="insight-eyebrow">ON THE FLOOR</span><h3>Production mix</h3></div><span className="insight-chip">{rows.length} stages</span></div><div className="production-visual"><div className="production-ring" role="img" aria-label={`${total} orders across ${rows.length} production stages`} style={{ background: total ? `conic-gradient(${gradient})` : '#edf0f5' }}><div><strong>{total}</strong><span>total orders</span></div></div><div className="production-legend">{rows.map(([stage, count], i) => <div key={stage}><i style={{ background: colors[i % colors.length] }} /><span>{stage}</span><strong>{count}</strong></div>)}{!rows.length && <p>No jobs yet.</p>}</div></div></section>;
}

export function ProductRanking({ products }: { products: AdminReport['products'] }) {
  const max = Math.max(1, ...products.map(p => Number(p.sales)));
  return <section className="insight-card"><div className="insight-card-heading"><div><span className="insight-eyebrow">CUSTOMER FAVORITES</span><h3>Leading products</h3></div><span className="insight-chip">By sales</span></div>{products.slice(0, 5).map((p, i) => <div className="product-rank" key={`${p.name}-${i}`}><span className="rank-number">{String(i + 1).padStart(2, '0')}</span><div className="rank-detail"><div><strong>{p.name}</strong><span>{usd(p.sales)}</span></div><div className="rank-track"><i style={{ width: `${Number(p.sales) / max * 100}%` }} /></div><small>{p.quantity} units sold</small></div></div>)}{!products.length && <div className="insight-empty">Product performance will appear after your first sale.</div>}</section>;
}
