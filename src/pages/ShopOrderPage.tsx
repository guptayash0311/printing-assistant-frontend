import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { ApiError, downloadShopFile, shopAction, shopOrder } from "../api";
import { loadAuth } from "../session";

function contactLabel(name: string | null, phone: string | null) {
  const parts = [name, phone].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : "Guest";
}

export function ShopOrderPage() {
  const { orderId = "" } = useParams();
  const auth = loadAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const order = useQuery({
    queryKey: ["shop-order", orderId],
    queryFn: () => shopOrder(auth!.access_token, orderId),
  });
  const action = useMutation({
    mutationFn: (input: { name: string; body?: unknown }) => shopAction(auth!.access_token, orderId, input.name, input.body),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["shop-order", orderId] });
      await queryClient.invalidateQueries({ queryKey: ["shop-orders"] });
    },
    onError: (reasonError: unknown) => {
      setError(reasonError instanceof ApiError ? reasonError.message : "Action failed.");
    },
  });

  if (order.isLoading) {
    return <p>Loading order…</p>;
  }
  if (order.isError || !order.data) {
    return <p>{order.error instanceof ApiError ? order.error.message : "Order was not found."}</p>;
  }
  const current = order.data;
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-stone-500">{current.order_number}</p>
        <h1 className="text-4xl font-semibold tracking-[0.2em]">{current.pickup_code ?? "Draft"}</h1>
        <p className="mt-2">{contactLabel(current.contact_name, current.contact_phone)}</p>
        <p className="text-sm text-stone-600">{current.status.replaceAll("_", " ")}</p>
      </div>
      <section className="rounded-xl bg-white p-4">
        <h2 className="font-medium">Files and instructions</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {current.files.map((file) => (
            <li key={file.id} className="flex justify-between gap-3">
              <span>
                {file.original_filename}
                {file.page_count ? ` · ${file.page_count} pages` : ""}
              </span>
              <button
                className="underline"
                type="button"
                onClick={() => downloadShopFile(auth!.access_token, current.id, file.id, file.original_filename)}
              >
                Download
              </button>
            </li>
          ))}
        </ul>
        <ul className="mt-4 space-y-2 text-sm">
          {current.segments.map((segment) => (
            <li key={segment.id}>
              Pages {segment.page_start}-{segment.page_end}, {segment.paper_size}, {segment.color_mode}, {segment.sides},{" "}
              {segment.orientation}, {segment.copies} copies
            </li>
          ))}
        </ul>
        <p className="mt-4 text-lg font-semibold">
          {current.currency} {current.grand_total}
        </p>
        {current.rejection_reason ? <p className="mt-2 text-sm text-red-700">{current.rejection_reason}</p> : null}
      </section>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        {current.status === "PENDING_APPROVAL" ? (
          <>
            <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" onClick={() => action.mutate({ name: "approve" })}>
              Approve
            </button>
            <input
              className="rounded-lg border bg-white px-3 py-2"
              placeholder="Rejection reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
            <button
              className="rounded-lg border px-4 py-2"
              onClick={() => action.mutate({ name: "reject", body: { reason } })}
            >
              Reject
            </button>
          </>
        ) : null}
        {current.status === "APPROVED" ? (
          <button
            className="rounded-lg bg-stone-900 px-4 py-2 text-white"
            onClick={() =>
              action.mutate({
                name: "mark-paid",
                body: { amount: current.grand_total, currency: current.currency },
              })
            }
          >
            Mark paid {current.currency} {current.grand_total}
          </button>
        ) : null}
        {current.status === "PAID" ? (
          <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" onClick={() => action.mutate({ name: "start-printing" })}>
            Start printing
          </button>
        ) : null}
        {current.status === "PRINTING" ? (
          <>
            <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" onClick={() => action.mutate({ name: "ready" })}>
              Mark ready
            </button>
            <button
              className="rounded-lg border px-4 py-2"
              onClick={() => action.mutate({ name: "print-failed", body: { reason: reason || "Print failed" } })}
            >
              Print failed
            </button>
          </>
        ) : null}
        {current.status === "READY" ? (
          <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" onClick={() => action.mutate({ name: "complete" })}>
            Complete pickup
          </button>
        ) : null}
      </div>
      <section>
        <h2 className="font-medium">Audit</h2>
        <ol className="mt-2 space-y-1 text-sm text-stone-700">
          {current.events.map((event) => (
            <li key={event.id}>
              {event.event_type.replaceAll("_", " ")} · {new Date(event.created_at).toLocaleString()}
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
