import { useEffect, useState } from 'react';
import { adminRequest, type InventoryData } from '../../api/admin';

export function InventoryManager() {
  const [data, setData] = useState<InventoryData | null>(null);
  const [product, setProduct] = useState('');
  const [materials, setMaterials] = useState<{ item_id: number; quantity: number }[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function load() {
    setError('');
    try { setData(await adminRequest<InventoryData>('/inventory')); }
    catch (e) { setError((e as Error).message); }
  }
  useEffect(() => {
    let active = true;
    adminRequest<InventoryData>('/inventory').then(result => { if (active) setData(result); })
      .catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, []);
  function select(id: string) {
    setProduct(id); setNotice('');
    const saved = data?.materials.filter(m => m.product_id === Number(id)).map(m => ({ item_id: m.item_id, quantity: m.quantity })) ?? [];
    setMaterials(saved.length ? saved : [{ item_id: 0, quantity: 1 }]);
  }
  async function save() {
    setBusy(true); setError('');
    try {
      await adminRequest(`/inventory/products/${product}`, { method: 'PUT', body: JSON.stringify(materials) });
      setData(current => current && { ...current, materials: [...current.materials.filter(m => m.product_id !== Number(product)), ...materials.map(m => ({ ...m, product_id: Number(product) }))] });
      setNotice('Link saved. New order quantity × material quantity will be deducted from stock.');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="bg-white rounded-4 shadow-sm p-4 mt-4"><div className="d-flex justify-content-between"><h3>Inventory & material usage</h3><button className="btn btn-outline-dark" onClick={load}>Refresh stock</button></div>
    <p className="text-secondary">Link each product to the materials it uses. Stock is deducted when a new order is placed. Existing orders are unchanged. Purchases in Vendors replenish stock.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}{notice && <div className="alert alert-success" role="status">{notice}</div>}
    {!data ? <p>Loading inventory…</p> : <><div className="table-responsive"><table className="table"><thead><tr><th>Material</th><th>On hand</th><th>Alert at</th><th>Status</th></tr></thead><tbody>{data.items.map(i => <tr key={i.item_id}><td>{i.name}</td><td>{i.quantity} {i.unit}</td><td>{i.threshold} {i.unit}</td><td><span className={`badge ${i.low ? 'text-bg-danger' : 'text-bg-success'}`}>{i.low ? 'Low stock' : 'In stock'}</span></td></tr>)}{!data.items.length && <tr><td colSpan={4}>Record a vendor purchase to add inventory.</td></tr>}</tbody></table></div>
      <form onSubmit={e => { e.preventDefault(); void save(); }}><label className="d-block mb-3">Product<select className="form-select" value={product} onChange={e => select(e.target.value)} disabled={busy}><option value="">Select a product</option>{data.products.map(p => <option key={p.product_id} value={p.product_id}>{p.name}</option>)}</select></label>
        {product && <div className="border rounded-4 p-3 bg-light"><h5>Material quantity per product</h5><p className="small text-secondary">For A4: select A4 papers and enter 1 sheet. An order of 2 then uses 2 × 1 = 2 sheets.</p>{materials.map((m, index) => <div className="row g-2 mb-3 align-items-end" key={index}><div className="col-sm-6"><label className="d-block">Material<select aria-label={`Material ${index + 1}`} className="form-select" value={m.item_id || ''} required disabled={busy} onChange={e => setMaterials(current => current.map((row, n) => n === index ? { ...row, item_id: Number(e.target.value) } : row))}><option value="">Select material</option>{data.items.map(i => <option key={i.item_id} value={i.item_id}>{i.name} ({i.unit})</option>)}</select></label></div><div className="col-sm-4"><label className="d-block">Quantity per product ({data.items.find(i => i.item_id === m.item_id)?.unit || 'units'})<input aria-label={`Quantity per product ${index + 1}`} className="form-control" type="number" min="0.001" step="0.001" required disabled={busy} value={m.quantity} onChange={e => setMaterials(current => current.map((row, n) => n === index ? { ...row, quantity: Number(e.target.value) } : row))} /></label></div><div className="col-sm-2"><button type="button" className="btn btn-outline-danger" disabled={busy || materials.length === 1} onClick={() => setMaterials(current => current.filter((_, n) => n !== index))}>Remove</button></div></div>)}<button type="button" className="btn btn-outline-dark me-2" disabled={busy} onClick={() => setMaterials([...materials, { item_id: 0, quantity: 1 }])}>Add material</button><button className="btn btn-dark" disabled={busy || !materials.length}>{busy ? 'Saving…' : 'Save material link'}</button></div>}
      </form></>}
    {data && <div className="mt-4"><h5>Saved product links</h5>{data.products.map(p => {
      const links = data.materials.filter(m => m.product_id === p.product_id);
      return <div key={p.product_id} className="d-flex justify-content-between gap-3 border-bottom py-3"><div><strong>{p.name}</strong><div className={links.length ? 'text-secondary small' : 'text-warning-emphasis small'}>{links.length ? links.map(m => `${m.quantity} ${data.items.find(i => i.item_id === m.item_id)?.unit ?? 'units'} of ${data.items.find(i => i.item_id === m.item_id)?.name ?? 'material'} per product`).join(' + ') : 'Not linked — orders will not deduct stock'}</div></div><button className="btn btn-sm btn-outline-dark" onClick={() => select(String(p.product_id))}>Configure</button></div>;
    })}</div>}
  </section>;
}
