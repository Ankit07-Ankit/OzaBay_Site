import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { BrowserRouter, useLocation } from "react-router-dom";

const AdminPortal = lazy(() => import("./components/admin/AdminPortal.jsx"));

function SiteEntry() {
  const { pathname } = useLocation();
  const isAdminPath = pathname === "/admin-login"
    || pathname === "/admin"
    || pathname.startsWith("/admin/");

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
