import { useEffect, useRef, useState } from 'react';
import { FaCheckCircle, FaFileInvoiceDollar, FaMagic, FaUpload } from 'react-icons/fa';
import { parseVendorInvoice, type ParsedInvoice } from '../../api/invoiceOcr';
import type { Vendor } from '../../api/vendors';
import type { InventoryItem, PurchaseInput, VendorPurchase } from '../../api/vendorLedger';
import { saveExtractedPurchases } from '../../api/vendorLedger';
import { VendorPurchaseModal } from './VendorPurchaseModal';
import '../../style/VendorInvoiceParser.css';

interface Draft { key: string; values: Partial<PurchaseInput>; saved: boolean }
export function VendorInvoiceParser({ adminId, vendors, items, purchases, onSaved }: {
  adminId: number; vendors: Vendor[]; items: InventoryItem[]; purchases: VendorPurchase[]; onSaved: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [invoice, setInvoice] = useState<ParsedInvoice | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [vendor, setVendor] = useState('');
  const [reference, setReference] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const previewUrl = useRef('');
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => () => URL.revokeObjectURL(previewUrl.current), []);

  function chooseFile(next?: File) {
    URL.revokeObjectURL(previewUrl.current); previewUrl.current = '';
    request.current?.abort(); setBusy(false); setError(''); setInvoice(null); setDrafts([]); setSelected(null); setPreview(''); setFile(null);
    if (!next) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(next.type)) { setError('Choose a JPEG, PNG or WebP image. Export PDF pages as images first.'); return; }
    if (next.size > 8 * 1024 * 1024) { setError('This image exceeds 8 MB. Resize it and try again.'); return; }
    setFile(next); previewUrl.current = URL.createObjectURL(next); setPreview(previewUrl.current);
  }
  async function extract() {
    if (!file || busy) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      const parsed = await parseVendorInvoice(file, controller.signal);
      if (controller.signal.aborted) return;
      setInvoice(parsed); setReference(parsed.invoice_reference); setDate(parsed.purchase_date);
      setVendor(parsed.suggested_vendor_id ? String(parsed.suggested_vendor_id) : '');
      setDrafts(parsed.items.map(row => ({ key: crypto.randomUUID(), saved: false, values: {
        item_name: row.item_name, quantity: row.quantity,
        unit_price: parsed.currency === 'USD' ? row.unit_price : '', unit: row.unit || '', item_type: row.item_type || 'other',
      } })));
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to parse invoice.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  function addManual() {
    const key = crypto.randomUUID();
    setDrafts(current => [...current, { key, saved: false, values: { item_name: '', quantity: '', unit_price: '', unit: '', item_type: 'other' } }]);
    setSelected(key);
  }
  const draft = drafts.find(row => row.key === selected);
  const duplicate = !!reference.trim() && purchases.some(row => row.vendor_id === Number(vendor) && row.invoice_reference?.trim().toLowerCase() === reference.trim().toLowerCase());
  const savedCount = drafts.filter(row => row.saved).length;
  async function saveAll() {
    if (saveLock.current) return;
    const pending = drafts.filter(row => !row.saved);
    if (!vendor || !date || !pending.length) { setError('Choose a vendor and invoice date before saving.'); return; }
    if (pending.some(row => !row.values.item_name?.trim() || !row.values.unit?.trim() || !row.values.quantity || !row.values.unit_price)) {
      setError('Some rows need a material name, unit, quantity or USD price. Use Review purchase to complete those rows first.'); return;
    }
    saveLock.current = true; setSaving(true); setError('');
    try {
      await saveExtractedPurchases(adminId, Number(vendor), pending.map(row => ({
        item_id: null, item_name: '', item_type: 'other', unit: '', low_stock_threshold: '0',
        quantity: '', unit_price: '', initial_payment: '0', payment_method: 'cash', ...row.values,
        request_key: row.key, purchase_date: date, invoice_reference: reference,
      })));
      const keys = new Set(pending.map(row => row.key));
      setDrafts(current => current.map(row => keys.has(row.key) ? { ...row, saved: true } : row));
      onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Unable to save extracted purchases.'); }
    finally { saveLock.current = false; setSaving(false); }
  }

  return <section className="invoice-parser" aria-label="AI vendor invoice parser">
    <fieldset disabled={saving} style={{ minWidth: 0 }}>
    <header className="invoice-parser-heading"><div><span className="invoice-ai-badge"><FaMagic aria-hidden="true" /> AI ASSIST · TESSERACT OCR</span><h2>From paper to purchase.</h2><p>Scan a vendor invoice, review the suggestions, and record the materials received.</p></div><FaFileInvoiceDollar className="invoice-hero-icon" aria-hidden="true" /></header>
    <div className="invoice-steps"><span><b>01</b> Upload</span><span><b>02</b> Review</span><span><b>03</b> Record in ledger</span></div>
    <div className="invoice-upload-row">
      <label className="invoice-upload"><FaUpload aria-hidden="true" /><strong>{file?.name || 'Choose an invoice photo or scan'}</strong><small>JPEG, PNG or WebP · up to 8 MB / 16 megapixels</small><input aria-label="Invoice image" type="file" accept="image/jpeg,image/png,image/webp" disabled={busy || !!selected} onChange={event => chooseFile(event.target.files?.[0])} /></label>
      <div className="invoice-upload-action"><button className="btn vendor-primary" disabled={!file || busy || !!invoice} onClick={() => void extract()}><FaMagic className="me-2" />{busy ? 'Reading invoice…' : invoice ? 'Invoice analyzed' : 'Extract invoice'}</button><small>Processed locally. Review before saving.</small></div>
    </div>
    {busy && <p role="status" className="invoice-progress">Reading text and locating item amounts… This may take up to 30 seconds.</p>}
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {invoice && <div className="invoice-review-grid">
      <aside className="invoice-original"><h3>Original invoice</h3>{preview && <a href={preview} target="_blank" rel="noreferrer" aria-label="Open full invoice image"><img src={preview} alt="Uploaded vendor invoice for comparison" /></a>}<small>Open the image to inspect the original.</small><details><summary>Extracted text</summary><pre>{invoice.raw_text}</pre></details></aside>
      <div className="invoice-review">
        <div className="invoice-review-title"><h3>Review the extraction</h3><span title="Average OCR word recognition score, not field accuracy">Text quality {Math.round(invoice.text_confidence)} / 100</span></div>
        <div className="invoice-notes">{invoice.warnings.map(note => <p key={note}>{note}</p>)}</div>
        <div className="invoice-metadata">
          <label>Vendor account<select className="form-select" value={vendor} onChange={event => setVendor(event.target.value)}><option value="">Choose vendor</option>{vendors.map(item => <option key={item.vendor_id} value={item.vendor_id}>{item.name}</option>)}</select></label>
          <label>Invoice reference<input className="form-control" maxLength={100} value={reference} onChange={event => setReference(event.target.value)} placeholder="Confirm invoice reference" /></label>
          <label>Invoice date<input className="form-control" type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
          <div className="invoice-detected-total"><span>Printed invoice total</span><strong>{invoice.total ?? 'Not detected'} <small>{invoice.currency || 'currency unconfirmed'}</small></strong>{invoice.subtotal && <small>Subtotal: {invoice.subtotal}</small>}{invoice.tax && <small>Tax / VAT: {invoice.tax}</small>}</div>
        </div>
        {duplicate && <p className="alert alert-warning" role="status">This vendor and reference already appear in the ledger. Check existing purchases before adding more lines.</p>}
        {!vendors.length && <p className="alert alert-info">Add a vendor to your directory above before recording purchases.</p>}
        <div className="invoice-line-heading"><h4>Suggested item rows</h4><span aria-live="polite">{savedCount} of {drafts.length} recorded</span></div>
        <div className="invoice-lines">{drafts.map((row, index) => <article key={row.key}>
          <div><strong>{row.values.item_name || 'Manual item'}</strong>{invoice.items[index] && <><p>{invoice.items[index].quantity} × {invoice.items[index].unit_price} · printed amount {invoice.items[index].line_total}</p><details><summary>Source text</summary><small>{invoice.items[index].source}</small></details>{invoice.items[index].warning && <p className="text-danger">{invoice.items[index].warning}</p>}</>}</div>
          <button className={`btn ${row.saved ? 'btn-light' : 'btn-outline-dark'}`} disabled={!vendor || row.saved} onClick={() => setSelected(row.key)}>{row.saved ? <><FaCheckCircle /> Recorded</> : 'Review purchase'}</button>
        </article>)}</div>
        {!drafts.length && <p className="text-secondary">Use the extracted text to enter a material purchase below.</p>}
        <button className="btn btn-light mt-3" disabled={!vendor} onClick={addManual}>+ Add missing item</button>
        <div className="invoice-save-bar">
          <button type="button" className="btn vendor-primary" disabled={saving || !vendor || !date || savedCount === drafts.length || !!selected} onClick={() => void saveAll()}>
            <FaCheckCircle className="me-2" />{saving ? 'Saving purchases…' : savedCount === drafts.length && drafts.length ? 'All purchases saved' : 'Save extracted purchases'}
          </button>
          <small>Save all remaining items in one vendor order and update inventory. Materials only; VAT and fees are excluded.</small>
        </div>
        <p className="invoice-ledger-note">All invoice items belong to one vendor order, with a combined balance and payment history. Taxes and fees are not added automatically.</p>
      </div>
    </div>}
    {draft && <VendorPurchaseModal key={draft.key} adminId={adminId} vendors={vendors} items={items} initialVendor={vendor}
      initialDraft={{ ...draft.values, request_key: draft.key, invoice_reference: reference, purchase_date: date }}
      onClose={() => setSelected(null)} onSaved={() => { setDrafts(current => current.map(row => row.key === draft.key ? { ...row, saved: true } : row)); setSelected(null); onSaved(); }} />}
    </fieldset>
  </section>;
}
