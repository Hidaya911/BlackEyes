import { useState } from 'react';
import { updateAdminSettings, type AuthUser } from '../../api/auth';

export const SettingsManager = ({ adminId, user, onSaved }: { adminId?: number; user: AuthUser | null; onSaved?: (user: AuthUser) => void }) => {
  const [name, setName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [image, setImage] = useState(user?.profile_image ?? '');
  const [message, setMessage] = useState('');
  const initials = name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'AD';
  const save = async () => {
    try { if (!adminId) throw new Error('Please sign in again.'); const saved = await updateAdminSettings(adminId, { full_name: name, email, phone, address, profile_image: image }); onSaved?.(saved); setMessage('Profile settings saved.'); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save.'); }
  };
  return <section className="mx-auto bg-white rounded-4 shadow-sm overflow-hidden" style={{ maxWidth: 900 }}>
    <div className="p-4 p-md-5 text-white" style={{ background: 'linear-gradient(120deg,#09101f,#143d57)' }}><small className="text-info fw-bold">PERSONAL WORKSPACE</small><h2 className="mt-2 mb-1">Profile settings</h2><p className="mb-0" style={{ color: '#b9c7d8' }}>Keep your administrator profile up to date.</p></div>
    <div className="p-4 p-md-5"><label className="d-flex align-items-center gap-3 mb-4" style={{ cursor: 'pointer' }}>{image ? <img src={image} alt="Profile" style={{ width: 76, height: 76, borderRadius: 22, objectFit: 'cover' }} /> : <b className="rounded-4 p-4" style={{ background: '#00d2ff', color: '#07101c' }}>{initials}</b>}<span><b>Profile picture</b><small className="d-block text-muted">Click to upload a replacement.</small><input className="d-none" type="file" accept="image/*" onChange={e => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = () => setImage(String(reader.result)); reader.readAsDataURL(file); } }} /></span></label><div className="row g-3"><div className="col-md-6"><label className="form-label small fw-bold">FULL NAME</label><input className="form-control py-2" value={name} onChange={e => setName(e.target.value)} /></div><div className="col-md-6"><label className="form-label small fw-bold">EMAIL</label><input className="form-control py-2" value={email} onChange={e => setEmail(e.target.value)} /></div><div className="col-md-6"><label className="form-label small fw-bold">PHONE</label><input className="form-control py-2" value={phone} onChange={e => setPhone(e.target.value)} /></div><div className="col-md-6"><label className="form-label small fw-bold">ADDRESS</label><input className="form-control py-2" value={address} onChange={e => setAddress(e.target.value)} /></div></div><button className="btn btn-dark rounded-pill px-4 mt-4" onClick={save}>Save profile</button>{message && <p className="text-info mt-3 mb-0">{message}</p>}</div>
  </section>;
};
