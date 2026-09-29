import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, login } from "../api";
import { saveAuth } from "../session";

export function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-3xl font-semibold">Shop login</h1>
      <p className="mt-2 text-stone-600">Customers do not need an account. This login is for the shop.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          setError(null);
          login(email, password)
            .then((session) => {
              saveAuth(session);
              navigate(session.user.role === "SUPER_ADMIN" ? "/admin/tenants" : "/shop/orders");
            })
            .catch((reason: unknown) => {
              setError(reason instanceof ApiError ? reason.message : "Login failed.");
            });
        }}
      >
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <button className="w-full rounded-lg bg-stone-900 px-4 py-2 text-white" type="submit">
          Log in
        </button>
      </form>
    </main>
  );
}
