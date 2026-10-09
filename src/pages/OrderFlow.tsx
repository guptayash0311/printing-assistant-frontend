import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ApiError, calculatePrice, deleteFile, placeOrder, saveSegments, uploadFile } from "../api";
import type { Order, OrderFile, PriceQuote, PrintSegment, SegmentDraft } from "../types";

export const BUILDING_STATUSES = ["DRAFT", "UPLOADED", "PRICE_CALCULATED"];

export function OrderFlow({
  order,
  token,
  onChanged,
}: {
  order: Order;
  token: string;
  onChanged: () => void | Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, SegmentDraft>>({});

  useEffect(() => {
    setDrafts((current) => {
      const next = { ...current };
      for (const file of order.files) {
        if (file.status === "READY" && file.page_count && !next[file.id]) {
          next[file.id] = draftForFile(file, order.segments);
        }
      }
      for (const fileId of Object.keys(next)) {
        if (!order.files.some((file) => file.id === fileId)) {
          delete next[fileId];
        }
      }
      return next;
    });
  }, [order.files, order.segments]);

  if (order.status === "PRICE_CALCULATED" && !editing) {
    return <ReviewStep order={order} token={token} onChanged={onChanged} onEdit={() => setEditing(true)} />;
  }
  return (
    <DocumentsStep
      order={order}
      token={token}
      drafts={drafts}
      onDrafts={setDrafts}
      onChanged={onChanged}
      onPriced={() => {
        setEditing(false);
        void onChanged();
      }}
    />
  );
}

function DocumentsStep({
  order,
  token,
  drafts,
  onDrafts,
  onChanged,
  onPriced,
}: {
  order: Order;
  token: string;
  drafts: Record<string, SegmentDraft>;
  onDrafts: (update: (current: Record<string, SegmentDraft>) => Record<string, SegmentDraft>) => void;
  onChanged: () => void | Promise<unknown>;
  onPriced: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Array<{ id: string; name: string }>>([]);
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploading = useRef(false);

  const price = useMutation({
    mutationFn: async () => {
      const segments = order.files
        .filter((file) => file.status === "READY" && file.page_count)
        .map((file) => drafts[file.id] ?? draftForFile(file, order.segments));
      await saveSegments(order.id, token, segments);
      return calculatePrice(order.id, token);
    },
    onSuccess: () => onPriced(),
    onError: (reason: unknown) => {
      setError(reason instanceof ApiError ? reason.message : "Could not price this order.");
      void onChanged();
    },
  });

  const remove = useMutation({
    mutationFn: (fileId: string) => deleteFile(order.id, token, fileId),
    onSuccess: async (_order, fileId) => {
      setEditingFileId((current) => (current === fileId ? null : current));
      setError(null);
      await onChanged();
    },
    onError: (reason: unknown) => setError(reason instanceof ApiError ? reason.message : "Could not remove that document."),
  });

  const readyFiles = order.files.filter((file) => file.status === "READY" && file.page_count);
  const blocked = order.files.some((file) => file.status !== "READY") || pending.length > 0;
  const rangesValid = readyFiles.every((file) => {
    const draft = drafts[file.id] ?? draftForFile(file, order.segments);
    return rangeIsValid(draft, file.page_count ?? 1);
  });
  const editingFile = order.files.find((file) => file.id === editingFileId) ?? null;

  async function uploadSelected(list: FileList | null) {
    const chosen = list ? Array.from(list) : [];
    if (fileInput.current) {
      fileInput.current.value = "";
    }
    if (chosen.length === 0 || uploading.current) {
      return;
    }
    uploading.current = true;
    setError(null);
    for (const file of chosen) {
      const pendingId = `${file.name}-${crypto.randomUUID()}`;
      setPending((current) => [...current, { id: pendingId, name: file.name }]);
      try {
        await uploadFile(order.id, token, file);
        await onChanged();
      } catch (reason: unknown) {
        setError(reason instanceof ApiError ? reason.message : "Upload failed.");
      } finally {
        setPending((current) => current.filter((item) => item.id !== pendingId));
      }
    }
    uploading.current = false;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Documents</h2>
      <table className="w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b text-stone-500">
            <th className="w-[38%] py-2 pr-2 font-medium">Document</th>
            <th className="py-2 pr-2 font-medium">Printing options</th>
            <th className="w-16 py-2 text-right font-medium">Delete</th>
          </tr>
        </thead>
        <tbody>
          {order.files.map((file) => {
            const draft = file.status === "READY" && file.page_count ? (drafts[file.id] ?? draftForFile(file, order.segments)) : null;
            return (
              <tr key={file.id} className="border-b align-top">
                <td className="py-3 pr-2">
                  <p className="break-words font-medium">{file.original_filename}</p>
                  <p className="mt-1 text-xs text-stone-500">{fileStatusLabel(file)}</p>
                </td>
                <td className="py-3 pr-2">
                  {draft ? (
                    <button
                      className="text-left underline decoration-stone-300 underline-offset-2"
                      type="button"
                      onClick={() => setEditingFileId(file.id)}
                    >
                      {optionSummary(draft, file.page_count ?? draft.page_end)}
                    </button>
                  ) : (
                    <span className="text-stone-500">{file.status === "FAILED" ? "Unavailable" : "Waiting"}</span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <button
                    className="text-red-700 underline disabled:opacity-40"
                    type="button"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(file.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            );
          })}
          {pending.map((item) => (
            <tr key={item.id} className="border-b align-top">
              <td className="py-3 pr-2">
                <p className="break-words font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-stone-500">Uploading</p>
              </td>
              <td className="py-3 pr-2 text-stone-500">Waiting</td>
              <td />
            </tr>
          ))}
        </tbody>
      </table>
      {order.files.length === 0 && pending.length === 0 ? (
        <p className="text-sm text-stone-500">Add a PDF or image to start this order.</p>
      ) : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
      <input
        ref={fileInput}
        className="hidden"
        type="file"
        accept="application/pdf,image/jpeg,image/png"
        multiple
        onChange={(event) => void uploadSelected(event.target.files)}
      />
      <button className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2" type="button" onClick={() => fileInput.current?.click()}>
        Add documents
      </button>
      <button
        className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-40"
        type="button"
        disabled={price.isPending || readyFiles.length === 0 || blocked || !rangesValid}
        onClick={() => price.mutate()}
      >
        See price
      </button>
      {editingFile && editingFile.page_count ? (
        <OptionsModal
          file={editingFile}
          draft={drafts[editingFile.id] ?? draftForFile(editingFile, order.segments)}
          onCancel={() => setEditingFileId(null)}
          onSave={(draft) => {
            onDrafts((current) => ({ ...current, [editingFile.id]: draft }));
            setEditingFileId(null);
          }}
        />
      ) : null}
    </div>
  );
}

function OptionsModal({
  file,
  draft,
  onCancel,
  onSave,
}: {
  file: OrderFile;
  draft: SegmentDraft;
  onCancel: () => void;
  onSave: (draft: SegmentDraft) => void;
}) {
  const [value, setValue] = useState(draft);
  const image = file.mime_type.startsWith("image/");
  const pageCount = file.page_count ?? 1;
  const valid = rangeIsValid(value, pageCount) && value.copies >= 1 && value.copies <= 500;
  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-stone-950/40 p-4 sm:items-center" role="presentation" onClick={onCancel}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="print-options-title"
        className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4 shadow-lg"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (valid) {
            onSave(image ? { ...value, page_start: 1, page_end: 1 } : value);
          }
        }}
      >
        <h3 id="print-options-title" className="break-words text-lg font-semibold">
          {file.original_filename}
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label>
            From
            <input
              className="mt-1 w-full rounded border px-2 py-1 disabled:bg-stone-100"
              type="number"
              min={1}
              max={pageCount}
              value={image ? 1 : value.page_start}
              disabled={image}
              onChange={(event) => setValue((current) => ({ ...current, page_start: Number(event.target.value) }))}
            />
          </label>
          <label>
            To
            <input
              className="mt-1 w-full rounded border px-2 py-1 disabled:bg-stone-100"
              type="number"
              min={1}
              max={pageCount}
              value={image ? 1 : value.page_end}
              disabled={image}
              onChange={(event) => setValue((current) => ({ ...current, page_end: Number(event.target.value) }))}
            />
          </label>
          <label>
            Paper
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={value.paper_size}
              onChange={(event) => setValue((current) => ({ ...current, paper_size: event.target.value as SegmentDraft["paper_size"] }))}
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
              value={value.color_mode}
              onChange={(event) => setValue((current) => ({ ...current, color_mode: event.target.value as SegmentDraft["color_mode"] }))}
            >
              <option value="BW">Black and white</option>
              <option value="COLOR">Color</option>
            </select>
          </label>
          <label>
            Sides
            <select
              className="mt-1 w-full rounded border px-2 py-1"
              value={value.sides}
              onChange={(event) => setValue((current) => ({ ...current, sides: event.target.value as SegmentDraft["sides"] }))}
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
              max={500}
              value={value.copies}
              onChange={(event) => setValue((current) => ({ ...current, copies: Number(event.target.value) }))}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button className="flex-1 rounded-lg border px-4 py-2" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="flex-1 rounded-lg bg-stone-900 px-4 py-2 text-white disabled:opacity-40" type="submit" disabled={!valid}>
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

function ReviewStep({
  order,
  token,
  onChanged,
  onEdit,
}: {
  order: Order;
  token: string;
  onChanged: () => void | Promise<unknown>;
  onEdit: () => void;
}) {
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
      <button className="w-full rounded-lg border border-stone-300 bg-white px-4 py-2" type="button" onClick={onEdit}>
        Edit documents
      </button>
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

function draftForFile(file: OrderFile, segments: PrintSegment[]): SegmentDraft {
  const saved = segments.find((segment) => segment.file_id === file.id);
  if (saved) {
    return {
      file_id: file.id,
      page_start: saved.page_start,
      page_end: saved.page_end,
      paper_size: paperSize(saved.paper_size),
      color_mode: saved.color_mode === "COLOR" ? "COLOR" : "BW",
      sides: saved.sides === "DUPLEX" ? "DUPLEX" : "SIMPLEX",
      orientation: "PORTRAIT",
      copies: saved.copies,
    };
  }
  return {
    file_id: file.id,
    page_start: 1,
    page_end: file.page_count ?? 1,
    paper_size: "A4",
    color_mode: "BW",
    sides: "SIMPLEX",
    orientation: "PORTRAIT",
    copies: 1,
  };
}

function paperSize(value: string): SegmentDraft["paper_size"] {
  if (value === "A3" || value === "LETTER") {
    return value;
  }
  return "A4";
}

function rangeIsValid(draft: SegmentDraft, pageCount: number) {
  return draft.page_start >= 1 && draft.page_end >= draft.page_start && draft.page_end <= pageCount;
}

function optionSummary(draft: SegmentDraft, pageCount: number) {
  const pages = draft.page_start === 1 && draft.page_end === pageCount ? "All pages" : `Pages ${draft.page_start}–${draft.page_end}`;
  const color = draft.color_mode === "BW" ? "B&W" : "Color";
  const sides = draft.sides === "SIMPLEX" ? "One side" : "Both sides";
  return `${pages} · ${draft.paper_size} · ${color} · ${sides} · ×${draft.copies}`;
}

function fileStatusLabel(file: OrderFile) {
  if (file.status === "READY" && file.page_count) {
    return file.page_count === 1 ? "1 page" : `${file.page_count} pages`;
  }
  if (file.status === "FAILED") {
    return file.error_message ?? "Failed";
  }
  if (file.status === "PROCESSING" || file.status === "UPLOADING") {
    return "Processing";
  }
  return file.status;
}
