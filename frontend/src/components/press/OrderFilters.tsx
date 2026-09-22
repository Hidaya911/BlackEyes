import { productionStages } from './production/ProductionBoard';
import type { OrderFiltersValue } from '../../utils/orderFilters';
import '../../style/OrderFilters.css';

export function OrderFilters({ value, onChange, onReset, count, total, loading }: { value: OrderFiltersValue; onChange: (value: OrderFiltersValue) => void; onReset: () => void; count: number; total: number; loading: boolean }) {
  const update = (key: keyof OrderFiltersValue, next: string) => onChange({ ...value, [key]: next });
  const invalid = !!(value.from && value.to && value.from > value.to);
  return <section className="order-filters" aria-label="Order filters"><div className="order-filter-heading"><div><strong>Find the right orders</strong><small>Order dates · {Intl.DateTimeFormat().resolvedOptions().timeZone} · both dates included</small></div><button type="button" className="btn btn-sm btn-outline-secondary" onClick={onReset}>Clear filters</button></div><div className="order-filter-fields">
    <label>From date<input className="form-control" type="date" value={value.from} max={value.to || undefined} onChange={event => update('from', event.target.value)} /></label>
    <label>To date<input className="form-control" type="date" value={value.to} min={value.from || undefined} onChange={event => update('to', event.target.value)} /></label>
    <label>Production stage<select className="form-select" value={value.stage} onChange={event => update('stage', event.target.value)}><option value="">All stages</option>{['Awaiting review', ...productionStages].map(stage => <option key={stage}>{stage}</option>)}</select></label>
    <label>Payment status<select className="form-select" value={value.payment} onChange={event => update('payment', event.target.value)}><option value="">All payments</option><option value="outstanding">Outstanding balance</option><option value="unpaid">Unpaid</option><option value="partial">Partially paid</option><option value="paid">Fully paid</option></select></label>
    <label>Order channel<select className="form-select" value={value.channel} onChange={event => update('channel', event.target.value)}><option value="">All channels</option><option value="walk_in">At the counter</option><option value="online">Online</option></select></label>
    <label>Artwork<select className="form-select" value={value.artwork} onChange={event => update('artwork', event.target.value)}><option value="">All artwork</option><option value="pending">Needs approval</option><option value="approved">All files approved</option><option value="none">No files / brief only</option></select></label>
  </div>{invalid && <p className="text-danger mt-3 mb-0" role="alert">From date must be on or before To date.</p>}<p className="order-filter-count" role="status">{loading ? 'Loading orders…' : `${count} of ${total} orders match`} · Filters apply to both views.</p></section>;
}
