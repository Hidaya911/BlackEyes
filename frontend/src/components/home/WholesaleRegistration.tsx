import { useState, type FormEvent } from 'react';
import '../../style/WholesaleRegistration.css';

const empty = { full_name: '', business_name: '', email: '', phone: '', address: '', password: '' };

export function WholesaleRegistration() {
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/wholesale/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : Array.isArray(body.detail) ? body.detail.map((e: { msg: string }) => e.msg).join(' ') : 'Unable to register. Please try again.');
      setSaved(true); setForm(empty);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to register. Please try again.'); }
    finally { setBusy(false); }
  }
  return <section id="wholesale" className="wholesale-section" aria-labelledby="wholesale-title"><div className="wholesale-story"><span>BLACKEYES / FOR BUSINESS</span><h2 id="wholesale-title">Big ideas.<br /><em>Business scale.</em></h2><p>Buying for your shop, studio, or business? Register as a wholesale buyer and introduce yourself to our press team.</p><div className="wholesale-story-note">Your business, in good company.<small>One account. A direct connection to the people behind your prints.</small></div></div><div className="wholesale-form-panel">{saved ? <div role="status"><span className="badge text-bg-success mb-3">Registration complete</span><h3>Welcome to Blackeyes.</h3><p>Your wholesale buyer account is saved. Our staff can now find your business details. You can sign in using your email and password.</p><p>For wholesale requests, contact the press directly.</p></div> : <form onSubmit={submit}><h3>Become a wholesale buyer</h3><p className="text-secondary">Tell us a little about your business.</p><fieldset disabled={busy}><div className="wholesale-fields">{([
    ['full_name', 'Your full name', 'text', 255], ['business_name', 'Business / shop name', 'text', 255], ['email', 'Email address', 'email', 255], ['phone', 'Phone number', 'tel', 50], ['address', 'Business address', 'text', 500], ['password', 'Create a password', 'password', 72],
  ] as const).map(([key, label, type, max]) => <label key={key}>{label}<input name={key} type={type} required maxLength={max} minLength={key === 'password' ? 8 : key === 'phone' || key === 'address' ? 3 : 1} autoComplete={key === 'password' ? 'new-password' : key === 'full_name' ? 'name' : key === 'business_name' ? 'organization' : key === 'phone' ? 'tel' : key === 'address' ? 'street-address' : 'email'} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} /></label>)}</div><small className="d-block my-3 text-secondary">Password: at least 8 characters. Wholesale orders are currently handled directly at the press.</small><button className="btn btn-dark w-100 py-3" type="submit">{busy ? 'Creating your account…' : 'Register as a wholesale buyer →'}</button></fieldset>{error && <p className="alert alert-danger mt-3" role="alert">{error}</p>}</form>}</div></section>;
}
