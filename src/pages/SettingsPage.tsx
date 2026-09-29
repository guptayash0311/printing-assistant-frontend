import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ApiError, saveSettings, shopSettings } from "../api";
import { loadAuth } from "../session";

const settingsSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Use a color like #1f4b3a"),
  logo_url: z.string(),
});

export function SettingsPage() {
  const auth = loadAuth();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => shopSettings(auth!.access_token) });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    primary_color: "#1f4b3a",
    logo_url: "",
  });
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (settings.data) {
      setForm({
        name: settings.data.name,
        phone: settings.data.phone ?? "",
        email: settings.data.email ?? "",
        address: settings.data.address ?? "",
        primary_color: settings.data.primary_color,
        logo_url: settings.data.logo_url ?? "",
      });
    }
  }, [settings.data]);
  const save = useMutation({
    mutationFn: () =>
      saveSettings(auth!.access_token, {
        name: form.name,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        primary_color: form.primary_color,
        logo_url: form.logo_url || null,
      }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not save settings."),
  });

  if (settings.isLoading) {
    return <p>Loading settings…</p>;
  }
  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const parsed = settingsSchema.safeParse(form);
        if (!parsed.success) {
          setError(parsed.error.issues[0]?.message ?? "Check the form.");
          return;
        }
        save.mutate();
      }}
    >
      <h1 className="text-3xl font-semibold">Shop settings</h1>
      {(
        [
          ["name", "Name"],
          ["phone", "Phone"],
          ["email", "Email"],
          ["address", "Address"],
          ["primary_color", "Color"],
          ["logo_url", "Logo https URL"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="block text-sm">
          {label}
          <input
            className="mt-1 w-full rounded-lg border bg-white px-3 py-2"
            value={form[key]}
            onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      ))}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" type="submit">
        Save
      </button>
    </form>
  );
}
