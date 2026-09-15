export type UserRole = 'admin' | 'staff' | 'customer';

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
    throw new Error(data.detail ?? 'Something went wrong. Please try again.');
  }

  return response.json() as Promise<T>;
};

export const signup = (full_name: string, email: string, password: string) =>
  request<AuthUser>('/api/auth/signup', { full_name, email, password });

export const login = (email: string, password: string) =>
  request<AuthUser>('/api/auth/login', { email, password });

export const createStaff = (admin_id: number, full_name: string, email: string, password: string, phone: string, address: string, status: string) =>
  request<AuthUser>('/api/admin/staff', { admin_id: String(admin_id), full_name, email, password, phone, address, status });

export const updateAdminSettings = (admin_id: number, data: Record<string, string>) =>
  request<AuthUser>('/api/admin/settings', { admin_id: String(admin_id), ...data });
