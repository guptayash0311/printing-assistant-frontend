import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ApiError, getCustomerOrder, getShop } from "../api";
import { loadCustomerAccess } from "../session";

export function OrderStatusPage() {
  const { tenantSlug = "", orderId = "" } = useParams();
  const access = loadCustomerAccess(tenantSlug);
  const shop = useQuery({ queryKey: ["shop", tenantSlug], queryFn: () => getShop(tenantSlug) });
  const order = useQuery({
    queryKey: ["customer-order", orderId],
    enabled: access?.orderId === orderId,
    queryFn: () => getCustomerOrder(orderId, access!.accessToken),
  });

  if (!access || access.orderId !== orderId) {
    return <p className="p-8">Open this order from the same browser that placed it.</p>;
  }
  if (order.isLoading || shop.isLoading) {
    return <p className="p-8">Loading order…</p>;
  }
  if (order.isError || !order.data) {
    const message = order.error instanceof ApiError ? order.error.message : "Order was not found.";
    return <p className="p-8">{message}</p>;
  }
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <p className="text-sm text-stone-500">{shop.data?.name}</p>
      <h1 className="text-3xl font-semibold">{order.data.order_number}</h1>
      <p className="mt-4 text-center text-4xl font-bold tracking-[0.3em]">{order.data.pickup_code ?? "—"}</p>
      <p className="mt-2 text-center">Status: {order.data.status.replaceAll("_", " ")}</p>
      <p className="mt-4 text-sm text-stone-600">
        Total {order.data.currency} {order.data.grand_total}. Pay at the shop when you collect.
      </p>
      {order.data.rejection_reason ? <p className="mt-3 text-sm text-red-700">{order.data.rejection_reason}</p> : null}
      <ol className="mt-6 space-y-2 text-sm">
        {order.data.events.map((event) => (
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
