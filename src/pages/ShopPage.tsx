import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError, createOrder, getShop } from "../api";
import { saveCustomerAccess } from "../session";
import type { Order } from "../types";

const contactSchema = z.object({
  name: z.string().trim().max(200, "Name is too long."),
  phone: z
    .string()
    .trim()
    .refine((value) => value.length === 0 || (value.length >= 8 && value.length <= 20), "Enter a phone number."),
});

function accent(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#1f4b3a";
}

export function ShopPage() {
  const { tenantSlug = "" } = useParams();
  const navigate = useNavigate();
  const shopQuery = useQuery({ queryKey: ["shop", tenantSlug], queryFn: () => getShop(tenantSlug) });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  function openOrder(order: Order) {
    const token = order.access_token;
    if (!token) {
      return;
    }
    saveCustomerAccess(tenantSlug, order.id, token);
    navigate(`/s/${tenantSlug}/orders/${order.id}`);
  }

  const guest = useMutation({
    mutationFn: () => createOrder(tenantSlug, "", ""),
    onSuccess: openOrder,
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not start the order."),
  });
  const register = useMutation({
    mutationFn: () => createOrder(tenantSlug, name, phone),
    onSuccess: openOrder,
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not start the order."),
  });

  if (shopQuery.isLoading) {
    return <p className="p-8">Loading shop…</p>;
  }
  if (shopQuery.isError || !shopQuery.data) {
    const message = shopQuery.error instanceof ApiError ? shopQuery.error.message : "Shop was not found.";
    return <p className="p-8">{message}</p>;
  }
  const shop = shopQuery.data;
  return (
    <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
      <header className="rounded-2xl px-5 py-6 text-white" style={{ backgroundColor: accent(shop.primary_color) }}>
        {shop.logo_url?.startsWith("https://") ? (
          <img src={shop.logo_url} alt="" className="mb-3 h-10 w-10 rounded-full bg-white object-cover" />
        ) : null}
        <h1 className="text-3xl font-semibold">{shop.name}</h1>
        <p className="mt-1 text-sm text-white/80">{[shop.address, shop.phone].filter(Boolean).join(" · ")}</p>
      </header>
      <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-xl font-semibold">Continue without registering</h2>
        <p className="mt-1 text-sm text-stone-600">Start a print order now. The shop finds it by pickup code.</p>
        <button
          className="mt-4 w-full rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-40"
          disabled={guest.isPending || register.isPending}
          type="button"
          onClick={() => {
            setError(null);
            guest.mutate();
          }}
        >
          Continue to print
        </button>
      </section>
      <section className="mt-4 rounded-2xl bg-white p-5 shadow-sm">
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = contactSchema.safeParse({ name, phone });
            if (!parsed.success) {
              setError(parsed.error.issues[0]?.message ?? "Check the form.");
              return;
            }
            setError(null);
            register.mutate();
          }}
        >
          <h2 className="text-xl font-semibold">Register</h2>
          <p className="text-sm text-stone-600">It is always a pleasure to know you more! Your details help us serve you better.</p>
          <label className="block text-sm">
            Name
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="block text-sm">
            Phone
            <input className="mt-1 w-full rounded-lg border px-3 py-2" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <button
            className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-40"
            disabled={guest.isPending || register.isPending}
            type="submit"
          >
            Register
          </button>
        </form>
      </section>
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
    </main>
  );
}
