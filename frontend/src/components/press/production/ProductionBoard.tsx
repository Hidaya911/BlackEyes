import { useState } from 'react';
import type { PressOrder } from '../../../api/press';
import '../../../style/ProductionBoard.css';

export const productionStages = ['Queued', 'In Prepress', 'Printing', 'Finishing', 'Ready for Pickup'] as const;

interface Props {
  orders: PressOrder[];
  busy: boolean;
  onReview: (order: PressOrder) => void;
  onMove: (order: PressOrder, stage: string) => void;
}

export function ProductionBoard({ orders, busy, onReview, onMove }: Props) {
  const [dragged, setDragged] = useState<number | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const awaiting = orders.filter(order => order.production_stage === 'Awaiting review');
  return <div className="production-workspace">
    <div className="production-intro"><div><small>FROM BRIEF TO FINISHED PRINT</small><h3>The production floor</h3><p>Drag a card to a stage, or use its Move to menu. Open review to check artwork and payment.</p></div><span>{orders.length - awaiting.length} production jobs</span></div>
    <section className="production-inbox" aria-label="Awaiting review"><strong>Awaiting review · {awaiting.length}</strong><div>{awaiting.map(order => <button key={order.order_id} disabled={busy} onClick={() => onReview(order)}>Review #{order.order_id} · {order.customer_name}</button>)}{!awaiting.length && <span>All incoming orders have been reviewed.</span>}</div></section>
    <div className="production-board" aria-label="Production board" aria-busy={busy}>
      {productionStages.map((stage, index) => {
        const jobs = orders.filter(order => order.production_stage === stage);
        return <section key={stage} aria-label={stage} className={`production-lane lane-${index}${over === stage ? ' is-over' : ''}`}
          onDragOver={event => { if (!busy && dragged !== null) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setOver(stage); } }}
          onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null); }}
          onDrop={event => { event.preventDefault(); const order = orders.find(row => row.order_id === dragged); setDragged(null); setOver(null); if (!busy && order && order.production_stage !== stage) onMove(order, stage); }}>
          <div className="production-lane-heading"><span>0{index + 1}</span><h4>{stage}</h4><b>{jobs.length}</b></div>
          <div className="production-lane-cards">{jobs.map(order => <article className="production-card" key={order.order_id} draggable={!busy} aria-label={`Order #${order.order_id}`}
            onDragStart={event => { if (busy) { event.preventDefault(); return; } setDragged(order.order_id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(order.order_id)); }}
            onDragEnd={() => { setDragged(null); setOver(null); }}>
            <small>ORDER #{order.order_id} · {order.order_type === 'walk_in' ? 'COUNTER' : 'PORTAL'}</small><h5>{order.customer_name}</h5><p>{order.items.map(item => `${item.quantity} × ${item.name}`).join(', ')}</p>
            {order.files.some(file => file.verification_status !== 'verified') && <span className="production-artwork-warning">Artwork needs approval</span>}
            <button disabled={busy} onClick={() => onReview(order)}>Review order</button>
            <label>Move to<select aria-label={`Move order #${order.order_id} to`} disabled={busy} value={stage} onChange={event => onMove(order, event.target.value)}>{productionStages.map(value => <option key={value}>{value}</option>)}</select></label>
          </article>)}{!jobs.length && <p className="production-empty">No jobs here yet<br /><small>Drop an order into this stage</small></p>}</div>
        </section>;
      })}
    </div>
  </div>;
}
