export type UserRole = 'admin' | 'staff' | 'customer' | 'wholesaler';

export interface AuthUser {
  user_id: number;
  full_name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  address: string | null;
  status: string;
  profile_image: string | null;
}

interface AuthErrorPayload {
  detail?: string;
}

const request = async <T>(path: string, body: Record<string, string>): Promise<T> => {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as AuthErrorPayload;
    throw new Error(typeof data.detail === 'string' ? data.detail : 'Please check the required fields and try again.');
  }

  return response.json() as Promise<T>;
};

export const signup = (full_name: string, email: string, password: string, phone = '', address = '') =>
  request<AuthUser>('/api/auth/signup', { full_name, email, password, phone, address });

export const login = (email: string, password: string) =>
  request<AuthUser>('/api/auth/login', { email, password });
export const requestPasswordReset = (email: string) => request<{ message: string }>('/api/auth/forgot-password', { email });
export const resetPassword = (token: string, password: string) => request<{ message: string }>('/api/auth/reset-password', { token, password });

export const createStaff = (admin_id: number, full_name: string, email: string, password: string, phone: string, address: string, status: string) =>
  request<AuthUser>('/api/admin/staff', { admin_id: String(admin_id), full_name, email, password, phone, address, status });

export const updateAdminSettings = async (admin_id: number, data: Record<string, string>) => {
  const response = await fetch('/api/admin/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_id, ...data }) });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(typeof body.detail === 'string' ? body.detail : 'Please check the required fields and try again.'); }
  return response.json() as Promise<AuthUser>;
};

export interface Product { product_id: number; name: string; description: string | null; price: number; wholesale_price: number | null; image_url: string | null; status: string; is_customizable: boolean; }
export const getProducts = (adminId: number) => fetch(`/api/admin/products?admin_id=${adminId}`).then(async response => { if (!response.ok) throw new Error('Unable to load products.'); return response.json() as Promise<Product[]>; });
export const saveProduct = async (adminId: number, data: Record<string, string | boolean>, productId?: number) => {
  const response = await fetch(productId ? `/api/admin/products/${productId}` : '/api/admin/products', {
    method: productId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: adminId, ...data }),
  });
  if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.detail ?? 'Unable to save product.'); }
  return response.json() as Promise<Product>;
};
export const deleteProduct = async (adminId: number, productId: number) => {
  const response = await fetch(`/api/admin/products/${productId}?admin_id=${adminId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Unable to delete product.');
};

export const getStaff = (adminId: number) => fetch(`/api/admin/staff?admin_id=${adminId}`).then(async response => { if (!response.ok) throw new Error('Unable to load staff.'); return response.json() as Promise<AuthUser[]>; });
export const updateStaff = async (adminId: number, staffId: number, data: Record<string, string>) => { const response = await fetch(`/api/admin/staff/${staffId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ admin_id: adminId, ...data }) }); if (!response.ok) { const body=await response.json().catch(()=>({})); throw new Error(typeof body.detail==='string'?body.detail:'Unable to update staff.'); } return response.json() as Promise<AuthUser>; };
export const deleteStaff = async (adminId: number, staffId: number) => { const response = await fetch(`/api/admin/staff/${staffId}?admin_id=${adminId}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Unable to delete staff.'); };
