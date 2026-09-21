import { useEffect, useState } from 'react';
import { Modal } from 'react-bootstrap';
import { FaArrowRight, FaCheckCircle, FaEnvelope, FaGlobe, FaMapMarkerAlt, FaPen, FaPhoneAlt, FaPlus, FaSearch, FaStore, FaSyncAlt, FaTrash, FaUsers } from 'react-icons/fa';
import { adminRequest, type AdminCustomer } from '../../api/admin';
import { CustomerFormModal } from './CustomerFormModal';
import '../../style/CustomerManager.css';

const blank = { full_name: '', email: '', phone: '', address: '', status: 'active', password: '' };
const initials = (name: string) => name.trim().split(/\s+/).filter(Boolean).map(word => word[0]).filter((_, index, words) => index === 0 || index === words.length - 1).join('').toUpperCase() || '?';

export function CustomerManager() {
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [status, setStatus] = useState('all');
  const [form, setForm] = useState(blank);
  const [kind, setKind] = useState<'account' | 'walk_in'>('account');
  const [editing, setEditing] = useState<AdminCustomer | null>(null);
  const [open, setOpen] = useState(false);
  const [removing, setRemoving] = useState<AdminCustomer | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setCustomers(await adminRequest<AdminCustomer[]>('/customers')); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => {
    let active = true;
    adminRequest<AdminCustomer[]>('/customers').then(result => { if (active) setCustomers(result); })
      .catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function edit(customer: AdminCustomer | null) {
    setEditing(customer); setKind(customer?.kind ?? 'account');
    setForm(customer ? { full_name: customer.full_name, email: customer.email, phone: customer.phone, address: customer.address, status: customer.status, password: '' } : blank);
    setModalError(''); setOpen(true);
  }
  async function save() {
    if (busy) return;
    setBusy(true); setModalError('');
    try {
      const saved = await adminRequest<AdminCustomer>(`/customers/${kind}${editing ? `/${editing.id}` : ''}`, { method: editing ? 'PUT' : 'POST', body: JSON.stringify(form) });
      setCustomers(current => editing ? current.map(c => c.id === saved.id && c.kind === saved.kind ? saved : c) : [...current, saved]);
      setOpen(false); setNotice(`${saved.full_name} ${editing ? 'has been updated' : 'has been added to your customer book'}.`);
    } catch (e) { setModalError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!removing || busy) return;
    setBusy(true); setModalError('');
    try {
      await adminRequest(`/customers/${removing.kind}/${removing.id}`, { method: 'DELETE' });
      setCustomers(current => current.filter(c => c.id !== removing.id || c.kind !== removing.kind));
      setRemoving(null); setNotice('Customer deleted.');
    } catch (e) { setModalError((e as Error).message); }
    finally { setBusy(false); }
  }

  const accounts = customers.filter(c => c.kind === 'account');
  const walkIns = customers.length - accounts.length;
  const activeAccounts = accounts.filter(c => c.status === 'active').length;
  const filtered = customers.filter(c =>
    `${c.full_name} ${c.email} ${c.phone} ${c.address}`.toLowerCase().includes(search.trim().toLowerCase()) &&
    (filter === 'all' || c.kind === filter) && (status === 'all' || (c.kind === 'account' && c.status === status)),
  ).sort((a, b) => a.full_name.localeCompare(b.full_name));

  return <section className="customer-manager">
    <header className="crm-hero"><div><span className="crm-eyebrow">BLACKEYES / THE CUSTOMER BOOK</span><h2>Behind every print,<br /><em>there’s a person.</em></h2><p>Your regulars, new faces, and online creators. Keep every connection close.</p><button className="crm-button crm-button-mint" onClick={() => edit(null)}><FaPlus /> New customer <FaArrowRight /></button></div><div className="crm-hero-illustration" aria-hidden="true"><div className="crm-floating-card crm-floating-back"><FaGlobe /><span>ONLINE CREATORS</span><i /><i /></div><div className="crm-floating-card crm-floating-front"><div className="crm-illustration-avatars"><b>M</b><b>R</b><b>J</b></div><strong>Made for people.</strong><span>PRINTED WITH CARE.</span><div className="crm-ink-dots"><i /><i /><i /></div></div><span className="crm-orbit-dot" /></div></header>
    <div className="crm-stats">{[
      { label: 'All customers', count: customers.length, note: 'Your growing address book', Icon: FaUsers },
      { label: 'Portal accounts', count: accounts.length, note: 'Connected to your online studio', Icon: FaGlobe },
      { label: 'Walk-in contacts', count: walkIns, note: 'Familiar faces at the counter', Icon: FaStore },
      { label: 'Active accounts', count: activeAccounts, note: 'Ready to sign in & order', Icon: FaCheckCircle },
    ].map(({ label, count, note, Icon }) => <article key={label}><span className="crm-stat-icon"><Icon /></span><div><small>{label}</small><strong>{loading || error ? '—' : count}</strong><p>{note}</p></div></article>)}</div>
    {notice && <div className="crm-notice" role="status"><FaCheckCircle /><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice('')}>×</button></div>}
    {error && <div className="alert alert-danger" role="alert">{error} <button className="btn btn-sm btn-outline-danger" onClick={load}>Retry</button></div>}
    <div className="crm-directory"><div className="crm-directory-heading"><div><span className="crm-eyebrow">YOUR COMMUNITY</span><h3>People in your corner</h3></div><button className="crm-button" disabled={loading} onClick={load}><FaSyncAlt /> Refresh</button></div>
      <div className="crm-toolbar"><label className="crm-search"><FaSearch /><input type="search" aria-label="Search customers" placeholder="Find a name, email, phone, or address…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Filter account status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option><option value="active">Active portal accounts</option><option value="inactive">Inactive portal accounts</option></select></div>
      <div className="crm-filter-row"><div className="crm-filters" role="group" aria-label="Customer type filter">{[['all', 'Everyone', customers.length], ['account', 'Portal', accounts.length], ['walk_in', 'Walk-in', walkIns]].map(([value, label, count]) => <button key={value} aria-pressed={filter === value} className={filter === value ? 'is-selected' : ''} onClick={() => setFilter(String(value))}>{label}<span>{loading || error ? '—' : count}</span></button>)}</div><small aria-live="polite">{!loading && !error && `${filtered.length} ${filtered.length === 1 ? 'customer' : 'customers'} · A–Z`}</small></div>
      {loading ? <div className="crm-empty" role="status"><div className="spinner-border spinner-border-sm" /><h4>Opening your customer book…</h4></div> : !error && <div className="crm-customer-grid">{filtered.map(customer => <article className={`crm-customer-card ${customer.kind === 'walk_in' ? 'is-walk-in' : ''}`} key={`${customer.kind}-${customer.id}`}><div className="crm-card-identity"><span className="crm-avatar" aria-hidden="true">{initials(customer.full_name)}</span><div><small>{customer.kind === 'account' ? 'PORTAL ACCOUNT' : 'WALK-IN CONTACT'}</small><h4>{customer.full_name}</h4></div><span className={`crm-status-dot ${customer.kind === 'account' && customer.status !== 'active' ? 'is-inactive' : ''}`} title={customer.kind === 'account' ? customer.status : 'Saved contact'} aria-label={customer.kind === 'account' ? customer.status : 'Saved contact'} /></div><div className="crm-contact-lines"><div><FaEnvelope /><span>{customer.email || <em>No email added</em>}</span></div><div><FaPhoneAlt /><span>{customer.phone || <em>No phone added</em>}</span></div><div><FaMapMarkerAlt /><span>{customer.address || <em>No address added</em>}</span></div></div><footer><span className="crm-type-badge">{customer.kind === 'account' ? <FaGlobe /> : <FaStore />}{customer.kind === 'account' ? customer.status === 'active' ? 'Portal access active' : 'Portal access inactive' : 'Counter customer'}</span><div><button className="crm-edit-button" aria-label={`Edit ${customer.full_name}`} onClick={() => edit(customer)}><FaPen /> Edit</button><button className="crm-delete-button" aria-label={`Delete ${customer.full_name}`} onClick={() => { setRemoving(customer); setModalError(''); }}><FaTrash /></button></div></footer></article>)}
        {!filtered.length && <div className="crm-empty"><span className="crm-empty-icon"><FaUsers /></span><h4>{customers.length ? 'No connections found here.' : 'Your customer book starts here.'}</h4><p>{customers.length ? 'Try another search or clear your filters.' : 'Add your first customer and make the next order easier.'}</p><button className="crm-button crm-button-primary" onClick={() => customers.length ? (setSearch(''), setFilter('all'), setStatus('all')) : edit(null)}>{customers.length ? 'Clear filters' : 'Add your first customer'} <FaArrowRight /></button></div>}
      </div>}
    </div>
    {open && <CustomerFormModal show editing={!!editing} busy={busy} error={modalError} kind={kind} form={form} onKind={setKind} onChange={setForm} onClose={() => setOpen(false)} onSave={save} />}
    <Modal show={!!removing} onHide={() => !busy && setRemoving(null)} centered contentClassName="crm-delete-modal" aria-labelledby="crm-delete-title"><Modal.Header closeButton={!busy}><Modal.Title id="crm-delete-title">Remove this connection?</Modal.Title></Modal.Header><Modal.Body><div className="crm-delete-symbol"><FaTrash /></div><h4>{removing?.full_name}</h4><p>This permanently removes the customer record. Customers with orders are protected from deletion; portal access can be deactivated instead.</p>{modalError && <div className="alert alert-danger mt-3" role="alert">{modalError}</div>}</Modal.Body><Modal.Footer><button className="crm-button" disabled={busy} onClick={() => setRemoving(null)}>Keep customer</button><button className="btn btn-danger" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete customer'}</button></Modal.Footer></Modal>
  </section>;
}
