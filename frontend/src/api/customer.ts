import type { AuthUser } from "./auth";

export interface CustomerProduct {
  product_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  standard_price: number;
  special_price: boolean;
}

export interface CartLine {
  product_id: number;
  quantity: number;
  specifications: string;
}

export interface CustomerOrder {
  order_id: number;
  order_type: string;
  amount_paid: number;
  amount_due: number;
  created_at: string;
  production_stage: string;
  payment_status: string;
  payment_method: "cash" | "whish_money";
  payment_timing: "on_order" | "after_pickup";
  total: number;
  contact_phone: string;
  design_request_note: string | null;
  payment_reference: string | null;
  items: {
    order_item_id: number;
    product_id: number | null;
    name: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
    specifications: string | null;
  }[];
  files: {
    file_id: number;
    name: string;
    size: number;
    verification_status: string;
  }[];
}

export interface PortalConfig {
  whish_phone: string;
  currency: string;
}

export interface CheckoutInput {
  request_key: string;
  items: CartLine[];
  files: { name: string; data_url: string }[];
  design_request_note: string;
  contact_phone: string;
  expected_total: number;
  payment_method: "cash" | "whish_money";
  payment_timing: "on_order" | "after_pickup";
}

export async function customerRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/customer${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
    credentials: "same-origin",
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail =
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((item: { msg: string }) => item.msg).join(" ")
          : "Something went wrong. Please try again.";
    throw new Error(detail);
  }
  return response.json();
}

export const getCustomerProfile = (signal?: AbortSignal) =>
  customerRequest<AuthUser>("/profile", { signal });
export const getCustomerProducts = (signal?: AbortSignal) =>
  customerRequest<CustomerProduct[]>("/products", { signal });
export const getCustomerOrders = (signal?: AbortSignal) =>
  customerRequest<CustomerOrder[]>("/orders", { signal });
export const getPortalConfig = (signal?: AbortSignal) =>
  customerRequest<PortalConfig>("/config", { signal });
export const placeCustomerOrder = (payload: CheckoutInput) =>
  customerRequest<CustomerOrder>("/orders", {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const saveCustomerProfile = (
  payload: Pick<
    AuthUser,
    "full_name" | "email" | "phone" | "address" | "profile_image"
  >,
) =>
  customerRequest<AuthUser>("/profile", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const changeCustomerPassword = (
  current_password: string,
  new_password: string,
) =>
  customerRequest<{ message: string }>("/password", {
    method: "PUT",
    body: JSON.stringify({ current_password, new_password }),
  });

export const submitTransferReference = (orderId: number, reference: string) =>
  customerRequest<CustomerOrder>(`/orders/${orderId}/payment-reference`, {
    method: "POST",
    body: JSON.stringify({ reference }),
  });

export const customerMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

export function readFileData(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () =>
      reject(new Error(`Unable to read ${file.name}. Please choose it again.`));
    reader.readAsDataURL(file);
  });
}
