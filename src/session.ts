import type { LoginResponse } from "./types";

const AUTH_KEY = "print-auth";

export function loadAuth(): LoginResponse | null {
  const raw = sessionStorage.getItem(AUTH_KEY);
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as LoginResponse;
}

export function saveAuth(value: LoginResponse | null) {
  if (value) {
    sessionStorage.setItem(AUTH_KEY, JSON.stringify(value));
  } else {
    sessionStorage.removeItem(AUTH_KEY);
  }
}

export function customerKey(slug: string) {
  return `print-order:${slug}`;
}

export function loadCustomerAccess(slug: string): { orderId: string; accessToken: string } | null {
  const raw = sessionStorage.getItem(customerKey(slug));
  if (!raw) {
    return null;
  }
  return JSON.parse(raw) as { orderId: string; accessToken: string };
}

export function saveCustomerAccess(slug: string, orderId: string, accessToken: string) {
  sessionStorage.setItem(customerKey(slug), JSON.stringify({ orderId, accessToken }));
}
