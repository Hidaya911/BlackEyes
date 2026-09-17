import { useEffect, useState } from 'react';
import { FaCheck, FaPencilAlt, FaTrash, FaUserPlus } from 'react-icons/fa';
import { createStaff, deleteStaff, getStaff, updateStaff, type AuthUser } from '../../api/auth';

export const StaffManager = ({ adminId }: { adminId?: number }) => {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', address: '', status: 'active' });
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<AuthUser[]>([]);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [confirming, setConfirming] = useState<AuthUser | null>(null);
  const update = (key: keyof typeof form, value: string) => setForm(current => ({ ...current, [key]: value }));
  const loadStaff = () => { if (adminId) void getStaff(adminId).then(setStaff).catch(error => setMessage(error.message)); };
  useEffect(() => { loadStaff(); }, [adminId]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      setMessage('Full name, email, and a password with at least 8 characters are required.');
      return;
    }
    try {
      if (!adminId) throw new Error('Please sign in again.');
      setSaving(true);
      await createStaff(adminId, form.name, form.email, form.password, form.phone, form.address, form.status);
      setMessage('Staff account created successfully.');
      setForm({ name: '', email: '', password: '', phone: '', address: '', status: 'active' });
      loadStaff();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create staff account.');
    } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    if (!adminId || !editing) return;
    try { const saved = await updateStaff(adminId, editing.user_id, { full_name: editing.full_name, email: editing.email, phone: editing.phone ?? '', address: editing.address ?? '', status: editing.status }); setStaff(current => current.map(item => item.user_id === saved.user_id ? saved : item)); setEditing(null); setMessage('Staff details updated.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to update staff.'); }
  };
  const remove = async (staffId: number) => {
    if (!adminId) return;
    const staffMember = staff.find(member => member.user_id === staffId);
    if (!confirming || confirming.user_id !== staffId) {
      setConfirming(staffMember ?? null);
      return;
    }
    try { await deleteStaff(adminId, staffId); setStaff(current => current.filter(item => item.user_id !== staffId)); setMessage('Staff account deleted.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete staff.'); }
  };
  useEffect(() => {
    if (!confirming || !adminId) return;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;z-index:2000;display:grid;place-items:center;background:rgba(7,10,19,.65);padding:20px';
    modal.innerHTML = `<div style="width:min(440px,100%);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 24px 70px #0008"><div style="padding:25px;background:linear-gradient(120deg,#09101f,#143d57);color:#fff"><small style="color:#00d2ff;font-weight:700">ACCOUNT REMOVAL</small><h3 style="margin:8px 0 0">Delete ${confirming.full_name}?</h3></div><div style="padding:25px;color:#5d6b7d">This permanently removes the staff account and its access.<div style="display:flex;justify-content:flex-end;gap:10px;margin-top:22px"><button data-cancel style="padding:10px 14px;border:0;border-radius:9px">Cancel</button><button data-confirm style="padding:10px 14px;border:0;border-radius:9px;background:#dc3545;color:#fff">Delete account</button></div></div></div>`;
    const cancel = () => setConfirming(null);
    const confirm = async () => { try { await deleteStaff(adminId, confirming.user_id); setStaff(current => current.filter(item => item.user_id !== confirming.user_id)); setMessage('Staff account deleted.'); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to delete staff.'); } finally { setConfirming(null); } };
    modal.querySelector('[data-cancel]')?.addEventListener('click', cancel);
    modal.querySelector('[data-confirm]')?.addEventListener('click', confirm);
    document.body.appendChild(modal);
    return () => modal.remove();
  }, [confirming, adminId]);

  return <div className="mx-auto" style={{ maxWidth: 900 }}><section className="bg-white rounded-4 shadow-sm overflow-hidden">
    <div className="p-4 p-md-5 text-white" style={{ background: 'linear-gradient(120deg,#09101f,#143d57)' }}>
      <small className="text-info fw-bold">TEAM ACCESS</small>
      <h2 className="mt-2 mb-1">Create a staff account</h2>
      <p className="mb-0" style={{ color: '#b9c7d8' }}>Add a press-floor colleague to the Blackeyes workspace.</p>
    </div>
    <div className="p-4 p-md-5">
      <div className="row g-3">
        <div className="col-md-6"><label className="form-label fw-bold small">FULL NAME</label><input className="form-control py-2" placeholder="Staff full name" value={form.name} onChange={e => update('name', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label fw-bold small">EMAIL ADDRESS</label><input className="form-control py-2" type="email" placeholder="staff@gmail.com" value={form.email} onChange={e => update('email', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label fw-bold small">PHONE</label><input className="form-control py-2" placeholder="03 123 456" value={form.phone} onChange={e => update('phone', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label fw-bold small">ACCOUNT STATUS</label><select className="form-select py-2" value={form.status} onChange={e => update('status', e.target.value)}><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        <div className="col-12"><label className="form-label fw-bold small">ADDRESS</label><input className="form-control py-2" placeholder="Staff address" value={form.address} onChange={e => update('address', e.target.value)} /></div>
        <div className="col-md-6"><label className="form-label fw-bold small">TEMPORARY PASSWORD</label><input className="form-control py-2" type="password" placeholder="At least 8 characters" value={form.password} onChange={e => update('password', e.target.value)} /></div>
      </div>
      <div className="d-flex justify-content-between align-items-center border-top mt-4 pt-3"><small className="text-muted"></small><button className="btn text-white rounded-pill px-4" disabled={saving} style={{ background: 'linear-gradient(90deg,#00c7ef,#ff007f)' }} onClick={submit}><FaUserPlus className="me-2" />{saving ? 'Creating…' : 'Create staff'}</button></div>
      {message && <div className="alert alert-info mt-3 mb-0"><FaCheck className="me-2" />{message}</div>}
    </div>
  </section><section className="bg-white rounded-4 shadow-sm mt-4 p-4"><div className="d-flex justify-content-between align-items-center mb-3"><div><small className="text-info fw-bold">YOUR TEAM</small><h4 className="mb-0">Staff accounts</h4></div><span className="badge text-bg-light">{staff.length} staff</span></div>{staff.length === 0 ? <p className="text-muted mb-0">No staff accounts yet.</p> : <div className="row g-3">{staff.map(member => <div className="col-md-6" key={member.user_id}><article className="border rounded-4 p-3 h-100"><div className="d-flex justify-content-between"><div><b>{member.full_name}</b><small className="d-block text-muted">{member.email}</small><small className="d-block text-muted">{member.phone || 'No phone'} · {member.status}</small></div><div><button className="btn btn-sm btn-outline-dark me-1" onClick={() => setEditing({ ...member })}><FaPencilAlt /></button><button className="btn btn-sm btn-outline-danger" onClick={() => remove(member.user_id)}><FaTrash /></button></div></div></article></div>)}</div>}</section>{editing && <div className="modal d-block" style={{background:'#0008'}}><div className="modal-dialog modal-dialog-centered"><div className="modal-content rounded-4"><div className="modal-header"><h5>Edit staff account</h5><button className="btn-close" onClick={() => setEditing(null)} /></div><div className="modal-body row g-3"><div className="col-12"><input className="form-control" value={editing.full_name} onChange={e => setEditing({...editing, full_name:e.target.value})} /></div><div className="col-12"><input className="form-control" value={editing.email} onChange={e => setEditing({...editing, email:e.target.value})} /></div><div className="col-6"><input className="form-control" value={editing.phone ?? ''} placeholder="Phone" onChange={e => setEditing({...editing, phone:e.target.value})} /></div><div className="col-6"><select className="form-select" value={editing.status} onChange={e => setEditing({...editing, status:e.target.value})}><option>active</option><option>inactive</option></select></div><div className="col-12"><input className="form-control" value={editing.address ?? ''} placeholder="Address" onChange={e => setEditing({...editing, address:e.target.value})} /></div></div><div className="modal-footer"><button className="btn btn-dark" onClick={saveEdit}>Save changes</button></div></div></div></div>}</div>;
};
