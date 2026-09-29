import type { LoginResponse, Order, OrderFile, Page, PriceQuote, PricingRule, Shop, User } from "./types";

const base = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  token?: string | null;
  orderToken?: string | null;
  idempotencyKey?: string;
};

export async function api<T>(path: string, options: Options = {}): Promise<T> {
  const headers = new Headers();
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }
  if (options.orderToken) {
    headers.set("X-Order-Access-Token", options.orderToken);
  }
  if (options.idempotencyKey) {
    headers.set("Idempotency-Key", options.idempotencyKey);
  }
  const response = await fetch(`${base}/api/v1${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "Request failed.",
    );
  }
  return (await response.json()) as T;
}

export function getShop(slug: string) {
  return api<Shop>(`/public/shops/${slug}`);
}

export function createOrder(slug: string, contactName: string, contactPhone: string) {
  return api<Order>(`/public/shops/${slug}/orders`, {
    body: { contact_name: contactName, contact_phone: contactPhone },
  });
}

export function getCustomerOrder(orderId: string, orderToken: string) {
  return api<Order>(`/public/orders/${orderId}`, { orderToken });
}

export async function uploadFile(orderId: string, orderToken: string, file: File) {
  const body = new FormData();
  body.set("file", file);
  const response = await fetch(`${base}/api/v1/public/orders/${orderId}/files`, {
    method: "POST",
    headers: { "X-Order-Access-Token": orderToken },
    body,
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "UPLOAD_FAILED",
      payload?.error?.message ?? "Upload failed.",
    );
  }
  return (await response.json()) as OrderFile;
}

export function saveSegments(orderId: string, orderToken: string, segments: unknown[]) {
  return api<Order>(`/public/orders/${orderId}/segments`, {
    method: "PUT",
    orderToken,
    body: { segments },
  });
}

export function calculatePrice(orderId: string, orderToken: string) {
  return api<PriceQuote>(`/public/orders/${orderId}/calculate-price`, { orderToken, body: {} });
}

export function placeOrder(orderId: string, orderToken: string) {
  return api<Order>(`/public/orders/${orderId}/place`, { orderToken, body: {} });
}

export function login(email: string, password: string) {
  return api<LoginResponse>("/auth/login", { body: { email, password } });
}

export function me(token: string) {
  return api<User>("/auth/me", { token });
}

export function shopOrders(token: string, pickupCode?: string) {
  if (pickupCode) {
    return api<Order>(`/shop/orders/lookup?pickup_code=${encodeURIComponent(pickupCode)}`, { token }).then(
      (order) => ({ items: [order], page: 1, page_size: 1, total: 1 }) satisfies Page<Order>,
    );
  }
  return api<Page<Order>>("/shop/orders?page_size=50", { token });
}

export function shopOrder(token: string, orderId: string) {
  return api<Order>(`/shop/orders/${orderId}`, { token });
}

export function shopAction(token: string, orderId: string, action: string, body?: unknown) {
  return api<Order>(`/shop/orders/${orderId}/${action}`, {
    token,
    body: body ?? {},
    idempotencyKey: action === "mark-paid" ? `paid-${orderId}` : undefined,
  });
}

export async function downloadShopFile(token: string, orderId: string, fileId: string, filename: string) {
  const response = await fetch(`${base}/api/v1/shop/orders/${orderId}/files/${fileId}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, "DOWNLOAD_FAILED", "Could not download the file.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function shopPricing(token: string) {
  return api<{ currency: string; rules: PricingRule[] }>("/shop/pricing", { token });
}

export function savePricing(token: string, rules: PricingRule[]) {
  return api<{ currency: string; rules: PricingRule[] }>("/shop/pricing", {
    method: "PUT",
    token,
    body: { rules },
  });
}

export function shopSettings(token: string) {
  return api<Shop>("/shop/settings", { token });
}

export function saveSettings(token: string, body: Partial<Shop>) {
  return api<Shop>("/shop/settings", { method: "PUT", token, body });
}

export function adminTenants(token: string) {
  return api<{ items: Shop[] }>("/admin/tenants", { token });
}

export function createTenant(
  token: string,
  body: {
    name: string;
    slug: string;
    admin_email: string;
    admin_password: string;
    phone?: string;
    currency: string;
    address?: string;
  },
) {
  return api<Shop>("/admin/tenants", { body, token });
}

export function suspendTenant(token: string, tenantId: string) {
  return api<Shop>(`/admin/tenants/${tenantId}/suspend`, { token, body: {} });
}
