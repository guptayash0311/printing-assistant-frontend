import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { ApiError, adminTenants, createTenant, suspendTenant } from "../api";
import { loadAuth, saveAuth } from "../session";

const tenantSchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens."),
  admin_email: z.string().email(),
  admin_password: z.string().min(8),
  phone: z.string(),
  currency: z.string().length(3),
  address: z.string(),
});

export function AdminTenantsPage() {
  const auth = loadAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tenants = useQuery({ queryKey: ["admin-tenants"], queryFn: () => adminTenants(auth!.access_token) });
  const [form, setForm] = useState({
    name: "",
    slug: "",
    admin_email: "",
    admin_password: "",
    phone: "",
    currency: "INR",
    address: "",
  });
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () =>
      createTenant(auth!.access_token, {
        ...form,
        phone: form.phone || undefined,
        address: form.address || undefined,
      }),
    onSuccess: async () => {
      setError(null);
      setForm({ name: "", slug: "", admin_email: "", admin_password: "", phone: "", currency: "INR", address: "" });
      await queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not create the shop."),
  });
  const suspend = useMutation({
    mutationFn: (tenantId: string) => suspendTenant(auth!.access_token, tenantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["admin-tenants"] });
    },
  });

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Shops</h1>
        <button
          className="text-sm"
          onClick={() => {
            saveAuth(null);
            navigate("/login");
          }}
        >
          Log out
        </button>
      </div>
      <form
        className="mt-6 grid gap-3 rounded-xl bg-white p-4 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = tenantSchema.safeParse(form);
          if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? "Check the form.");
            return;
          }
          create.mutate();
        }}
      >
        {(
          [
            ["name", "Shop name"],
            ["slug", "Link slug"],
            ["admin_email", "Admin email"],
            ["admin_password", "Admin password"],
            ["phone", "Phone"],
            ["currency", "Currency"],
            ["address", "Address"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-sm">
            {label}
            <input
              className="mt-1 w-full rounded border px-2 py-1"
              value={form[key]}
              onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
        {error ? <p className="text-sm text-red-700 sm:col-span-2">{error}</p> : null}
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-white sm:col-span-2" type="submit">
          Create shop
        </button>
      </form>
      {tenants.isLoading ? <p className="mt-6">Loading shops…</p> : null}
      <ul className="mt-6 divide-y rounded-xl bg-white">
        {tenants.data?.items.map((tenant) => (
          <li key={tenant.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{tenant.name}</p>
              <p className="text-sm text-stone-600">
                /s/{tenant.slug} · {tenant.status}
              </p>
            </div>
            {tenant.status === "active" ? (
              <button className="text-sm underline" onClick={() => suspend.mutate(tenant.id)}>
                Suspend
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </main>
  );
}
