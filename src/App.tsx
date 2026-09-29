import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { loadAuth, saveAuth } from "./session";
import { AdminTenantsPage } from "./pages/AdminTenantsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { OrderStatusPage } from "./pages/OrderStatusPage";
import { PricingPage } from "./pages/PricingPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ShopOrderPage } from "./pages/ShopOrderPage";
import { ShopOrdersPage } from "./pages/ShopOrdersPage";
import { ShopPage } from "./pages/ShopPage";

function RequireAuth({ role, children }: { role: "SUPER_ADMIN" | "TENANT_ADMIN"; children: ReactNode }) {
  const auth = loadAuth();
  if (!auth) {
    return <Navigate to="/login" replace />;
  }
  if (auth.user.role !== role) {
    return <Navigate to={auth.user.role === "SUPER_ADMIN" ? "/admin/tenants" : "/shop/orders"} replace />;
  }
  return children;
}

export function ShopShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-4">
        <nav className="flex gap-4 text-sm font-medium">
          <Link to="/shop/orders">Queue</Link>
          <Link to="/shop/pricing">Pricing</Link>
          <Link to="/shop/settings">Settings</Link>
        </nav>
        <button
          className="text-sm text-stone-600"
          onClick={() => {
            saveAuth(null);
            navigate("/login");
          }}
        >
          Log out
        </button>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/s/:tenantSlug" element={<ShopPage />} />
      <Route path="/s/:tenantSlug/orders/:orderId" element={<OrderStatusPage />} />
      <Route
        path="/shop/orders"
        element={
          <RequireAuth role="TENANT_ADMIN">
            <ShopShell>
              <ShopOrdersPage />
            </ShopShell>
          </RequireAuth>
        }
      />
      <Route
        path="/shop/orders/:orderId"
        element={
          <RequireAuth role="TENANT_ADMIN">
            <ShopShell>
              <ShopOrderPage />
            </ShopShell>
          </RequireAuth>
        }
      />
      <Route
        path="/shop/pricing"
        element={
          <RequireAuth role="TENANT_ADMIN">
            <ShopShell>
              <PricingPage />
            </ShopShell>
          </RequireAuth>
        }
      />
      <Route
        path="/shop/settings"
        element={
          <RequireAuth role="TENANT_ADMIN">
            <ShopShell>
              <SettingsPage />
            </ShopShell>
          </RequireAuth>
        }
      />
      <Route
        path="/admin/tenants"
        element={
          <RequireAuth role="SUPER_ADMIN">
            <AdminTenantsPage />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
