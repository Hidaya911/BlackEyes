import { useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { FaBoxOpen, FaPlus, FaSearch, FaStore } from 'react-icons/fa';
import { customerMoney } from '../../../api/customer';
import type { PressProduct } from '../../../api/press';
import '../../../style/CounterCatalog.css';

interface Props {
  products: PressProduct[];
  wholesale: boolean;
  disabled: boolean;
  onAdd: (product: PressProduct, quantity: number, specifications: string, price: string) => void;
}

function ProductImage({ product }: { product: PressProduct }) {
  const [failed, setFailed] = useState(false);
  return product.image_url && !failed ? <img src={product.image_url} alt={product.name} loading="lazy" onError={() => setFailed(true)} /> : <div className="counter-catalog-placeholder"><FaBoxOpen /><span>BLACKEYES PRINT STUDIO</span></div>;
}

function ConfigureItem({ product, onClose, onAdd }: { product: PressProduct; onClose: () => void; onAdd: Props['onAdd'] }) {
  const [quantity, setQuantity] = useState(1);
  const [specifications, setSpecifications] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const cents = price !== '' ? Math.round(Number(price) * 100) : product.price;
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); event.stopPropagation();
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000 || cents == null || (price !== '' && !/^\d+(\.\d{1,2})?$/.test(price)) || !Number.isFinite(cents) || cents < 0 || (price !== '' && cents > 99999999)) { setError('Enter a valid quantity and unit price with up to two decimal places.'); return; }
    onAdd(product, quantity, product.is_customizable ? specifications : '', price); onClose();
  }
  return <Modal show centered onHide={onClose} contentClassName="counter-configure" aria-labelledby="counter-configure-title"><Modal.Header closeButton><div><small>{product.is_customizable ? 'MAKE IT THEIR OWN' : 'ADD TO ORDER'}</small><Modal.Title id="counter-configure-title">{product.name}</Modal.Title></div></Modal.Header><form onSubmit={submit}><Modal.Body><div className="counter-configure-product"><ProductImage product={product} /><div><span className="counter-price-tag">{product.price_kind === 'wholesale' ? 'Wholesale price' : product.special_price ? 'Customer special price' : 'Retail price'}</span><strong>{product.price == null ? 'Price not set' : customerMoney(product.price)}</strong><p>{product.description || (product.is_customizable ? 'Choose the quantity and describe the print specifications.' : 'Choose the quantity to order.')}</p></div></div><label>Quantity<input className="form-control" type="number" min="1" max="100000" step="1" required value={quantity || ''} onChange={event => setQuantity(Number(event.target.value))} /></label>{product.is_customizable && <label>Specifications <small>optional</small><textarea className="form-control" rows={3} maxLength={2000} placeholder="Size, paper or material, color, sides, finishing…" value={specifications} onChange={event => setSpecifications(event.target.value)} /></label>}<label>Edit unit price (USD) <small>{product.price == null ? 'required until a wholesale price is set' : 'optional'}</small><input className="form-control" type="number" min="0" max="999999.99" step="0.01" required={product.price == null} placeholder={product.price == null ? 'Enter agreed unit price' : (product.price / 100).toFixed(2)} value={price} onChange={event => setPrice(event.target.value)} /></label><p className="counter-override-help">Leave blank to use the displayed price. An override applies only to this item in this order.</p><div className="counter-configure-total"><span>Item total</span><strong>{cents == null ? 'Price required' : customerMoney(cents * quantity)}</strong></div>{error && <p className="alert alert-danger mt-3" role="alert">{error}</p>}</Modal.Body><Modal.Footer><button type="button" className="btn btn-light" onClick={onClose}>Cancel</button><button className="btn counter-catalog-add" type="submit"><FaPlus /> Add to order</button></Modal.Footer></form></Modal>;
}

export function CounterCatalog({ products, wholesale, disabled, onAdd }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PressProduct | null>(null);
  const visible = products.filter(product => `${product.name} ${product.description ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="counter-catalog"><div className="counter-catalog-banner"><span className="counter-catalog-icon"><FaStore /></span><div><small>BLACKEYES / SHOP THE PRINT</small><h4>Your counter catalog</h4><p>Pick a product. Add the details. Build the order.</p></div><span className="counter-price-tag">{wholesale ? 'Wholesale prices' : 'Customer prices'}</span></div><label className="counter-catalog-search"><FaSearch /><input type="search" aria-label="Search counter catalog" placeholder="Search products or descriptions…" value={query} onChange={event => setQuery(event.target.value)} /></label><div className="counter-catalog-grid" aria-busy={disabled}>{visible.map(product => <button type="button" key={product.product_id} className="counter-catalog-card" disabled={disabled} aria-label={`${product.is_customizable ? 'Customize' : 'Add'} ${product.name}`} onClick={() => setSelected(product)}><div className="counter-catalog-image"><ProductImage product={product} /><span><FaPlus /></span></div><div className="counter-catalog-card-info"><h5>{product.name}</h5><p>{product.description || (product.is_customizable ? 'Made to your specifications' : 'Ready to order')}</p><div><strong>{disabled ? '…' : product.price == null ? 'Set agreed price' : customerMoney(product.price)}</strong><small>{product.price_kind === 'wholesale' ? 'Wholesale' : product.special_price ? 'Special' : 'Retail'} / unit</small></div><span>{product.is_customizable ? 'Choose & customize →' : 'Add to order →'}</span></div></button>)}</div>{!visible.length && <p className="counter-catalog-empty">{products.length ? 'No products match your search.' : 'No catalog products available. You can add a custom service below.'}</p>}{selected && !disabled && <ConfigureItem product={selected} onClose={() => setSelected(null)} onAdd={onAdd} />}</div>;
}
