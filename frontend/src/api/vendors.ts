export interface Vendor {
  vendor_id: number;
  name: string;
  phone: string | null;
  email: string | null;
}

export interface VendorForm {
  name: string;
  phone: string;
  email: string;
}

async function vendorRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`/api/admin/vendors${path}`, options);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === 'string'
      ? body.detail
      : 'Please check the vendor details and try again.';
    throw new Error(detail);
  }

  return response.status === 204 ? undefined as T : response.json();
}

export function getVendors(adminId: number, signal?: AbortSignal) {
  return vendorRequest<Vendor[]>(`?admin_id=${adminId}`, { signal });
}

export function saveVendor(adminId: number, form: VendorForm, vendorId?: number) {
  return vendorRequest<Vendor>(vendorId ? `/${vendorId}` : '', {
    method: vendorId ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ admin_id: adminId, ...form }),
  });
}

export function deleteVendor(adminId: number, vendorId: number) {
  return vendorRequest<void>(`/${vendorId}?admin_id=${adminId}`, {
    method: 'DELETE',
  });
}
