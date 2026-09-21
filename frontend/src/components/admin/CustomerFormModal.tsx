import { useState } from 'react';
import { Modal } from 'react-bootstrap';
import { FaArrowRight, FaCheck, FaEye, FaEyeSlash, FaGlobe, FaLock, FaStore, FaUser } from 'react-icons/fa';

export interface CustomerForm {
  full_name: string; email: string; phone: string; address: string; status: string; password: string;
}

interface Props {
  show: boolean; editing: boolean; busy: boolean; error: string;
  kind: 'account' | 'walk_in'; form: CustomerForm;
  onKind: (kind: 'account' | 'walk_in') => void;
  onChange: (form: CustomerForm) => void;
  onClose: () => void; onSave: () => void;
}

export function CustomerFormModal({ show, editing, busy, error, kind, form, onKind, onChange, onClose, onSave }: Props) {
  const [reveal, setReveal] = useState(false);
  const update = (key: keyof CustomerForm, value: string) => onChange({ ...form, [key]: value });
  return <Modal show={show} onHide={() => !busy && onClose()} centered size="lg" scrollable backdrop="static" keyboard={!busy} dialogClassName="customer-editor-dialog" contentClassName="customer-editor-modal" aria-labelledby="customer-editor-title">
    <Modal.Header closeButton={!busy}><div><span className="crm-eyebrow">THE CUSTOMER BOOK / {editing ? 'EDIT PROFILE' : 'NEW CONNECTION'}</span><Modal.Title id="customer-editor-title">{editing ? 'A few details, refreshed.' : 'Make room for someone new.'}</Modal.Title><p>{editing ? 'Keep their contact details and access up to date.' : 'A great print relationship starts with the right details.'}</p></div></Modal.Header>
    <form onSubmit={e => { e.preventDefault(); if (!busy) onSave(); }}>
      <Modal.Body><fieldset disabled={busy} className="customer-editor-fields">
        <div className="customer-editor-layout"><aside className="customer-editor-aside"><div className="customer-editor-preview"><div className="customer-editor-avatar"><FaUser /></div><span>CUSTOMER PROFILE</span><strong>{form.full_name.trim() || 'Your next customer'}</strong><small>{kind === 'account' ? 'Connected through the portal' : 'Welcomed at the counter'}</small></div><div className="customer-editor-guidance"><span><FaCheck /> {kind === 'account' ? 'Place orders online' : 'Save contact details'}</span><span><FaCheck /> {kind === 'account' ? 'Track print projects' : 'Reuse for future orders'}</span><span><FaCheck /> {kind === 'account' ? 'Manage account access' : 'No login required'}</span></div><p>Good details make every future order a little easier.</p><div className="crm-ink-dots" aria-hidden="true"><i /><i /><i /></div></aside>
          <div className="customer-editor-main">
            {!editing && <fieldset className="customer-kind-picker"><legend>01 / Customer type</legend><div>{(['account', 'walk_in'] as const).map(value => <label key={value} className={kind === value ? 'is-selected' : ''}><input type="radio" name="customer-kind" value={value} checked={kind === value} onChange={() => onKind(value)} />{value === 'account' ? <FaGlobe /> : <FaStore />}<span><strong>{value === 'account' ? 'Portal account' : 'Walk-in contact'}</strong><small>{value === 'account' ? 'Online ordering & access' : 'A contact without a login'}</small></span></label>)}</div></fieldset>}
            <div className="customer-editor-section"><h3>{editing ? '01' : '02'} / The essentials</h3><div className="customer-editor-inputs">
              <label className="crm-field crm-field-full">Full name <span>*</span><input autoFocus required maxLength={255} autoComplete="name" placeholder="e.g. Maya Haddad" value={form.full_name} onChange={e => update('full_name', e.target.value)} /></label>
              <label className="crm-field">Email {kind === 'account' && <span>*</span>}<input type="email" required={kind === 'account'} maxLength={255} autoComplete="email" placeholder="name@example.com" value={form.email} onChange={e => update('email', e.target.value)} /></label>
              <label className="crm-field">Phone {kind === 'walk_in' && <span>*</span>}<input type="tel" required={kind === 'walk_in'} minLength={kind === 'walk_in' ? 3 : undefined} maxLength={50} autoComplete="tel" placeholder="e.g. +961 71 123 456" value={form.phone} onChange={e => update('phone', e.target.value)} /></label>
              <label className="crm-field crm-field-full">Address <small>Optional</small><textarea rows={2} maxLength={500} autoComplete="street-address" placeholder="City, street, building…" value={form.address} onChange={e => update('address', e.target.value)} /></label>
            </div></div>
            {kind === 'account' && <div className="customer-editor-section"><h3>{editing ? '02' : '03'} / Portal access <FaLock /></h3><div className="customer-editor-inputs"><label className="crm-field crm-field-full">Account status<select value={form.status} onChange={e => update('status', e.target.value)}><option value="active">Active — can sign in</option><option value="inactive">Inactive — access disabled</option></select></label><div className="crm-field crm-field-full"><label htmlFor="customer-account-password">{editing ? 'New password' : 'Password'} {!editing && <span>*</span>}</label><div className="crm-password"><input id="customer-account-password" type={reveal ? 'text' : 'password'} autoComplete="new-password" required={!editing} minLength={8} maxLength={72} placeholder={editing ? 'Leave blank to keep current password' : 'At least 8 characters'} value={form.password} onChange={e => update('password', e.target.value)} /><button type="button" aria-label={reveal ? 'Hide password' : 'Show password'} aria-pressed={reveal} onClick={() => setReveal(!reveal)}>{reveal ? <FaEyeSlash /> : <FaEye />}</button></div><small>{editing ? 'Only enter a password if you want to change it.' : 'Use at least 8 characters for their portal sign-in.'}</small></div></div></div>}
          </div></div>
      </fieldset>{error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}</Modal.Body>
      <Modal.Footer><small className="me-auto">Fields marked * are required.</small><button type="button" className="crm-button" disabled={busy} onClick={onClose}>Cancel</button><button className="crm-button crm-button-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create customer'} {!busy && <FaArrowRight />}</button></Modal.Footer>
    </form>
  </Modal>;
}
