import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, savePricing, shopPricing } from "../api";
import { loadAuth } from "../session";
import type { PricingRule } from "../types";

export function PricingPage() {
  const auth = loadAuth();
  const queryClient = useQueryClient();
  const pricing = useQuery({ queryKey: ["pricing"], queryFn: () => shopPricing(auth!.access_token) });
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (pricing.data) {
      setRules(pricing.data.rules);
    }
  }, [pricing.data]);
  const save = useMutation({
    mutationFn: () => savePricing(auth!.access_token, rules),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not save prices."),
  });

  if (pricing.isLoading) {
    return <p>Loading prices…</p>;
  }
  if (pricing.isError || !pricing.data) {
    return <p>Could not load prices.</p>;
  }
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <h1 className="text-3xl font-semibold">Pricing</h1>
      <p className="text-sm text-stone-600">Duplex prices are per physical sheet. One-sided prices are per page.</p>
      {rules.map((rule, index) => (
        <label key={rule.code} className="grid grid-cols-[1fr_8rem] items-center gap-3 rounded-xl bg-white px-4 py-3">
          <span>
            {rule.paper_size} {rule.color_mode} {rule.sides} · {rule.unit}
          </span>
          <input
            className="rounded border px-2 py-1"
            value={rule.unit_price}
            onChange={(event) =>
              setRules((current) =>
                current.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, unit_price: event.target.value } : item,
                ),
              )
            }
          />
        </label>
      ))}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" disabled={save.isPending} type="submit">
        Save prices
      </button>
    </form>
  );
}
