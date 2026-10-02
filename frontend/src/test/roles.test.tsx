import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { App } from '../App';

vi.mock('../components/admin/AdminPage', () => ({ AdminPage: ({ onNavigateHome }: { onNavigateHome: () => void }) => <button onClick={onNavigateHome}>Admin logout</button> }));
vi.mock('../components/staff/StaffPage', () => ({ StaffPage: () => <p>Staff workspace</p> }));
vi.mock('../components/customer/CustomerPage', () => ({ CustomerPage: () => <p>Customer storefront</p> }));
afterEach(() => vi.unstubAllGlobals());

it.each([
  ['admin', 'admin', 'Admin logout'],
  ['staff', 'staff', 'Staff workspace'],
  ['customer', 'home', 'Customer storefront'],
  ['wholesaler', 'home', 'Customer storefront'],
])('routes authenticated %s users after signing in', async (role, page, destination) => {
  sessionStorage.setItem('blackeyes:page', 'login');
  const actor = { user_id: 1, role, status: 'active' };
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => actor }));
  render(<App />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email address'), 'user@example.com');
  await user.type(screen.getByLabelText('Password'), 'password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(destination)).toBeInTheDocument();
  expect(sessionStorage.getItem('blackeyes:page')).toBe(page);
  expect(JSON.parse(sessionStorage.getItem('blackeyes:user')!)).toEqual(actor);
});

it.each([['admin', null], ['staff', null], ['admin', 'customer'], ['admin', 'staff'], ['staff', 'admin']])(
  'blocks a stored %s workspace for role %s', (page, role) => {
    sessionStorage.setItem('blackeyes:page', page!);
    if (role) sessionStorage.setItem('blackeyes:user', JSON.stringify({ role, status: 'active' }));
    render(<App />);
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.queryByText('Admin logout')).not.toBeInTheDocument();
    expect(screen.queryByText('Staff workspace')).not.toBeInTheDocument();
  },
);

it('handles invalid stored user data', () => {
  sessionStorage.setItem('blackeyes:page', 'admin');
  sessionStorage.setItem('blackeyes:user', '{invalid');
  render(<App />);
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});

it('logs out and clears persisted account data', async () => {
  sessionStorage.setItem('blackeyes:page', 'admin');
  sessionStorage.setItem('blackeyes:user', JSON.stringify({ role: 'admin', status: 'active' }));
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  render(<App />);
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Admin logout' }));
  await waitFor(() => expect(sessionStorage.getItem('blackeyes:user')).toBeNull());
  expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', { method: 'POST' });
  expect(await screen.findByText('Customer storefront')).toBeInTheDocument();
});
