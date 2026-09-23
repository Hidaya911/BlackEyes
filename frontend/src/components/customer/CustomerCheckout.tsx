import { useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { FaArrowLeft, FaArrowRight, FaCheck, FaTrash } from 'react-icons/fa';
import { customerMoney, placeCustomerOrder, readFileData, type CartLine, type CustomerOrder, type CustomerProduct } from '../../api/customer';
import { ItemDesignEditor } from './ItemDesignEditor';
import { attachmentError, designError, emptyDesign, resizeDesigns } from '../../utils/customerDesigns';

interface Props {
  cart: CartLine[]; products: CustomerProduct[]; phone: string;
  onChange: (cart: CartLine[]) => void; onClose: () => void;
  onPlaced: (order: CustomerOrder) => void; onRefresh: () => Promise<void>;
}

export function CustomerCheckout({ cart, products, phone, onChange, onClose, onPlaced, onRefresh }: Props) {
  const [step, setStep] = useState(0);
  const [contactPhone, setContactPhone] = useState(phone);
  const [requestKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lines = cart.map(line => {
    const product = products.find(p => p.product_id === line.product_id);
    return { ...line, product, ...(product && !product.is_customizable ? { designs: [], specifications: '' } : {}) };
  });
  const total = lines.reduce((sum, line) => sum + (line.product?.price ?? 0) * line.quantity, 0);
  const unavailable = lines.some(line => !line.product || line.product.price == null);
  function update(id: number, patch: Partial<CartLine>) { onChange(cart.map(line => line.product_id === id ? { ...line, ...patch } : line)); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (!cart.length || unavailable || busy) return;
    for (const line of lines) {
      const failure = line.product?.is_customizable ? designError(line.quantity, line.designs ?? []) : '';
      if (failure) { setStep(0); setError(`${line.product?.name}: ${failure}`); return; }
    }
    const failure = attachmentError(lines);
    if (failure) { setStep(0); setError(failure); return; }
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true);
    try {
      const items = await Promise.all(lines.map(async line => ({
        product_id: line.product_id, quantity: line.quantity, specifications: line.specifications,
        designs: await Promise.all((line.designs ?? []).map(async design => ({
          quantity: design.quantity, brief: design.brief,
          ...(design.file ? { file: { name: design.file.name, data_url: await readFileData(design.file) } } : {}),
        }))),
      })));
      onPlaced(await placeCustomerOrder({ request_key: requestKey, items, files: [], design_request_note: '', contact_phone: contactPhone, expected_total: total, payment_method: 'cash', payment_timing: 'after_pickup' }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to place order. Your basket has been kept.'); }
    finally { setBusy(false); }
  }
  return <Modal show onHide={() => !busy && onClose()} size="lg" centered scrollable backdrop={busy ? 'static' : true} keyboard={!busy} contentClassName="customer-modal" aria-labelledby="checkout-title"><Modal.Header closeButton={!busy}><Modal.Title id="checkout-title">Your next great print.</Modal.Title></Modal.Header><form onSubmit={submit}><Modal.Body>
    <ol className="customer-checkout-steps">{['Items & designs', 'Contact & collection', 'Review'].map((label, index) => <li key={label} className={index <= step ? 'is-active' : ''}><b>{index < step ? <FaCheck /> : index + 1}</b>{label}</li>)}</ol>
    {!cart.length ? <div className="customer-empty"><h3>Your basket is empty.</h3><p>Add a product to start your print project.</p></div> : <fieldset disabled={busy}>
      {step === 0 && <div className="customer-cart-lines">{lines.map(line => <article key={line.product_id}><div className="customer-cart-line-heading"><div><h3>{line.product?.name || 'Unavailable product'}</h3><small>{line.product?.price != null ? `${customerMoney(line.product.price)} per unit` : 'Remove this item to continue.'}</small></div><button className="customer-icon-button" type="button" aria-label={`Remove ${line.product?.name || 'unavailable product'}`} onClick={() => onChange(cart.filter(item => item.product_id !== line.product_id))}><FaTrash /></button></div>
        <div className="customer-cart-line-fields"><label className="customer-field"><span>Quantity</span><input className="form-control" type="number" min={1} max={100000} step={1} required value={line.quantity || ''} onChange={e => { const quantity = Number(e.target.value); update(line.product_id, { quantity, designs: line.product?.is_customizable ? resizeDesigns(line.designs, quantity) : [] }); }} /></label>{line.product?.is_customizable && <label className="customer-field"><span>Print details</span><input className="form-control" maxLength={2000} value={line.specifications} placeholder="Size, colour, finish…" onChange={e => update(line.product_id, { specifications: e.target.value })} /></label>}<strong>{customerMoney((line.product?.price ?? 0) * line.quantity)}</strong></div>
        {line.product?.is_customizable && <ItemDesignEditor quantity={line.quantity} designs={line.designs?.length ? line.designs : [emptyDesign(line.quantity)]} onChange={designs => update(line.product_id, { designs })} />}
      </article>)}</div>}
      {step === 1 && <div className="customer-checkout-details"><h3>We’ll see you at the press.</h3><label className="customer-field"><span>Contact phone *</span><input className="form-control" type="tel" required minLength={3} maxLength={50} value={contactPhone} onChange={e => setContactPhone(e.target.value)} /></label><div className="customer-notice mt-3"><strong>Pay locally at the press</strong><p className="mb-0 mt-2">Collect your order and pay in cash at the press. No online payment is required. Staff will confirm the payment when it is received.</p></div></div>}
      {step === 2 && <div className="customer-review"><h3>One last look.</h3><p>We’ll review each design and its assigned quantity before production.</p>{lines.map(line => <section key={line.product_id}><div className="customer-review-row"><span>{line.quantity} × {line.product?.name}<small>{line.specifications}</small></span><strong>{customerMoney((line.product?.price ?? 0) * line.quantity)}</strong></div>{line.designs?.map((design, index) => <div className="item-design-review" key={index}><strong>Design {index + 1} · {design.quantity} units</strong><small>{design.file?.name || 'Design requested from the press'}</small>{design.brief && <small>{design.brief}</small>}</div>)}</section>)}<div className="customer-review-notes"><strong>Contact & payment</strong><p>{contactPhone}</p><p>Cash at the press · Pay when collecting.</p></div></div>}
      <div className="customer-checkout-total"><span>Total <small>USD</small></span><strong>{customerMoney(total)}</strong></div>
    </fieldset>}
    {error && <div className="alert alert-danger mt-3" role="alert">{error}<button type="button" className="btn btn-sm btn-outline-danger d-block mt-2" disabled={busy} onClick={async () => { try { await onRefresh(); setStep(0); setError('Catalog refreshed. Review your items and designs.'); } catch (e) { setError((e as Error).message); } }}>Refresh catalog</button></div>}
  </Modal.Body><Modal.Footer><button type="button" className="btn btn-light" disabled={busy} onClick={() => step ? setStep(step - 1) : onClose()}><FaArrowLeft /> {step ? 'Back' : 'Keep exploring'}</button><button className="customer-button" type="submit" disabled={busy || !cart.length || unavailable}>{busy ? 'Placing order…' : step === 2 ? 'Place order' : 'Continue'} <FaArrowRight /></button></Modal.Footer></form></Modal>;
}
