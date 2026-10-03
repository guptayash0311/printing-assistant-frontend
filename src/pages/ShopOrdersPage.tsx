import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, shopOrders } from "../api";
import { loadAuth } from "../session";

function contactLabel(name: string | null, phone: string | null) {
  const parts = [name, phone].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "Guest";
}

export function ShopOrdersPage() {
  const auth = loadAuth();
  const [pickup, setPickup] = useState("");
  const [search, setSearch] = useState("");
  const orders = useQuery({
    queryKey: ["shop-orders", search],
    queryFn: () => shopOrders(auth!.access_token, search || undefined),
  });

  return (
    <div>
      <h1 className="text-3xl font-semibold">Queue</h1>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(pickup.trim().toUpperCase());
        }}
      >
        <input
          className="rounded-lg border bg-white px-3 py-2"
          placeholder="Pickup code"
          value={pickup}
          onChange={(event) => setPickup(event.target.value)}
        />
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" type="submit">
          Find
        </button>
        {search ? (
          <button
            className="text-sm"
            type="button"
            onClick={() => {
              setPickup("");
              setSearch("");
            }}
          >
            Clear
          </button>
        ) : null}
      </form>
      {orders.isLoading ? <p className="mt-6">Loading orders…</p> : null}
      {orders.isError ? (
        <p className="mt-6 text-red-700">{orders.error instanceof ApiError ? orders.error.message : "Could not load orders."}</p>
      ) : null}
      {orders.data?.items.length === 0 ? <p className="mt-6 text-stone-600">No orders yet.</p> : null}
      <ul className="mt-6 divide-y rounded-xl bg-white">
        {orders.data?.items.map((order) => (
          <li key={order.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{order.pickup_code ?? order.order_number}</p>
              <p className="text-sm text-stone-600">
                {contactLabel(order.contact_name, order.contact_phone)} · {order.status.replaceAll("_", " ")}
              </p>
            </div>
            <Link className="text-sm underline" to={`/shop/orders/${order.id}`}>
              Open
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
