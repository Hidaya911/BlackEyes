import { useState } from 'react';
import { resetPassword } from '../../api/auth';

export const ResetPasswordPage = ({ token, onLogin }: { token: string; onLogin: () => void }) => {
  const [password, setPassword] = useState(''); const [message, setMessage] = useState('');
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { setMessage((await resetPassword(token, password)).message); } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to reset password.'); } };
  return <main className="min-vh-100 d-flex align-items-center justify-content-center bg-dark-custom p-4"><form onSubmit={submit} className="bg-white rounded-4 shadow p-5 w-100" style={{maxWidth:440}}><small className="text-uppercase fw-bold text-info">Blackeyes account recovery</small><h2 className="mt-2">Choose a new password</h2><p className="text-muted small">Your reset link is valid for one hour.</p><input className="form-control my-3" type="password" minLength={8} required placeholder="New password (at least 8 characters)" value={password} onChange={e=>setPassword(e.target.value)}/><button className="btn btn-dark w-100">Reset password</button>{message && <div className="alert alert-info small mt-3 mb-0">{message}</div>}<button type="button" className="btn btn-link w-100 mt-2" onClick={onLogin}>Back to sign in</button></form></main>;
};
