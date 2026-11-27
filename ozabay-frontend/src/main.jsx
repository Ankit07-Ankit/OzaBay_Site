import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter, Navigate, useLocation } from "react-router-dom";
import { ADMIN_PATH } from "./utils/routes.js";

const AdminPortal = lazy(() => import("./components/admin/AdminPortal.jsx"));

function SiteEntry() {
  const { pathname } = useLocation();
  const isAdminPath = pathname === ADMIN_PATH
    || pathname.startsWith(`${ADMIN_PATH}/`);
  const isLegacyAdminPath = pathname === "/admin-login"
    || pathname === "/admin"
    || pathname.startsWith("/admin/");

  if (isLegacyAdminPath) return <Navigate to="/" replace />;
  return isAdminPath
    ? <Suspense fallback={<main className="admin-login-page">Loading admin portal…</main>}>
        <AdminPortal />
      </Suspense>
    : <App />;
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <SiteEntry />
    </BrowserRouter>
  </StrictMode>,
);
