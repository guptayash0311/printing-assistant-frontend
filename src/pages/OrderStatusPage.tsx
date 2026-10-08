import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ApiError, getCustomerOrder, getShop } from "../api";
import { loadCustomerAccess } from "../session";
import { BUILDING_STATUSES, OrderFlow } from "./OrderFlow";

function accent(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#1f4b3a";
}

export function OrderStatusPage() {
  const { tenantSlug = "", orderId = "" } = useParams();
  const queryClient = useQueryClient();
  const access = loadCustomerAccess(tenantSlug);
  const shop = useQuery({ queryKey: ["shop", tenantSlug], queryFn: () => getShop(tenantSlug) });
  const order = useQuery({
    queryKey: ["customer-order", orderId],
    enabled: access?.orderId === orderId,
    queryFn: () => getCustomerOrder(orderId, access!.accessToken),
    refetchInterval: (query) =>
      query.state.data?.files.some((file) => file.status === "PROCESSING" || file.status === "UPLOADING")
        ? 1500
        : false,
  });

  if (!access || access.orderId !== orderId) {
    return <p className="p-8">Open this order from the same browser that placed it.</p>;
  }
  if (order.isLoading || shop.isLoading) {
    return <p className="p-8">Loading order…</p>;
  }
  if (order.isError || !order.data || !shop.data) {
    const message = order.error instanceof ApiError ? order.error.message : "Order was not found.";
    return <p className="p-8">{message}</p>;
  }

  const current = order.data;
  if (BUILDING_STATUSES.includes(current.status)) {
    return (
      <main className="mx-auto min-h-screen max-w-lg px-4 py-8">
        <header className="rounded-2xl px-5 py-6 text-white" style={{ backgroundColor: accent(shop.data.primary_color) }}>
          {shop.data.logo_url?.startsWith("https://") ? (
            <img src={shop.data.logo_url} alt="" className="mb-3 h-10 w-10 rounded-full bg-white object-cover" />
          ) : null}
          <h1 className="text-3xl font-semibold">{shop.data.name}</h1>
          <p className="mt-1 text-sm text-white/80">{[shop.data.address, shop.data.phone].filter(Boolean).join(" · ")}</p>
        </header>
        <section className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
          <OrderFlow
            order={current}
            token={access.accessToken}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["customer-order", orderId] })}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <p className="text-sm text-stone-500">{shop.data.name}</p>
      <h1 className="text-3xl font-semibold">{current.order_number}</h1>
      <p className="mt-4 text-center text-4xl font-bold tracking-[0.3em]">{current.pickup_code ?? "—"}</p>
      <p className="mt-2 text-center">Status: {current.status.replaceAll("_", " ")}</p>
      <p className="mt-4 text-sm text-stone-600">
        Total {current.currency} {current.grand_total}. Pay at the shop when you collect.
      </p>
      {current.rejection_reason ? <p className="mt-3 text-sm text-red-700">{current.rejection_reason}</p> : null}
      <ol className="mt-6 space-y-2 text-sm">
        {current.events.map((event) => (
          <li key={event.id}>
            {event.event_type.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString()}
          </li>
        ))}
      </ol>
      <Link className="mt-6 inline-block text-sm underline" to={`/s/${tenantSlug}`}>
        Back to shop
      </Link>
    </main>
  );
}
