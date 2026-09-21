import type { PressOrder } from '../../../api/press';
import { customerMoney } from '../../../api/customer';
import logo from '../../../assets/blackeyes LOGO.png';

export interface OrderDocument {
  kind: 'invoice' | 'receipt'; number: string; generated_at: string;
  payment_confirmed_at: string | null; order: PressOrder;
}

const date = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function DocumentPaper({ document }: { document: OrderDocument }) {
  const { order, kind } = document;
  const receipt = kind === 'receipt';
  const subtotal = order.items.reduce((sum, item) => sum + item.subtotal, 0);
  return <article className={`document-paper ${receipt ? 'receipt-paper' : 'invoice-paper'}`}>
    <div className="paper-color-strip"><i /><i /><i /><i /></div>
    <header className="paper-header"><img src={logo} alt="Blackeyes printing press" /><div className="paper-document-id"><span>BLACKEYES / PRINT STUDIO</span><h1>{receipt ? 'Receipt' : 'Invoice'}<b>.</b></h1><strong>{document.number}</strong></div></header>
    <div className="paper-intro"><span>{receipt ? 'PAYMENT RECEIVED. THANK YOU.' : 'GREAT IDEAS. BEAUTIFULLY PRINTED.'}</span><span>ORDER #{String(order.order_id).padStart(6, '0')}</span></div>
    <section className="paper-parties"><div><small>{receipt ? 'RECEIVED FROM' : 'BILL TO'}</small><h2>{order.customer_name}</h2>{order.customer_email && <p>{order.customer_email}</p>}<p>{order.contact_phone}</p>{order.customer_address && <p>{order.customer_address}</p>}</div><dl><div><dt>Order date</dt><dd>{date(order.created_at)}</dd></div><div><dt>Prepared on</dt><dd>{date(document.generated_at)} · UTC</dd></div><div><dt>Order channel</dt><dd>{order.order_type === 'walk_in' ? 'At the press' : 'Online'}</dd></div><div><dt>Currency</dt><dd>USD</dd></div></dl></section>
    {receipt && <section className="receipt-amount"><div><span>TOTAL VERIFIED PAYMENT</span><strong>{customerMoney(order.amount_paid)}</strong><p>{order.amount_due > 0 ? 'Partial payment received' : 'Order paid in full'}</p></div><div className="receipt-seal">PAYMENT<br /><b>VERIFIED</b></div></section>}
    <table className="paper-items"><thead><tr><th>Item / description</th><th>Qty</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={item.order_item_id}><td><span className="paper-item-index">{String(index + 1).padStart(2, '0')}</span><strong>{item.name}</strong>{item.specifications && <p>{item.specifications}</p>}</td><td>{item.quantity}</td><td>{customerMoney(item.unit_price)}</td><td>{customerMoney(item.subtotal)}</td></tr>)}</tbody></table>
    <section className="paper-settlement"><div className="paper-payment"><small>PAYMENT DETAILS</small><h3>{order.payment_method === 'cash' ? 'Cash at the press' : 'Whish Money'}</h3>{order.payment_reference && <p>Reference: {order.payment_reference}</p>}{document.payment_confirmed_at && <p>Verified on {date(document.payment_confirmed_at)} (UTC)</p>}<p>{receipt ? 'This receipt acknowledges the total verified payment currently recorded for this order.' : order.amount_due > 0 ? 'Please include the order number with your payment.' : 'Thank you. No balance remains on this order.'}</p></div><dl className="paper-totals"><div><dt>Items subtotal</dt><dd>{customerMoney(subtotal)}</dd></div>{order.total !== subtotal && <div><dt>Additional order charges</dt><dd>{customerMoney(order.total - subtotal)}</dd></div>}<div><dt>Order total</dt><dd>{customerMoney(order.total)}</dd></div><div><dt>Verified payment</dt><dd>{customerMoney(order.amount_paid)}</dd></div><div className="paper-balance"><dt>Balance due</dt><dd>{customerMoney(order.amount_due)}</dd></div></dl></section>
    <footer className="paper-footer"><div><strong>Thank you for choosing Blackeyes.</strong><span>Ideas into ink. Details into impact.</span></div><p>{receipt ? 'Payment summary' : 'Order invoice'} · {document.number}<br />Prepared {date(document.generated_at)} · Keep this copy for your records.</p></footer>
  </article>;
}
