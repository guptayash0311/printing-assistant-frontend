import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { ApiError, calculatePrice, createOrder, getCustomerOrder, getShop, placeOrder, saveSegments, uploadFile } from "../api";
import { loadCustomerAccess, saveCustomerAccess } from "../session";
import type { Order, PriceQuote, SegmentDraft } from "../types";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter your name."),
  phone: z.string().trim().min(8, "Enter a phone number."),
});

function accent(color: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(color) ? color : "#1f4b3a";
}

export function ShopPage() {
  const { tenantSlug = "" } = useParams();
  const queryClient = useQueryClient();
  const shopQuery = useQuery({ queryKey: ["shop", tenantSlug], queryFn: () => getShop(tenantSlug) });
  const [access, setAccess] = useState(() => loadCustomerAccess(tenantSlug));
  const orderQuery = useQuery({
    queryKey: ["customer-order", access?.orderId],
    enabled: Boolean(access),
    queryFn: () => getCustomerOrder(access!.orderId, access!.accessToken),
    refetchInterval: (query) =>
      query.state.data?.files.some((file) => file.status === "PROCESSING" || file.status === "UPLOADING")
        ? 1500
        : false,
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
        {access && orderQuery.data ? (
          <OrderFlow
            slug={tenantSlug}
            order={orderQuery.data}
            token={access.accessToken}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["customer-order", access.orderId] })}
          />
        ) : (
          <ContactStep
            onCreated={(order) => {
              const token = order.access_token;
              if (!token) {
                return;
              }
              saveCustomerAccess(tenantSlug, order.id, token);
              setAccess({ orderId: order.id, accessToken: token });
            }}
          />
        )}
        {orderQuery.isError ? <p className="mt-3 text-sm text-red-700">Could not load this order.</p> : null}
      </section>
    </main>
  );
}

function ContactStep({ onCreated }: { onCreated: (order: Order) => void }) {
  const { tenantSlug = "" } = useParams();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: () => createOrder(tenantSlug, name, phone),
    onSuccess: onCreated,
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not start the order."),
  });
  return (
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
        mutation.mutate();
      }}
    >
      <h2 className="text-xl font-semibold">Your details</h2>
      <label className="block text-sm">
        Name
        <input className="mt-1 w-full rounded-lg border px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="block text-sm">
        Phone
        <input className="mt-1 w-full rounded-lg border px-3 py-2" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white" disabled={mutation.isPending} type="submit">
        Continue
      </button>
    </form>
  );
}

function OrderFlow({
  slug,
  order,
  token,
  onChanged,
}: {
  slug: string;
  order: Order;
  token: string;
  onChanged: () => void;
}) {
  const [configuring, setConfiguring] = useState(false);
  const placed = ["PENDING_APPROVAL", "APPROVED", "REJECTED", "PAID", "PRINTING", "PRINT_FAILED", "READY", "COMPLETED"];
  if (placed.includes(order.status)) {
    return (
      <div>
        <h2 className="text-xl font-semibold">Order {order.order_number}</h2>
        <p className="mt-2 text-sm text-stone-600">Show this code at the counter. Payment is collected at the shop.</p>
        <p className="mt-4 text-center text-4xl font-bold tracking-[0.3em]">{order.pickup_code}</p>
        <p className="mt-2 text-center text-sm">Status: {order.status.replaceAll("_", " ")}</p>
        <Link className="mt-4 inline-block text-sm underline" to={`/s/${slug}/orders/${order.id}`}>
          Track this order
        </Link>
      </div>
    );
  }
  const readyFiles = order.files.filter((file) => file.status === "READY");
  const busy = order.files.some((file) => file.status === "PROCESSING" || file.status === "UPLOADING");
  if (order.status === "PRICE_CALCULATED") {
    return <ReviewStep order={order} token={token} onChanged={onChanged} />;
  }
  if (configuring && readyFiles.length > 0 && !busy) {
    return <ConfigureStep order={order} token={token} onChanged={onChanged} />;
  }
  return (
    <UploadStep
      order={order}
      token={token}
      onChanged={onChanged}
      canContinue={readyFiles.length > 0 && !busy}
      onContinue={() => setConfiguring(true)}
    />
  );
}

function UploadStep({
  order,
  token,
  onChanged,
  canContinue,
  onContinue,
}: {
  order: Order;
  token: string;
  onChanged: () => void;
  canContinue: boolean;
  onContinue: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => uploadFile(order.id, token, file),
    onSuccess: () => {
      setProgress("Uploaded");
      onChanged();
    },
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Upload failed."),
  });
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Upload PDF or images</h2>
      <input
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            setError(null);
            setProgress("Uploading…");
            mutation.mutate(file);
          }
        }}
      />
      {progress ? <p className="text-sm">{progress}</p> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-40" disabled={!canContinue} onClick={onContinue} type="button">
        Set print options
      </button>
      <ul className="space-y-2 text-sm">
        {order.files.map((file) => (
          <li key={file.id}>
            {file.original_filename} · {file.status}
            {file.page_count ? ` · ${file.page_count} pages` : ""}
            {file.error_message ? ` · ${file.error_message}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ConfigureStep({ order, token, onChanged }: { order: Order; token: string; onChanged: () => void }) {
  const [segments, setSegments] = useState<SegmentDraft[]>(
    order.files
      .filter((file) => file.status === "READY" && file.page_count)
      .map((file) => ({
        file_id: file.id,
        page_start: 1,
        page_end: file.page_count ?? 1,
        paper_size: "A4",
        color_mode: "BW",
        sides: "SIMPLEX",
        orientation: "PORTRAIT",
        copies: 1,
      })),
  );
  const [error, setError] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: async () => {
      await saveSegments(order.id, token, segments);
      return calculatePrice(order.id, token);
    },
    onSuccess: () => onChanged(),
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not price this order."),
  });
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <h2 className="text-xl font-semibold">Print options</h2>
      {segments.map((segment, index) => {
        const file = order.files.find((item) => item.id === segment.file_id);
        return (
          <fieldset key={`${segment.file_id}-${index}`} className="space-y-2 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">{file?.original_filename}</legend>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <label>
                From
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  type="number"
                  min={1}
                  value={segment.page_start}
                  onChange={(event) => updateSegment(setSegments, index, { page_start: Number(event.target.value) })}
                />
              </label>
              <label>
                To
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  type="number"
                  min={1}
                  value={segment.page_end}
                  onChange={(event) => updateSegment(setSegments, index, { page_end: Number(event.target.value) })}
                />
              </label>
              <label>
                Paper
                <select
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={segment.paper_size}
                  onChange={(event) =>
                    updateSegment(setSegments, index, { paper_size: event.target.value as SegmentDraft["paper_size"] })
                  }
                >
                  <option>A4</option>
                  <option>A3</option>
                  <option>LETTER</option>
                </select>
              </label>
              <label>
                Color
                <select
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={segment.color_mode}
                  onChange={(event) =>
                    updateSegment(setSegments, index, { color_mode: event.target.value as SegmentDraft["color_mode"] })
                  }
                >
                  <option value="BW">Black and white</option>
                  <option value="COLOR">Color</option>
                </select>
              </label>
              <label>
                Sides
                <select
                  className="mt-1 w-full rounded border px-2 py-1"
                  value={segment.sides}
                  onChange={(event) => updateSegment(setSegments, index, { sides: event.target.value as SegmentDraft["sides"] })}
                >
                  <option value="SIMPLEX">One side</option>
                  <option value="DUPLEX">Both sides</option>
                </select>
              </label>
              <label>
                Copies
                <input
                  className="mt-1 w-full rounded border px-2 py-1"
                  type="number"
                  min={1}
                  value={segment.copies}
                  onChange={(event) => updateSegment(setSegments, index, { copies: Number(event.target.value) })}
                />
              </label>
            </div>
          </fieldset>
        );
      })}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white" disabled={mutation.isPending} type="submit">
        See price
      </button>
    </form>
  );
}

function ReviewStep({ order, token, onChanged }: { order: Order; token: string; onChanged: () => void }) {
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    calculatePrice(order.id, token)
      .then((result) => {
        if (!cancelled) {
          setQuote(result);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof ApiError ? reason.message : "Could not load the price.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [order.id, token]);
  const place = useMutation({
    mutationFn: () => placeOrder(order.id, token),
    onSuccess: () => onChanged(),
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not place the order."),
  });
  const shown = quote ?? {
    currency: order.currency,
    grand_total: order.grand_total,
    line_items: order.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
    })),
  };
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Review</h2>
      <ul className="space-y-2 text-sm">
        {shown.line_items.map((item) => (
          <li key={item.description} className="flex justify-between gap-3">
            <span>{item.description}</span>
            <span>
              {shown.currency} {item.total}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-2xl font-semibold">
        {shown.currency} {shown.grand_total}
      </p>
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950">
        Pay at the shop when you collect the prints. This screen does not take payment.
      </p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <button
        className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white"
        disabled={place.isPending}
        onClick={() => place.mutate()}
        type="button"
      >
        Place order
      </button>
    </div>
  );
}

function updateSegment(
  setSegments: Dispatch<SetStateAction<SegmentDraft[]>>,
  index: number,
  patch: Partial<SegmentDraft>,
) {
  setSegments((current) => current.map((segment, itemIndex) => (itemIndex === index ? { ...segment, ...patch } : segment)));
}
