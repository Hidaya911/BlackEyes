import { useEffect, useState, type FormEvent } from 'react';
import { Modal } from 'react-bootstrap';
import { FaEnvelope, FaPencilAlt, FaPhoneAlt, FaPlus, FaSearch, FaTrash, FaTruck } from 'react-icons/fa';
import { deleteVendor, getVendors, saveVendor, type Vendor, type VendorForm } from '../../api/vendors';
import '../../style/VendorManager.css';
import { VendorLedger } from './VendorLedger';

const emptyForm: VendorForm = { name: '', phone: '', email: '' };

function VendorFields({ form, onChange, prefix }: {
  form: VendorForm;
  onChange: (form: VendorForm) => void;
  prefix: string;
}) {
  return (
    <div className="row g-3">
      <div className="col-12">
        <label className="form-label" htmlFor={`${prefix}-name`}>Vendor name <span className="text-danger">*</span></label>
        <input
          id={`${prefix}-name`}
          className="form-control"
          placeholder="e.g. Cedar Paper & Supplies"
          required
          maxLength={255}
          value={form.name}
          onChange={event => onChange({ ...form, name: event.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${prefix}-phone`}>Phone number</label>
        <input
          id={`${prefix}-phone`}
          className="form-control"
          type="tel"
          placeholder="+961 3 123 456"
          maxLength={50}
          value={form.phone}
          onChange={event => onChange({ ...form, phone: event.target.value })}
        />
      </div>
      <div className="col-12">
        <label className="form-label" htmlFor={`${prefix}-email`}>Email address</label>
        <input
          id={`${prefix}-email`}
          className="form-control"
          type="email"
          placeholder="hello@vendor.com"
          maxLength={255}
          value={form.email}
          onChange={event => onChange({ ...form, email: event.target.value })}
        />
      </div>
    </div>
  );
}

export function VendorManager({ adminId }: { adminId?: number }) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [form, setForm] = useState<VendorForm>(emptyForm);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [editForm, setEditForm] = useState<VendorForm>(emptyForm);
  const [deleting, setDeleting] = useState<Vendor | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadError('');
    setVendors([]);

    if (!adminId) {
      setLoadError('Please sign in again to manage vendors.');
      setLoading(false);
      return;
    }

    getVendors(adminId, controller.signal)
      .then(setVendors)
      .catch((failure: Error) => {
        if (!controller.signal.aborted) setLoadError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [adminId, reload]);

  async function submit(event: FormEvent<HTMLFormElement>, isEdit = false) {
    event.preventDefault();
    if (!adminId || busy) return;
    const values = isEdit ? editForm : form;
    const reportError = isEdit ? setModalError : setError;
    reportError('');
    setMessage('');

    if (!values.name.trim()) {
      reportError('Enter a vendor name.');
      return;
    }

    setBusy(true);
    try {
      const saved = await saveVendor(adminId, values, isEdit ? editing?.vendor_id : undefined);
      setVendors(current => isEdit
        ? current.map(vendor => vendor.vendor_id === saved.vendor_id ? saved : vendor)
        : [saved, ...current]);
      if (isEdit) setEditing(null);
      else setForm(emptyForm);
      setMessage(isEdit ? 'Vendor details updated.' : 'Vendor added to your directory.');
    } catch (failure) {
      reportError(failure instanceof Error ? failure.message : 'Unable to save vendor.');
    } finally {
      setBusy(false);
    }
  }

  async function removeVendor() {
    if (!adminId || !deleting || busy) return;
    setBusy(true);
    setModalError('');
    setMessage('');
    try {
      await deleteVendor(adminId, deleting.vendor_id);
      setVendors(current => current.filter(vendor => vendor.vendor_id !== deleting.vendor_id));
      setDeleting(null);
      setMessage('Vendor deleted.');
    } catch (failure) {
      setModalError(failure instanceof Error ? failure.message : 'Unable to delete vendor.');
    } finally {
      setBusy(false);
    }
  }

  const query = search.trim().toLowerCase();
  const filtered = vendors.filter(vendor =>
    [vendor.name, vendor.phone, vendor.email].some(value => value?.toLowerCase().includes(query)));

  return (
    <div className="vendor-manager">
      <header className="vendor-hero">
        <div>
          <span className="vendor-eyebrow">THE PEOPLE BEHIND THE PRESS</span>
          <h1>Your supply network.</h1>
          <p>Keep your trusted vendors and their contact details close at hand.</p>
        </div>
        <div className="vendor-count">
          <FaTruck aria-hidden="true" />
          <strong>{loading || loadError ? '—' : vendors.length}</strong>
          <span>vendors in your directory</span>
        </div>
      </header>

      {message && <div className="alert alert-success mt-3" role="status">{message}</div>}

      <div className="vendor-layout">
        <section className="vendor-panel vendor-create">
          <span className="vendor-eyebrow">GROW YOUR NETWORK</span>
          <h2>Add a vendor</h2>
          <p className="text-secondary small">A new connection for your next print run.</p>
          <form onSubmit={event => void submit(event)}>
            <fieldset disabled={busy || !adminId || loading || !!loadError}>
              <VendorFields form={form} onChange={setForm} prefix="create-vendor" />
              {error && <div className="alert alert-danger mt-3" role="alert">{error}</div>}
              <button className="btn vendor-primary w-100 mt-4" type="submit">
                <FaPlus className="me-2" />
                {busy && !editing && !deleting ? 'Creating…' : 'Create vendor'}
              </button>
            </fieldset>
          </form>
        </section>

        <section className="vendor-panel">
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
            <div>
              <span className="vendor-eyebrow">ALL CONNECTIONS</span>
              <h2 className="mb-0">Vendor directory</h2>
            </div>
            <span className="vendor-result-count">{filtered.length} listed</span>
          </div>
          <div className="vendor-search">
            <FaSearch aria-hidden="true" />
            <input
              type="search"
              aria-label="Search vendors by name, phone, or email"
              placeholder="Search name, phone or email…"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>

          {loading ? (
            <p className="vendor-empty" role="status">Loading your vendors…</p>
          ) : loadError ? (
            <div className="alert alert-danger mt-3" role="alert">
              {loadError}
              <button className="btn btn-sm btn-outline-danger ms-2" onClick={() => setReload(value => value + 1)}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="vendor-empty">
              <FaTruck size={32} className="mb-3" />
              <h3>{query ? 'No matching vendors' : 'Your network starts here'}</h3>
              <p>{query ? 'Try another name, phone number or email.' : 'Add your first vendor using the form beside this directory.'}</p>
            </div>
          ) : (
            <div className="vendor-list">
              {filtered.map(vendor => (
                <article className="vendor-card" key={vendor.vendor_id}>
                  <div className="vendor-avatar" aria-hidden="true">{vendor.name.slice(0, 2).toUpperCase()}</div>
                  <div className="vendor-details">
                    <small>VENDOR #{String(vendor.vendor_id).padStart(3, '0')}</small>
                    <h3>{vendor.name}</h3>
                    <div className="vendor-contact"><FaPhoneAlt />{vendor.phone || 'No phone added'}</div>
                    <div className="vendor-contact"><FaEnvelope />{vendor.email || 'No email added'}</div>
                  </div>
                  <div className="vendor-actions">
                    <button
                      className="btn btn-light"
                      aria-label={`Edit ${vendor.name}`}
                      disabled={busy}
                      onClick={() => {
                        setEditing(vendor);
                        setEditForm({ name: vendor.name, phone: vendor.phone ?? '', email: vendor.email ?? '' });
                        setModalError('');
                      }}
                    >
                      <FaPencilAlt />
                    </button>
                    <button
                      className="btn vendor-delete"
                      aria-label={`Delete ${vendor.name}`}
                      disabled={busy}
                      onClick={() => {
                        setDeleting(vendor);
                        setModalError('');
                      }}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      {!loading && !loadError && <VendorLedger adminId={adminId} vendors={vendors} />}

      <Modal show={!!editing} onHide={() => !busy && setEditing(null)} centered backdrop={busy ? 'static' : true} keyboard={!busy} aria-labelledby="vendor-edit-title" contentClassName="vendor-modal">
        <Modal.Header closeButton={!busy}>
          <Modal.Title id="vendor-edit-title">Edit vendor</Modal.Title>
        </Modal.Header>
        <form onSubmit={event => void submit(event, true)}>
          <Modal.Body>
            <fieldset disabled={busy}>
              <VendorFields form={editForm} onChange={setEditForm} prefix="edit-vendor" />
            </fieldset>
            {modalError && <div className="alert alert-danger mt-3" role="alert">{modalError}</div>}
          </Modal.Body>
          <Modal.Footer>
            <button type="button" className="btn btn-light" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" className="btn vendor-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
          </Modal.Footer>
        </form>
      </Modal>

      <Modal show={!!deleting} onHide={() => !busy && setDeleting(null)} centered backdrop={busy ? 'static' : true} keyboard={!busy} aria-labelledby="vendor-delete-title" contentClassName="vendor-modal">
        <Modal.Header closeButton={!busy}>
          <Modal.Title id="vendor-delete-title">Delete vendor?</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="vendor-delete-symbol"><FaTrash /></div>
          <p className="mt-3">Remove <strong>{deleting?.name}</strong> from your vendor directory?</p>
          <p className="text-secondary mb-0">Vendors without purchases can be permanently deleted. Vendors with purchase history are kept to preserve their financial records.</p>
          {modalError && <div className="alert alert-danger mt-3" role="alert">{modalError}</div>}
        </Modal.Body>
        <Modal.Footer>
          <button className="btn btn-light" disabled={busy} onClick={() => setDeleting(null)}>Keep vendor</button>
          <button className="btn btn-danger" disabled={busy} onClick={() => void removeVendor()}>{busy ? 'Deleting…' : 'Delete vendor'}</button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
