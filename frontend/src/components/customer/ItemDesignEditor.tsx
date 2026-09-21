import { useState } from 'react';
import { FaFileUpload, FaPlus, FaTrash } from 'react-icons/fa';
import type { DesignDraft } from '../../api/customer';
import { emptyDesign } from '../../utils/customerDesigns';
import '../../style/ItemDesignEditor.css';

export function ItemDesignEditor({ quantity, designs, onChange }: { quantity: number; designs: DesignDraft[]; onChange: (designs: DesignDraft[]) => void }) {
  const [error, setError] = useState('');
  const allocated = designs.reduce((sum, d) => sum + d.quantity, 0);
  function update(index: number, changes: Partial<DesignDraft>) {
    onChange(designs.map((d, i) => i === index ? { ...d, ...changes } : d));
  }
  function choose(index: number, file?: File) {
    if (!file) return;
    setError('');
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError('Choose a non-empty PDF, PNG or JPG, up to 10 MB.'); return;
    }
    update(index, { file, upload_name: file.name });
  }
  function add() {
    if (designs.length === 1 && designs[0].quantity === quantity && quantity > 1)
      onChange([{ ...designs[0], quantity: quantity - 1 }, emptyDesign(1)]);
    else onChange([...designs, emptyDesign(Math.max(1, quantity - allocated))]);
  }
  return <section className="item-design-editor"><div className="item-design-heading"><div><small>MAKE IT YOURS</small><h4>Your designs</h4></div><span className={allocated === quantity ? '' : 'allocation-warning'}>{allocated} / {quantity} units assigned</span></div><p className="item-design-help">One design can cover all units. Add another design to split the quantity—for example, two mugs with a different design on each.</p>
    {designs.map((design, index) => <div className="item-design-card" key={index}><div className="item-design-card-top"><strong>Design {index + 1}{designs.length === 1 ? ' · Shared across all units' : ''}</strong>{designs.length > 1 && <button type="button" aria-label={`Remove design ${index + 1}`} onClick={() => { const next = designs.filter((_, n) => n !== index); onChange(next.length === 1 ? [{ ...next[0], quantity }] : next); }}><FaTrash /></button>}</div>
      <label className="customer-field"><span>Units using this design</span><input className="form-control" type="number" min={1} max={quantity || 1} step={1} required value={design.quantity || ''} disabled={designs.length === 1} onChange={e => update(index, { quantity: Number(e.target.value) })} /></label>
      <label className="item-design-upload"><FaFileUpload /><span>{design.file ? 'Replace design file' : 'Attach your design'}<small>PDF, PNG or JPG · Up to 10 MB</small></span><input type="file" aria-label={`Upload design ${index + 1}`} accept="application/pdf,image/png,image/jpeg" onChange={e => { choose(index, e.target.files?.[0]); e.target.value = ''; }} /></label>
      {design.upload_name && <div className="item-design-filename"><span>{design.upload_name}{!design.file && <small> Reattach after refreshing the page</small>}</span><button type="button" aria-label={`Remove file ${design.upload_name}`} onClick={() => update(index, { file: undefined, upload_name: undefined })}><FaTrash /></button></div>}
      <label className="customer-field"><span>{design.file ? 'Design notes (optional)' : 'No file yet? Describe this design'}</span><textarea className="form-control" rows={2} required={!design.file} maxLength={4000} placeholder="Text, colours, names, or how you want this design to look…" value={design.brief} onChange={e => update(index, { brief: e.target.value })} /></label>
    </div>)}
    <button className="btn btn-sm btn-outline-dark" type="button" disabled={designs.length >= Math.min(30, quantity)} onClick={add}><FaPlus /> Add a different design</button>
    {allocated !== quantity && <p className="text-danger small mt-2" role="alert">Assign exactly {quantity} units across your designs.</p>}{error && <p className="text-danger small mt-2" role="alert">{error}</p>}
  </section>;
}
