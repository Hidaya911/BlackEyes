import type { CustomerOrder } from '../../api/customer';

/** The same production instructions are visible to customers and press operators. */
export function OrderDesignSummary({ order, audience }: { order: CustomerOrder; audience: 'customer' | 'press' }) {
  return <>{order.items.map(item => (item.designs ?? []).map((design, index) => <div className="border rounded-3 p-3 mb-2" key={design.design_id}>
    <strong className="d-block small">{item.name} · Design {index + 1} · {design.quantity} {design.quantity === 1 ? 'unit' : 'units'}</strong>
    {design.brief && <p className="small text-secondary mt-2 mb-2" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{design.brief}</p>}
    {order.files.filter(file => file.design_id === design.design_id).map(file => <a className="d-block small mt-2" key={file.file_id} href={`/api/${audience}/orders/${order.order_id}/files/${file.file_id}`}>{file.name} · {file.verification_status === 'verified' ? 'Approved' : 'Awaiting artwork review'}</a>)}
    {!order.files.some(file => file.design_id === design.design_id) && <small className="text-secondary d-block mt-1">Design to be prepared by the press.</small>}
  </div>))}</>;
}
