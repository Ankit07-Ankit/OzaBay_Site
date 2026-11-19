import { useCallback, useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiUrl } from "../../utils/api.js";
import "./AdminPortal.css";

const ADMIN_API = "/api/admin";

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(price) || 0);

const formatDate = (date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(date))
    : "—";

const formatDateTime = (date) =>
  date
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date))
    : "—";

const formatLabel = (value) =>
  value ? `${value.charAt(0).toUpperCase()}${value.slice(1)}` : "—";

async function readResponse(response) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "The admin request could not be completed");
  }
  return payload;
}

function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await readResponse(
        await fetch(apiUrl(`${ADMIN_API}/login`), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        }),
      );
      navigate("/admin", { replace: true });
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-page">
      <div className="admin-login-card">
        <a className="admin-wordmark" href="/" aria-label="OzaBay home">OzaBay<span>.</span></a>
        <p className="admin-kicker">Restricted access</p>
        <h1>Administrator sign in</h1>
        <p className="admin-login-copy">Sign in with the administrator credentials configured for this store.</p>
        <form onSubmit={submit} className="admin-login-form">
          <label htmlFor="admin-email">Email address</label>
          <input
            id="admin-email"
            autoComplete="username"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <label htmlFor="admin-password">Password</label>
          <input
            id="admin-password"
            autoComplete="current-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error && <p className="admin-error" role="alert">{error}</p>}
          <button className="admin-primary-button" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in securely"}
          </button>
        </form>
        <a className="admin-back-link" href="/">← Back to OzaBay</a>
      </div>
    </main>
  );
}

function AdminDashboard() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("accounts");
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [supportTickets, setSupportTickets] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewReply, setReviewReply] = useState({});
  const [supportReply, setSupportReply] = useState({});
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [accountType, setAccountType] = useState("all");
  const [productSort, setProductSort] = useState("newest");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [page, setPage] = useState(1);
  const [reloadId, setReloadId] = useState(0);

  const request = useCallback(async (path, options = {}) => {
    const response = await fetch(apiUrl(`${ADMIN_API}${path}`), {
      ...options,
      credentials: "include",
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
    if (response.status === 401) {
      navigate("/admin-login", { replace: true });
    }
    return readResponse(response);
  }, [navigate]);

  useEffect(() => {
    let active = true;
    request("/summary")
      .then((result) => {
        if (active) setSummary(result.summary);
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      });
    return () => { active = false; };
  }, [request, reloadId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      page: String(page),
      limit: "50",
      search,
      ...(tab === "accounts" ? { type: accountType } : {}),
      ...(tab === "products" ? { sort: productSort } : {}),
    });
    request(`/${tab}?${params}`)
      .then((result) => {
        if (!active) return;
        if (tab === "accounts") setAccounts(result.accounts);
        else if (tab === "products") setProducts(result.products);
        else if (tab === "orders") setOrders(result.orders);
        else if (tab === "support") setSupportTickets(result.tickets || []);
        else if (tab === "reviews") setReviews(result.reviews || []);
        setPagination(result.pagination || { page: 1, pages: 1, total: (result.tickets || []).length });
      })
      .catch((requestError) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [accountType, page, productSort, reloadId, request, search, tab]);

  const setSearchTerm = (event) => {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const updateAccountStatus = async (account) => {
    const blocked = !account.isBlocked;
    let reason = "";
    if (blocked) {
      const submittedReason = window.prompt(`Reason for blocking ${account.name}?`);
      if (submittedReason === null) return;
      reason = submittedReason.trim();
    } else if (!window.confirm(`Restore access for ${account.name}?`)) {
      return;
    }

    setBusyId(String(account._id));
    setError("");
    setNotice("");
    try {
      await request(`/accounts/${account._id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ blocked, reason }),
      });
      setNotice(blocked ? "Account access blocked." : "Account access restored.");
      setReloadId((current) => current + 1);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const removeAccount = async (account) => {
    const confirmation = window.confirm(
      `Permanently remove ${account.name} (${account.email})? ${account.accountType === "vendor" ? "Their marketplace products will also be removed." : ""}`,
    );
    if (!confirmation) return;

    setBusyId(String(account._id));
    setError("");
    setNotice("");
    try {
      await request(`/accounts/${account._id}`, { method: "DELETE" });
      setNotice("Account removed.");
      setReloadId((current) => current + 1);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Remove “${product.name}” from the marketplace?`)) return;
    setBusyId(String(product._id));
    setError("");
    setNotice("");
    try {
      await request(`/products/${product._id}`, { method: "DELETE" });
      setNotice("Product removed from the marketplace.");
      setReloadId((current) => current + 1);
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const replySupportTicket = async (ticket) => {
    const message = (supportReply[ticket._id] || "").trim();
    if (!message) return;
    setBusyId(String(ticket._id));
    setError("");
    setNotice("");
    try {
      const result = await request(`/support/${ticket._id}/replies`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setSupportTickets((current) =>
        current.map((item) => item._id === ticket._id ? result.ticket : item),
      );
      setSupportReply((current) => ({ ...current, [ticket._id]: "" }));
      setNotice("Reply sent to the customer.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const replyToProductReview = async (review) => {
    const message = (reviewReply[review._id] || "").trim();
    if (!message) return;
    setBusyId(String(review._id));
    setError("");
    setNotice("");
    try {
      const result = await request(`/reviews/${review._id}/replies`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setReviews((current) =>
        current.map((item) => item._id === review._id ? { ...item, ...result.review } : item),
      );
      setReviewReply((current) => ({ ...current, [review._id]: "" }));
      setNotice("Reply sent to the customer.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const deleteSupportTicket = async (ticket) => {
    if (!window.confirm(`Delete the message "${ticket.subject}" permanently?`)) return;
    setBusyId(String(ticket._id));
    setError("");
    setNotice("");
    try {
      await request(`/support/${ticket._id}`, { method: "DELETE" });
      setSupportTickets((current) => current.filter((item) => item._id !== ticket._id));
      setNotice("Support or feedback message deleted.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const deleteProductReview = async (review) => {
    if (!window.confirm(`Delete the wrong review for "${review.productName}" permanently?`)) return;
    setBusyId(String(review._id));
    setError("");
    setNotice("");
    try {
      await request(`/reviews/${review._id}`, { method: "DELETE" });
      setReviews((current) => current.filter((item) => item._id !== review._id));
      setNotice("Wrong review or feedback deleted.");
    } catch (actionError) {
      setError(actionError.message);
    } finally {
      setBusyId("");
    }
  };

  const signOut = async () => {
    try {
      await request("/logout", { method: "POST" });
    } catch (logoutError) {
      setError(logoutError.message);
      return;
    }
    navigate("/admin-login", { replace: true });
  };

  return (
    <main className="admin-console">
      <aside className="admin-sidebar">
        <a className="admin-wordmark" href="/">OzaBay<span>.</span></a>
        <p className="admin-sidebar-label">CONTROL ROOM</p>
        <button
          className={`admin-nav-item ${tab === "accounts" ? "is-current" : ""}`}
          onClick={() => { setTab("accounts"); setPage(1); }}
        >
          <span aria-hidden="true">◉</span> People & access
        </button>
        <button
          className={`admin-nav-item ${tab === "orders" ? "is-current" : ""}`}
          onClick={() => { setTab("orders"); setPage(1); }}
        >
          <span aria-hidden="true">▤</span> Orders & payments
        </button>
        <button
          className={`admin-nav-item ${tab === "products" ? "is-current" : ""}`}
          onClick={() => { setTab("products"); setPage(1); }}
        >
          <span aria-hidden="true">◇</span> Product moderation
        </button>
        <button
          className={`admin-nav-item ${tab === "support" ? "is-current" : ""}`}
          onClick={() => { setTab("support"); setPage(1); }}
        >
          <span aria-hidden="true">✉</span> Support & feedback
        </button>
        <button
          className={`admin-nav-item ${tab === "reviews" ? "is-current" : ""}`}
          onClick={() => { setTab("reviews"); setPage(1); }}
        >
          <span aria-hidden="true">★</span> Product reviews
        </button>
        <div className="admin-sidebar-bottom">
          <span>Super admin</span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="admin-kicker">OzaBay · Administration</p>
            <h1>
              {tab === "accounts"
                ? "People & access"
                : tab === "products"
                  ? "Product moderation"
                  : tab === "support"
                    ? "Support & feedback"
                    : tab === "reviews"
                      ? "Product reviews"
                      : "Orders & payments"}
            </h1>
          </div>
          <a className="admin-store-link" href="/">View store ↗</a>
        </header>

        <div className="admin-content">
          {summary && (
            <div className="admin-stat-grid" aria-label="Marketplace overview">
              <article className="admin-stat-card"><span>Customers</span><strong>{summary.users}</strong></article>
              <article className="admin-stat-card"><span>Vendors</span><strong>{summary.vendors}</strong></article>
              <article className="admin-stat-card"><span>Blocked accounts</span><strong>{summary.blockedAccounts}</strong></article>
              <article className="admin-stat-card"><span>Vendor products</span><strong>{summary.products}</strong></article>
              <article className="admin-stat-card"><span>Orders</span><strong>{summary.orders}</strong></article>
              <article className="admin-stat-card"><span>Paid volume</span><strong>{formatPrice(summary.paidRevenue)}</strong></article>
            </div>
          )}

          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <h2>
                  {tab === "accounts"
                    ? "Registered accounts"
                    : tab === "products"
                      ? "Marketplace products"
                      : tab === "support"
                        ? "Customer support"
                        : tab === "reviews"
                          ? "Product reviews"
                          : "Customer orders"}
                </h2>
                <p>{tab === "accounts"
                  ? "Review customer and vendor access, or remove accounts that violate store rules."
                  : tab === "products"
                    ? "Review maker listings and remove products that violate marketplace rules or pricing standards."
                    : "Review each order alongside customer contact, purchased products, payment method and transaction status."}</p>
              </div>
              <div className="admin-toolbar">
                <form className="admin-search-form" onSubmit={setSearchTerm}>
                  <input
                    type="search"
                    aria-label={
                      tab === "accounts"
                        ? "Search accounts"
                        : tab === "products"
                          ? "Search products"
                          : "Search orders"
                    }
                    placeholder={
                      tab === "accounts"
                        ? "Search name or email"
                        : tab === "products"
                          ? "Search product or category"
                          : "Search order, customer or payment"
                    }
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                  <button type="submit">Search</button>
                </form>
                {tab === "products" && (
                  <label className="admin-product-sort">
                    <span>Price review</span>
                    <select
                      value={productSort}
                      onChange={(event) => { setProductSort(event.target.value); setPage(1); }}
                    >
                      <option value="newest">Newest listings</option>
                      <option value="price_desc">Highest price first</option>
                      <option value="price_asc">Lowest price first</option>
                    </select>
                  </label>
                )}
              </div>
            </div>

            {(tab === "accounts" || tab === "orders") && (
              <div className="admin-filters">
                {tab === "accounts" && (
                  <>
                    <label htmlFor="account-type">Show</label>
                    <select
                      id="account-type"
                      value={accountType}
                      onChange={(event) => { setAccountType(event.target.value); setPage(1); }}
                    >
                      <option value="all">All accounts</option>
                      <option value="user">Customers</option>
                      <option value="vendor">Vendors</option>
                    </select>
                  </>
                )}
                <span>
                  {pagination.total} {tab === "accounts" ? "account" : "order"}
                  {pagination.total === 1 ? "" : "s"}
                </span>
              </div>
            )}

            {error && <p className="admin-message admin-message-error" role="alert">{error}</p>}
            {notice && <p className="admin-message admin-message-success" role="status">{notice}</p>}
            {loading ? (
              <div className="admin-empty">Loading administration data…</div>
            ) : tab === "accounts" ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Account</th><th>Type</th><th>Joined</th><th>Access</th><th>Actions</th></tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr key={account._id}>
                        <td><strong>{account.name}</strong><small>{account.email}</small></td>
                        <td><span className={`admin-role-badge role-${account.accountType}`}>{account.accountType}</span></td>
                        <td>{formatDate(account.createdAt)}</td>
                        <td>
                          <span className={`admin-status ${account.isBlocked ? "status-blocked" : "status-active"}`}>
                            {account.isBlocked ? "Blocked" : "Active"}
                          </span>
                          {account.moderationNote && account.isBlocked && (
                            <small className="admin-note">{account.moderationNote}</small>
                          )}
                        </td>
                        <td>
                          <div className="admin-row-actions">
                            <button
                              className="admin-action-button"
                              disabled={busyId === String(account._id)}
                              onClick={() => updateAccountStatus(account)}
                            >
                              {account.isBlocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              className="admin-action-button action-danger"
                              disabled={busyId === String(account._id)}
                              onClick={() => removeAccount(account)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!accounts.length && <tr><td className="admin-table-empty" colSpan="5">No accounts match your search.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : tab === "products" ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Product</th><th>Vendor</th><th>Price</th><th>Listed</th><th>Moderation</th></tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product._id}>
                        <td className="admin-product-cell">
                          {product.images?.[0] && <img src={apiUrl(product.images[0])} alt="" />}
                          <div><strong>{product.name}</strong><small>{product.category}</small></div>
                        </td>
                        <td>
                          {product.vendorId?.name || "Vendor account removed"}
                          {product.vendorId?.isBlocked && <small className="admin-note">Vendor blocked</small>}
                        </td>
                        <td><strong>{formatPrice(product.price)}</strong></td>
                        <td>{formatDate(product.createdAt)}</td>
                        <td>
                          <button
                            className="admin-action-button action-danger"
                            disabled={busyId === String(product._id)}
                            onClick={() => removeProduct(product)}
                          >
                            Remove listing
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!products.length && <tr><td className="admin-table-empty" colSpan="5">No products match your search.</td></tr>}
                  </tbody>
                </table>
              </div>
            ) : tab === "reviews" ? (
              <div className="admin-support-list">
                {reviews.map((review) => (
                  <article className="admin-support-card" key={review._id}>
                    <div className="admin-support-head">
                      <div>
                        <strong>{review.productName}</strong>
                        <small>{review.userName} · {review.vendorName || "OzaBay vendor"} · {formatDate(review.createdAt)} · {review.rating}/5 stars</small>
                      </div>
                      <span className="admin-status status-active">{review.rating}/5 ★</span>
                    </div>
                    <p className="admin-support-original">{review.feedback}</p>
                    {review.vendorReply?.message && (
                      <div className="admin-support-reply"><strong>Vendor reply</strong><p>{review.vendorReply.message}</p></div>
                    )}
                    {review.adminReply?.message && (
                      <div className="admin-support-reply"><strong>Admin reply</strong><p>{review.adminReply.message}</p></div>
                    )}
                    <div className="admin-support-reply-form">
                      <input
                        value={reviewReply[review._id] || ""}
                        onChange={(event) => setReviewReply((current) => ({ ...current, [review._id]: event.target.value }))}
                        maxLength={2000}
                        aria-label={`Reply to ${review.userName}'s review`}
                        placeholder="Write an admin response…"
                      />
                      <button type="button" disabled={busyId === String(review._id)} onClick={() => replyToProductReview(review)}>Send reply</button>
                      <button
                        type="button"
                        className="admin-action-button action-danger"
                        disabled={busyId === String(review._id)}
                        onClick={() => deleteProductReview(review)}
                      >
                        Delete review
                      </button>
                    </div>
                  </article>
                ))}
                {!reviews.length && <div className="admin-empty">No product reviews or feedback.</div>}
              </div>
            ) : tab === "support" ? (
              <div className="admin-support-list">
                {supportTickets.map((ticket) => (
                  <article className="admin-support-card" key={ticket._id}>
                    <div className="admin-support-head">
                      <div>
                        <strong>{ticket.subject}</strong>
                        <small>{ticket.userName} · {ticket.userEmail} · {ticket.category}</small>
                      </div>
                      <span className="admin-status status-active">{ticket.status}</span>
                    </div>
                    <p className="admin-support-original">{ticket.message}</p>
                    <div className="admin-support-replies">
                      {(ticket.replies || []).map((reply, index) => (
                        <div className="admin-support-reply" key={`${ticket._id}-${index}`}>
                          <strong>{reply.sender === "admin" ? "Admin" : ticket.userName}</strong>
                          <p>{reply.message}</p>
                        </div>
                      ))}
                    </div>
                    <div className="admin-support-reply-form">
                      <input
                        value={supportReply[ticket._id] || ""}
                        onChange={(event) => setSupportReply((current) => ({ ...current, [ticket._id]: event.target.value }))}
                        maxLength={2000}
                        aria-label={`Reply to ${ticket.subject}`}
                        placeholder="Write a reply to the customer…"
                      />
                      <button
                        type="button"
                        disabled={busyId === String(ticket._id)}
                        onClick={() => replySupportTicket(ticket)}
                      >
                        Send reply
                      </button>
                      <button
                        type="button"
                        className="admin-action-button action-danger"
                        disabled={busyId === String(ticket._id)}
                        onClick={() => deleteSupportTicket(ticket)}
                      >
                        Delete message
                      </button>
                    </div>
                  </article>
                ))}
                {!supportTickets.length && <div className="admin-empty">No support or feedback messages.</div>}
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table admin-orders-table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Customer & delivery</th>
                      <th>Products</th>
                      <th>Total</th>
                      <th>Payment</th>
                      <th>Order status</th>
                      <th>Placed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => {
                      const payment = order.paymentDetails || {};
                      const paymentStatus = payment.status || order.paymentStatus;
                      const transactionId =
                        payment.transactionId || order.razorpayPaymentId;
                      return (
                        <tr key={order._id}>
                          <td>
                            <strong>#{String(order._id).slice(-8).toUpperCase()}</strong>
                            <small>{order._id}</small>
                          </td>
                          <td>
                            <strong>{order.customer?.name || "Customer details unavailable"}</strong>
                            <small>{order.customer?.email || "—"}</small>
                            <small>{order.customer?.phone || "—"}</small>
                            <small>
                              {[
                                order.customer?.address,
                                order.customer?.city,
                                order.customer?.pincode,
                              ].filter(Boolean).join(", ") || "Delivery address unavailable"}
                            </small>
                          </td>
                          <td>
                            <ul className="admin-order-items">
                              {(order.items || []).map((item, index) => (
                                <li key={`${item.productId || item.name}-${index}`}>
                                  <strong>{item.name}</strong>
                                  <small>
                                    {item.quantity} × {formatPrice(item.unitPrice)}
                                    {" · "}{formatPrice(item.lineTotal)}
                                  </small>
                                  {order.paymentMethod === "Cash on delivery" && (
                                    <small>
                                      COD {item.cashOnDelivery?.status === "paid" ? "collected" : "due"}
                                      {item.cashOnDelivery?.collectedAt
                                        && ` · ${formatDateTime(item.cashOnDelivery.collectedAt)}`}
                                    </small>
                                  )}
                                  {item.returnRequest?.status
                                    && item.returnRequest.status !== "none" && (
                                      <small className={`admin-return-status admin-return-status--${item.returnRequest.status}`}>
                                        Return {formatLabel(item.returnRequest.status)}
                                        {item.returnRequest.requestedAt
                                          && ` · ${formatDateTime(item.returnRequest.requestedAt)}`}
                                      </small>
                                    )}
                                  {item.returnRequest?.reason && (
                                    <small>Return reason: {item.returnRequest.reason}</small>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </td>
                          <td><strong>{formatPrice(order.total)}</strong></td>
                          <td>
                            <span className={`admin-status status-${paymentStatus || "unpaid"}`}>
                              {formatLabel(paymentStatus)}
                            </span>
                            <small>{payment.method || order.paymentMethod}</small>
                            {payment.provider && payment.provider !== payment.method && (
                              <small>via {payment.provider}</small>
                            )}
                            {transactionId ? (
                              <small>Txn: {transactionId}</small>
                            ) : order.razorpayOrderId ? (
                              <small>Gateway order: {order.razorpayOrderId}</small>
                            ) : (
                              <small>No gateway transaction</small>
                            )}
                            {payment.paidAt && <small>Paid {formatDateTime(payment.paidAt)}</small>}
                            {payment.refundStatus === "pending" && (
                              <small className="admin-refund-follow-up">
                                Manual refund follow-up required
                              </small>
                            )}
                          </td>
                          <td>
                            {order.orderStatus || "—"}
                            {order.cancelledAt && (
                              <small>Cancelled {formatDateTime(order.cancelledAt)}</small>
                            )}
                          </td>
                          <td>{formatDateTime(order.createdAt)}</td>
                        </tr>
                      );
                    })}
                    {!orders.length && (
                      <tr>
                        <td className="admin-table-empty" colSpan="7">
                          No orders match your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && pagination.pages > 1 && (
              <div className="admin-pagination">
                <span>Page {pagination.page} of {pagination.pages}</span>
                <div>
                  <button disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
                  <button disabled={page >= pagination.pages} onClick={() => setPage((current) => current + 1)}>Next</button>
                </div>
              </div>
            )}
          </section>
          <p className="admin-footnote">Account and product removals are permanent. Marketplace order and payment records are retained for administration.</p>
        </div>
      </section>
    </main>
  );
}

export default function AdminPortal() {
  const { pathname } = useLocation();
  if (pathname === "/admin-login") return <AdminLogin />;
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return <AdminDashboard />;
  return <Navigate to="/admin-login" replace />;
}
