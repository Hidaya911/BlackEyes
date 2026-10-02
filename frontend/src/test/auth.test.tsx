import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../components/auth/Login';
import { ResetPasswordPage } from '../components/auth/ResetPasswordPage';

afterEach(() => vi.unstubAllGlobals());

describe('authentication forms', () => {
  it('submits credentials and returns the authenticated user', async () => {
    const actor = { user_id: 7, role: 'admin' };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => actor });
    vi.stubGlobal('fetch', fetchMock);
    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(onLoginSuccess).toHaveBeenCalledWith(actor));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ email: 'admin@example.com', password: 'correct-password' }),
    }));
  });

  it('blocks empty and malformed email submissions', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await user.type(screen.getByLabelText('Email address'), 'invalid');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prevents duplicate requests and allows retry after a server error', async () => {
    let resolve!: (response: unknown) => void;
    const fetchMock = vi.fn().mockImplementation(() => new Promise(done => { resolve = done; }));
    vi.stubGlobal('fetch', fetchMock);
    const onLoginSuccess = vi.fn();
    render(<LoginPage onLoginSuccess={onLoginSuccess} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Signing in…' }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    resolve({ ok: false, json: async () => ({ detail: 'Incorrect email or password.' }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
    expect(onLoginSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });

  it('shows a network failure without navigating away', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection unavailable')));
    render(<LoginPage />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email address'), 'user@example.com');
    await user.type(screen.getByLabelText('Password'), 'password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Connection unavailable');
  });

  it.each([true, false])('handles password reset success=%s and keeps the token in the request', async ok => {
    const message = ok ? 'Password changed.' : 'Reset link expired.';
    const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => ok ? { message } : { detail: message } });
    vi.stubGlobal('fetch', fetchMock);
    const onLogin = vi.fn();
    render(<ResetPasswordPage token="signed-token" onLogin={onLogin} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await user.type(screen.getByPlaceholderText('New password (at least 8 characters)'), 'new-password');
    await user.click(screen.getByRole('button', { name: 'Reset password' }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/reset-password', expect.objectContaining({
      body: JSON.stringify({ token: 'signed-token', password: 'new-password' }),
    }));
    await user.click(screen.getByRole('button', { name: 'Back to sign in' }));
    expect(onLogin).toHaveBeenCalledOnce();
  });
});
