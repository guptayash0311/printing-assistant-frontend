import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();
  const [slug, setSlug] = useState("");
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <p className="text-sm uppercase tracking-widest text-stone-500">Print shop</p>
      <h1 className="mt-2 text-4xl font-semibold">Send a print job to your shop.</h1>
      <p className="mt-3 text-stone-600">Open the link your shop shared, or enter the shop name here.</p>
      <form
        className="mt-8 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const cleaned = slug.trim().toLowerCase();
          if (cleaned) {
            navigate(`/s/${cleaned}`);
          }
        }}
      >
        <input
          className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2"
          placeholder="shop-slug"
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
        />
        <button className="rounded-lg bg-stone-900 px-4 py-2 text-white" type="submit">
          Open
        </button>
      </form>
      <a className="mt-6 text-sm text-stone-500" href="/login">
        Shop login
      </a>
    </main>
  );
}
