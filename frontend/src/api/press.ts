import type { AuthUser } from "./auth";
import type { CustomerOrder } from "./customer";

export interface PressOrder extends CustomerOrder {
  customer_name: string;
  customer_email: string;
  customer_address?: string | null;
  order_type: string;
  amount_paid: number;
  amount_due: number;
}

export interface PressCustomer {
  role?: string;
  business_name?: string | null;
  id: number;
  kind: "account" | "walk_in";
  full_name: string;
  phone: string;
  email: string;
  address: string;
}

export interface PressProduct {
  product_id: number;
  name: string;
  price: number | null;
  price_kind: 'retail' | 'wholesale' | 'special';
  image_url?: string | null;
  description?: string | null;
  special_price: boolean;
}

export async function pressRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`/api/press${path}`, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      typeof body.detail === "string"
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((item: { msg: string }) => item.msg).join(" ")
          : "Unable to complete this request. Please try again.";
    throw new Error(message);
  }
  return response.json();
}

export const getPressProfile = (signal?: AbortSignal) =>
  pressRequest<AuthUser>("/profile", { signal });
