import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar.jsx";
import Hero from "./components/Hero/Hero.jsx";
import Reveal from "./components/shared/Reveal.jsx";
import TiltCard from "./components/shared/TiltCard.jsx";
import CustomDesignUpload from "./components/custom/CustomDesignUpload.jsx";
import RegionalCrafts from "./components/regional/RegionalCrafts.jsx";
import TrustStrip from "./components/marketing/TrustStrip.jsx";
import CraftFilm from "./components/marketing/CraftFilm.jsx";
import MakerStories from "./components/marketing/MakerStories.jsx";
import { IMG } from "./data/assets.js";
import { INDIA_CRAFTS } from "./data/regionalCrafts.js";
import { REGIONAL_CRAFT_PRODUCTS } from "./data/regionalCraftProducts.js";
import { ARTISANS, CUSTOM_PRICES } from "./data/siteContent.js";
import { money } from "./utils/formatCurrency.js";
import { apiUrl } from "./utils/api.js";
import { ADMIN_DASHBOARD_PATH, ADMIN_TOKEN_KEY } from "./utils/routes.js";
import LazyVideo from "./components/shared/LazyVideo.jsx";
import "./index.css";
import "./premium-upgrades.css";

const Product3DViewer = lazy(() => import("./components/product/Product3DViewer.jsx"));
const ProductDetail = lazy(() => import("./components/product/ProductDetail.jsx"));
const ReviewForm = lazy(() => import("./components/product/ReviewForm.jsx"));
const SignIn = lazy(() => import("./components/auth/SignIn.jsx"));
const SignUp = lazy(() => import("./components/auth/SignUp.jsx"));
const AccountSection = lazy(() => import("./components/account/AccountSection.jsx"));
const VendorDashboard = lazy(() => import("./components/vendor/VendorDashboard.jsx"));
const StateCraftMarketplace = lazy(() => import("./components/regional/StateCraftMarketplace.jsx"));

let refreshAccessTokenPromise;

const serializeProductForSync = (product) =>
  typeof product === "string"
    ? product
    : {
        id: product?.id,
        qty: Number.isInteger(product?.qty) ? product.qty : 1,
        data: product,
      };

const normalizeRemoteProduct = (entry) => {
  if (!entry || typeof entry === "string") return null;
  const item = entry.data ?? entry;
  if (!item?.id) return null;
  return { ...item, qty: entry.qty ?? item.qty ?? 1 };
};

const remoteProductList = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map(normalizeRemoteProduct)
    .filter(Boolean);

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existing = document.querySelector("script[data-razorpay-checkout]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "Unable to load Razorpay checkout. Check your connection.",
            ),
          ),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () =>
      reject(
        new Error("Unable to load Razorpay checkout. Check your connection."),
      );
    document.body.appendChild(script);
  });

// Local items win on duplicate ids; server-only items are appended.
const mergeSavedProducts = (local, remote) => {
  const localIds = new Set(local.map((item) => String(item?.id ?? item)));
  return [
    ...local,
    ...remoteProductList(remote).filter(
      (item) => !localIds.has(String(item.id)),
    ),
  ];
};

const getSyncAccount = () => {
  try {
    return JSON.parse(localStorage.getItem("ozabay-account") || "null");
  } catch {
    return null;
  }
};

const savedProductsStorageKey = (type, accountId) =>
  `ozabay-${type === "cart" ? "cart" : "wishlist"}-${accountId}`;

const guestSavedProductsStorageKey = (type) =>
  `ozabay-guest-${type === "cart" ? "cart" : "wishlist"}`;

const getCachedSavedProducts = (type, accountId = getSyncAccount()?._id) => {
  try {
    const storageKey = accountId
      ? savedProductsStorageKey(type, accountId)
      : guestSavedProductsStorageKey(type);
    const products = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return type === "favorites" && Array.isArray(products)
      ? products.map((id) => String(id))
      : products;
  } catch {
    return [];
  }
};

// Pushes the current local cart/wishlist snapshots to the server so the
// account has them on any device. Runs fire-and-forget with a simple
// in-flight guard to avoid overlapping requests. `types` limits which
// lists are pushed.
let savedProductsSyncInFlight = false;
let savedProductsSyncPending = false;
const syncSavedProductsToServer = async (
  requestAuthenticatedApi,
  types = ["cart", "favorites"],
) => {
  const account = getSyncAccount();
  if (!account?._id) return;
  if (savedProductsSyncInFlight) {
    savedProductsSyncPending = true;
    return;
  }

  savedProductsSyncInFlight = true;
  try {
    const send = async (type, products) => {
      await requestAuthenticatedApi("/me/products", {
        method: "POST",
        body: JSON.stringify({
          type,
          products: products.map(serializeProductForSync),
        }),
      });
    };
    await Promise.all(
      types.map((type) =>
        send(
          type,
          JSON.parse(
            localStorage.getItem(savedProductsStorageKey(type, account._id)) ||
              "[]",
          ),
        ),
      ),
    );
  } catch (error) {
    console.warn("Failed to sync saved products:", error.message);
  } finally {
    savedProductsSyncInFlight = false;
    if (savedProductsSyncPending) {
      savedProductsSyncPending = false;
      void syncSavedProductsToServer(requestAuthenticatedApi);
    }
  }
};

// Loads the server-side snapshot for a type. Returns `{ ids, products }`
// (ids are plain product-id strings, products are the full stored objects),
// or null when there is no signed-in account or the request fails.
const fetchUserProducts = async (type, requestAuthenticatedApi) => {
  const account = getSyncAccount();
  if (!account?._id) return null;

  try {
    const result = await requestAuthenticatedApi(`/me/products?type=${type}`);
    return {
      ids: Array.isArray(result.ids) ? result.ids : [],
      products: remoteProductList(result.products),
    };
  } catch (error) {
    console.warn(`Failed to load saved ${type}:`, error.message);
    return null;
  }
};

const normalizeSearchText = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const getProductSearchScore = (product, normalizedQuery) => {
  if (!normalizedQuery) return 0;

  const fields = {
    name: normalizeSearchText(product.name),
    category: normalizeSearchText(product.category),
    maker: normalizeSearchText(product.artisan),
    details: normalizeSearchText(
      [
        product.description,
        product.story,
        product.city,
        product.material,
        product.offer,
      ]
        .filter(Boolean)
        .join(" "),
    ),
  };
  const allText = Object.values(fields).join(" ");
  const terms = normalizedQuery.split(/\s+/);
  if (terms.some((term) => !allText.includes(term))) return null;

  let score = fields.name === normalizedQuery ? 100 : 0;
  if (fields.name.startsWith(normalizedQuery)) score += 50;
  if (fields.name.includes(normalizedQuery)) score += 30;

  for (const term of terms) {
    if (fields.name.includes(term)) score += 12;
    else if (fields.category.includes(term)) score += 8;
    else if (fields.maker.includes(term)) score += 6;
    else score += 2;
  }
  return score;
};

// ——— Support Modal ———————————————————————————————————————
function SupportModal({ onClose, onGoToOrders }) {
  const [supportTab, setSupportTab] = useState("faq");
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    {
      q: "How does handmade variation work?",
      a: "Every OzaBay piece is handcrafted by an artisan, so slight differences in colour, texture, and grain are natural—and part of what makes it yours. Product photos show a representative sample.",
    },
    {
      q: "Can I request a custom or personalised piece?",
      a: "Yes! Use the 'Made-to-order' section on the homepage to configure your piece—choose form, material, finish, size and tone—then submit a brief. Our team reviews each request and confirms pricing and timelines within 2 business days.",
    },
    {
      q: "Where can I track my order?",
      a: "Open your Account (top-right), go to the Orders tab, and click 'Track order' on any placed order. You'll see live status updates from your maker through every stage—crafting, shipped, out for delivery, and delivered.",
    },
    {
      q: "What is your return and refund policy?",
      a: "You can request a return on any item within 7 days of delivery. Open your Account → Orders, find the item and select 'Request return'. Approved returns are refunded to your original payment method within 7–10 business days.",
    },
    {
      q: "How do I cancel an order?",
      a: "Orders can be cancelled before the maker begins crafting. Open Account → Orders and click 'Cancel order'. Once production starts, cancellation may not be possible—contact support immediately if needed.",
    },
    {
      q: "How are makers verified on OzaBay?",
      a: "Each vendor is manually reviewed before their products go live. We verify craft identity, product authenticity, and quality standards. Only approved vendors can list products on the platform.",
    },
    {
      q: "Is my payment secure?",
      a: "All online payments are processed via Razorpay, a PCI-DSS-compliant payment gateway. OzaBay never stores your card details. Cash on delivery is also available at checkout.",
    },
    {
      q: "What shipping methods do you use?",
      a: "Orders ship via trusted courier partners across India. Standard delivery takes 5–9 business days after dispatch. Expedited options may be available for select pin codes—check at checkout.",
    },
  ];

  const policies = [
    {
      title: "Shipping & Delivery",
      icon: "🚚",
      body: "Standard delivery across India: 5–9 business days after dispatch. Expedited delivery available for select pin codes. Free shipping on orders above ₹2,000. We ship using trusted courier partners with real-time tracking.",
    },
    {
      title: "Returns & Refunds",
      icon: "↩",
      body: "7-day return window from the date of delivery. Items must be unused and in original packaging. Raise a return request via Account → Orders. Refunds processed within 7–10 business days to original payment method.",
    },
    {
      title: "Privacy Policy",
      icon: "🔒",
      body: "OzaBay collects only the data needed to process your orders and improve your experience. We never sell or share your personal data with third parties for marketing. All data is encrypted in transit and stored securely.",
    },
    {
      title: "Terms & Conditions",
      icon: "📜",
      body: "By placing an order on OzaBay you agree to our terms of sale. All products are handmade and subject to natural variation. OzaBay acts as a marketplace connecting buyers with verified artisan vendors. Disputes are resolved under Indian law.",
    },
    {
      title: "Fair Artisan Charter",
      icon: "🤝",
      body: "OzaBay is committed to fair trade. All vendors are paid within 7 days of delivery confirmation. We do not impose exclusivity, and artisans retain full IP rights to their craft. Our charter ensures makers receive at least 70% of the sale price.",
    },
    {
      title: "Partner Standards",
      icon: "⭐",
      body: "Vendors on OzaBay are manually verified, trained on quality standards, and rated by customers. Vendors with sustained low ratings or policy violations are removed. We conduct quarterly reviews of all active listings.",
    },
  ];

  return (
    <>
      <button className="modal-close" onClick={onClose}>
        ×
      </button>
      <p className="eyebrow">Customer support</p>
      <h2>
        How can we <em>help?</em>
      </h2>

      <div className="support-tabs">
        <button
          className={supportTab === "faq" ? "is-active" : ""}
          onClick={() => setSupportTab("faq")}
        >
          ❓ FAQ
        </button>
        <button
          className={supportTab === "contact" ? "is-active" : ""}
          onClick={() => setSupportTab("contact")}
        >
          💬 Contact us
        </button>
        <button
          className={supportTab === "policies" ? "is-active" : ""}
          onClick={() => setSupportTab("policies")}
        >
          📋 Policies
        </button>
      </div>

      {supportTab === "faq" && (
        <div className="support-faq">
          {faqs.map((item, i) => (
            <div
              key={i}
              className={`support-faq__item ${openFaq === i ? "is-open" : ""}`}
            >
              <button
                className="support-faq__q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
              >
                <span>{item.q}</span>
                <span className="support-faq__chevron" aria-hidden="true">
                  {openFaq === i ? "−" : "+"}
                </span>
              </button>
              {openFaq === i && <p className="support-faq__a">{item.a}</p>}
            </div>
          ))}
        </div>
      )}

      {supportTab === "contact" && (
        <div className="support-contact">
          <p className="support-contact__intro">
            Our concierge team is available Mon–Sat, 10am–7pm IST. Reach us
            through any of the channels below and we'll respond within one
            business day.
          </p>
          <div className="support-channels">
            <a
              href="mailto:ankush@infinitivecloud.com"
              className="support-channel"
            >
              <span className="support-channel__icon">✉</span>
              <div>
                <strong>Email support</strong>
                <span>ankush@infinitivecloud.com</span>
                <small>Response within 24 hours</small>
              </div>
            </a>
            <a
              href="https://wa.me/919999999999?text=Hi%20OzaBay%2C%20I%20need%20help%20with%20my%20order."
              target="_blank"
              rel="noopener noreferrer"
              className="support-channel"
            >
              <span className="support-channel__icon">💬</span>
              <div>
                <strong>WhatsApp chat</strong>
                <span>+91 8690393087</span>
                <small>Fastest response · Mon–Sat 10am–7pm</small>
              </div>
            </a>
            <a href="tel:+919999999999" className="support-channel">
              <span className="support-channel__icon">📞</span>
              <div>
                <strong>Call us</strong>
                <span>+91 8690393087</span>
                <small>Mon–Sat · 10am–7pm IST</small>
              </div>
            </a>
            <a
              href="https://instagram.com/ozabay"
              target="_blank"
              rel="noopener noreferrer"
              className="support-channel"
            >
              <span className="support-channel__icon">📸</span>
              <div>
                <strong>Instagram DM</strong>
                <span>https://www.instagram.com/infinitivecloud/</span>
                <small>DM us on Instagram</small>
              </div>
            </a>
          </div>
          <div className="support-track-shortcut">
            <span>🔍</span>
            <div>
              <strong>Tracking an order?</strong>
              <p>
                Open your Account → Orders tab to see live status for every
                order you've placed.
              </p>
            </div>
            {onGoToOrders && (
              <button className="hero-action" onClick={onGoToOrders}>
                Go to Orders ↗
              </button>
            )}
          </div>
        </div>
      )}

      {supportTab === "policies" && (
        <div className="support-policies">
          {policies.map((policy, i) => (
            <div key={i} className="support-policy-card">
              <span className="support-policy-card__icon">{policy.icon}</span>
              <div>
                <strong>{policy.title}</strong>
                <p>{policy.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

export default function App() {
  const navigate = useNavigate();

  const [cart, setCart] = useState(() => {
    return getCachedSavedProducts("cart");
  });
  const [wish, setWish] = useState(() => {
    return getCachedSavedProducts("favorites");
  });
  const [recentlyViewed, setRecentlyViewed] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ozabay-recently-viewed") || "[]");
    } catch {
      return [];
    }
  });
  const [filter, setFilter] = useState("All");
  const [sort, setSort] = useState("featured");
  const [query, setQuery] = useState("");
  const [priceBand, setPriceBand] = useState(null);
  const [modal, setModal] = useState(null);
  const [leaving, setLeaving] = useState([]);
  const [page, setPage] = useState(1);
  const [custom, setCustom] = useState({
    form: "Vessel",
    material: "Clay",
    finish: "Natural",
    size: "Medium",
    tone: "Earth",
    engraving: "",
    notes: "",
  });
  const [orderForm, setOrderForm] = useState({
    name: "",
    email: "",
    phone: "",
    city: "",
    address: "",
    quantity: "1",
    budget: "",
    neededBy: "",
    purpose: "",
    referenceName: "",
    approval: "Yes",
  });
  const [orderSent, setOrderSent] = useState(false);
  const [requestId, setRequestId] = useState("");
  const [customStep, setCustomStep] = useState(1);
  const [account, setAccount] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("ozabay-account") || "null");
    } catch {
      return null;
    }
  });
  const [vendorSessionReady, setVendorSessionReady] = useState(
    () => account?.accountType !== "vendor",
  );
  const [vendorSessionError, setVendorSessionError] = useState("");
  const [registeredProducts, setRegisteredProducts] = useState([]);
  const [registeredProductsLoaded, setRegisteredProductsLoaded] =
    useState(false);
  const [registeredProductsError, setRegisteredProductsError] = useState("");
  const [vendorProducts, setVendorProducts] = useState([]);
  const [vendorProductsLoaded, setVendorProductsLoaded] = useState(false);
  const [reviewSummaries, setReviewSummaries] = useState({});
  const [reviewSummaryError, setReviewSummaryError] = useState("");
  const [reviewRefreshToken, setReviewRefreshToken] = useState(0);
  const [accessToken, setAccessToken] = useState(
    () => sessionStorage.getItem("ozabay-access-token") || "",
  );
  const [authView, setAuthView] = useState("signup");
  const [signupAccountType, setSignupAccountType] = useState("user");
  const syncedAccountRef = useRef(null);
  const savedProductsLoadedRef = useRef(false);
  const [checkout, setCheckout] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    city: "",
    pincode: "",
    payment: "Cash on delivery",
  });
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const pendingCheckoutAuth = useRef(false);
  const [orders, setOrders] = useState(() => {
    try {
      const key = account?._id
        ? `ozabay-orders-${account._id}`
        : "ozabay-guest-orders";
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      return [];
    }
  });
  const customerOrdersRefreshRef = useRef(null);
  const [tracking, setTracking] = useState("");
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewLoginRequired, setReviewLoginRequired] = useState(false);
  const scrollProgressRef = useRef(null);
  const [craftRoute, setCraftRoute] = useState(() => {
    if (account?.accountType === "vendor") return null;
    const m = window.location.pathname.match(/^\/crafts\/([^/]+)/);
    return m ? m[1] : null;
  });
  const [vendorRoute, setVendorRoute] = useState(() => {
    if (account?.accountType === "vendor") return true;
    if (account?.accountType === "user") return false;
    return window.location.pathname === "/vendor";
  });
  const [gift, setGift] = useState({
    occasion: "Housewarming",
    recipient: "Parents",
    budget: "₹5,000",
    style: "Earthy",
    wrapping: true,
    message: "Wishing you a beautiful new beginning.",
  });
  const perPage = 12;
  // Categories are derived dynamically from vendor-registered products only
  const categories = useMemo(() => {
    const cats = new Set(
      registeredProducts.map((p) => p.category).filter(Boolean),
    );
    return ["All", ...cats];
  }, [registeredProducts]);

  // Registered products grouped by their category for the Collections section
  const registeredCollections = useMemo(() => {
    const groups = new Map();
    registeredProducts.forEach((p) => {
      const cat = p.category?.trim();
      if (!cat) return;
      if (!groups.has(cat)) {
        groups.set(cat, {
          category: cat,
          coverImage: p.image || p.images?.[0],
          material: p.material || "Handmade",
          count: 0,
        });
      }
      const g = groups.get(cat);
      g.count += 1;
    });
    return Array.from(groups.values());
  }, [registeredProducts]);

  const catalogProducts = useMemo(
    () => registeredProducts,
    [registeredProducts],
  );
  const normalizedQuery = useMemo(() => normalizeSearchText(query), [query]);
  const scoredProducts = useMemo(
    () =>
      catalogProducts.map((product, index) => ({
        product,
        index,
        score: getProductSearchScore(product, normalizedQuery),
      })),
    [catalogProducts, normalizedQuery],
  );
  const searchMatches = useMemo(
    () =>
      scoredProducts
        .filter((result) => result.score !== null)
        .sort(
          (first, second) =>
            second.score - first.score || first.index - second.index,
        )
        .map(({ product }) => product),
    [scoredProducts],
  );
  const searchResults = searchMatches.slice(0, 12);
  const shown = useMemo(() => {
    let list = scoredProducts
      .filter(
        ({ product: p, score }) =>
          (filter === "All" || p.category === filter) &&
          (!priceBand ||
            ((priceBand.min == null || p.priceValue >= priceBand.min) &&
              (priceBand.max == null || p.priceValue < priceBand.max))) &&
          score !== null,
      )
      .map(({ product }) => product);
    if (sort === "price-low") list.sort((a, b) => a.priceValue - b.priceValue);
    if (sort === "price-high") list.sort((a, b) => b.priceValue - a.priceValue);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [scoredProducts, filter, sort, priceBand]);
  const visible = shown.slice(0, page * perPage);
  const totalPages = Math.max(1, Math.ceil(shown.length / perPage));
  const cartCount = cart.reduce((n, p) => n + p.qty, 0);
  const cartTotal = cart.reduce((n, p) => n + p.priceValue * p.qty, 0);
  const customPrice =
    CUSTOM_PRICES.form[custom.form] +
    CUSTOM_PRICES.material[custom.material] +
    CUSTOM_PRICES.finish[custom.finish] +
    CUSTOM_PRICES.size[custom.size] +
    CUSTOM_PRICES.tone[custom.tone] +
    (custom.engraving.trim() ? 450 : 0);
  const customImage =
    custom.material === "Brass"
      ? IMG.blue
      : custom.finish === "Indigo" || custom.tone === "Indigo"
        ? IMG.indigo
        : IMG.sculptural;
  const go = (id) => {
    if (account?.accountType === "vendor") {
      // Vendors are private to the maker studio
      const vendorSectionMap = {
        products: "vendor-product-list",
        collections: "vendor-locations",
        artisans: "vendor-dashboard",
        home: "vendor-dashboard",
      };
      const targetId = vendorSectionMap[id] || "vendor-dashboard";
      document
        .getElementById(targetId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (vendorRoute || craftRoute) {
      window.history.pushState({}, "", `/#${id}`);
      setVendorRoute(false);
      setCraftRoute(null);
      setTimeout(
        () =>
          document
            .getElementById(id)
            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
        60,
      );
      return;
    }
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const stateSlug = (state) =>
    state.name
      .toLowerCase()
      .replace(/&/g, "and")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const openStateCraft = (state, craft = null) => {
    if (account?.accountType === "vendor") return;
    const slug = stateSlug(state);
    const path = `/crafts/${slug}${craft ? `?craft=${encodeURIComponent(craft)}` : ""}`;
    window.history.pushState({ craftRoute: slug }, "", path);
    setCraftRoute(slug);
    setModal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const backToAtlas = () => {
    if (account?.accountType === "vendor") return;
    window.history.pushState({}, "", "/#crafts-india");
    setCraftRoute(null);
    setTimeout(
      () =>
        document
          .getElementById("crafts-india")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      40,
    );
  };

  // Strict Private Route Enforcement:
  // 1. Vendors cannot access user pages (must stay on /vendor)
  // 2. Users cannot access vendor page (must stay on customer pages)
  useEffect(() => {
    const isVendor = account?.accountType === "vendor";
    const isUser = account?.accountType === "user";
    const path = window.location.pathname;

    if (isVendor) {
      if (path !== "/vendor" || !vendorRoute || craftRoute) {
        setVendorRoute(true);
        setCraftRoute(null);
        navigate("/vendor", { replace: true });
      }
      return;
    }

    if (isUser) {
      if (path === "/vendor" || vendorRoute) {
        setVendorRoute(false);
        navigate("/", { replace: true });
      }
      return;
    }
  }, [account?.accountType, vendorRoute, craftRoute, navigate]);

  useEffect(() => {
    const onPop = () => {
      const isVendor = account?.accountType === "vendor";
      const isUser = account?.accountType === "user";
      const path = window.location.pathname;

      if (isVendor) {
        setVendorRoute(true);
        setCraftRoute(null);
        if (path !== "/vendor") {
          navigate("/vendor", { replace: true });
        }
        return;
      }

      if (isUser && path === "/vendor") {
        setVendorRoute(false);
        navigate("/", { replace: true });
        return;
      }

      const m = path.match(/^\/crafts\/([^/]+)/);
      setCraftRoute(m ? m[1] : null);
      setVendorRoute(path === "/vendor");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [account?.accountType, navigate]);
  useEffect(() => {
    setPage(1);
  }, [filter, query, sort, priceBand]);
  useEffect(() => {
    if (!account?._id) {
      if (syncedAccountRef.current !== null) return;
      localStorage.removeItem("ozabay-cart");
      localStorage.removeItem("ozabay-wishlist");
      localStorage.setItem(
        guestSavedProductsStorageKey("cart"),
        JSON.stringify(cart),
      );
      return;
    }
    if (
      !savedProductsLoadedRef.current ||
      syncedAccountRef.current !== account._id
    )
      return;
    localStorage.setItem(
      savedProductsStorageKey("cart", account._id),
      JSON.stringify(cart),
    );
  }, [account?._id, cart]);
  useEffect(() => {
    if (!account?._id) {
      if (syncedAccountRef.current !== null) return;
      localStorage.setItem(
        guestSavedProductsStorageKey("favorites"),
        JSON.stringify(wish),
      );
      return;
    }
    if (
      !savedProductsLoadedRef.current ||
      syncedAccountRef.current !== account._id
    )
      return;
    localStorage.setItem(
      savedProductsStorageKey("favorites", account._id),
      JSON.stringify(wish),
    );
  }, [account?._id, wish]);
  useEffect(() => {
    const accountId = account?._id;
    if (!accountId) {
      syncedAccountRef.current = null;
      savedProductsLoadedRef.current = false;
      setCart(getCachedSavedProducts("cart", null));
      setWish(getCachedSavedProducts("favorites", null));
      return;
    }
    if (syncedAccountRef.current === accountId) return;
    syncedAccountRef.current = accountId;
    savedProductsLoadedRef.current = false;
    const cachedCart = getCachedSavedProducts("cart");
    const cachedWish = getCachedSavedProducts("favorites");
    const guestCart = getCachedSavedProducts("cart", null);
    const guestWish = getCachedSavedProducts("favorites", null);
    setCart(mergeSavedProducts(cachedCart, guestCart));
    setWish([...new Set([...cachedWish, ...guestWish])]);
    let cancelled = false;
    Promise.all([
      fetchUserProducts("cart", requestAuthenticatedApi),
      fetchUserProducts("favorites", requestAuthenticatedApi),
    ]).then(([serverCart, serverWish]) => {
      if (cancelled) return;
      if (!serverCart || !serverWish) return;
      savedProductsLoadedRef.current = true;
      setCart((current) => mergeSavedProducts(current, serverCart.products));
      setWish((current) => [
        ...current,
        ...serverWish.ids
          .map(String)
          .filter((id) => !current.some((savedId) => String(savedId) === id)),
      ]);
    });
    return () => {
      cancelled = true;
    };
  }, [account?._id]);
  useEffect(() => {
    if (!account?._id || !savedProductsLoadedRef.current) return;
    const timer = setTimeout(() => {
      syncSavedProductsToServer(requestAuthenticatedApi);
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, wish]);
  useEffect(() => {
    if (vendorRoute) return;
    let cancelled = false;
    setRegisteredProductsError("");
    fetch(apiUrl("/api/products"))
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.message || "Unable to load maker products.");
        return result.products;
      })
      .then((products) => {
        if (cancelled) return;
        setRegisteredProductsLoaded(true);
        setRegisteredProducts(
          products.map((product) => {
            const priceValue =
              product.price * (1 - (product.discountPercent || 0) / 100);
            return {
              id: `vendor-${product._id}`,
              name: product.name,
              category: product.category,
              priceValue,
              price: money(priceValue),
              image: apiUrl(product.images[0]),
              images: product.images.map(apiUrl),
              video: product.video ? apiUrl(product.video) : "",
              createdAt: product.createdAt,
              description: product.description,
              story: product.description,
              artisan: product.vendorId?.name || "OzaBay maker",
              material: "Handmade",
              offer: product.offer,
              regularPrice: product.discountPercent ? money(product.price) : "",
              vendorProduct: true,
            };
          }),
        );
      })
      .catch((error) => {
        if (!cancelled) setRegisteredProductsError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [vendorRoute]);
  useEffect(() => {
    if (!registeredProductsLoaded || !savedProductsLoadedRef.current) return;
    const activeVendorProductIds = new Set(
      registeredProducts.map((product) => String(product.id)),
    );
    setCart((current) =>
      current.filter(
        (product) =>
          !String(product.id).startsWith("vendor-") ||
          activeVendorProductIds.has(String(product.id)),
      ),
    );
    setWish((current) =>
      current.filter(
        (productId) =>
          !String(productId).startsWith("vendor-") ||
          activeVendorProductIds.has(String(productId)),
      ),
    );
  }, [registeredProducts, registeredProductsLoaded, account?._id]);
  useEffect(() => {
    let cancelled = false;
    if (!catalogProducts.length) {
      setReviewSummaries({});
      return;
    }
    setReviewSummaryError("");
    const chunks = [];
    for (let index = 0; index < catalogProducts.length; index += 50)
      chunks.push(catalogProducts.slice(index, index + 50));
    Promise.all(
      chunks.map(async (products) => {
        const productIds = products.map((product) => product.id).join(",");
        const response = await fetch(
          apiUrl(`/api/products/reviews/summary?productIds=${encodeURIComponent(productIds)}`),
        );
        const result = await response.json().catch(() => ({}));
        if (!response.ok)
          throw new Error(result.message || "Unable to load product ratings.");
        return result.summaries;
      }),
    )
      .then((results) => {
        if (cancelled) return;
        setReviewSummaries(Object.assign({}, ...results));
      })
      .catch((error) => {
        if (!cancelled) setReviewSummaryError(error.message);
      });
    return () => {
      cancelled = true;
    };
  }, [catalogProducts]);
  useEffect(() => {
    localStorage.setItem(
      "ozabay-recently-viewed",
      JSON.stringify(recentlyViewed),
    );
  }, [recentlyViewed]);
  useEffect(() => {
    if (modal?.type !== "product") return;
    const id = modal.product?.id;
    if (!id) return;
    setRecentlyViewed((prev) =>
      [id, ...prev.filter((x) => x !== id)].slice(0, 6),
    );
  }, [modal]);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const progress = scrollProgressRef.current;
        if (!progress) return;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  const addToCartDirect = (p) =>
    setCart((c) =>
      c.some((x) => x.id === p.id)
        ? c.map((x) => (x.id === p.id ? { ...x, qty: x.qty + 1 } : x))
        : [...c, { ...p, qty: 1 }],
    );
  const add = (p) => {
    addToCartDirect(p);
    return true;
  };
  const remove = (id) => {
    setLeaving((l) => (l.includes(id) ? l : [...l, id]));
    window.setTimeout(() => {
      setCart((c) => c.filter((x) => x.id !== id));
      setLeaving((l) => l.filter((x) => x !== id));
    }, 420);
  };
  const clearAll = () => {
    setLeaving((l) => [...new Set([...l, ...cart.map((x) => x.id)])]);
    window.setTimeout(() => {
      setCart([]);
      setLeaving([]);
    }, 420);
  };
  const qty = (id, d) =>
    setCart((c) =>
      c.map((x) => (x.id === id ? { ...x, qty: Math.max(1, x.qty + d) } : x)),
    );
  const toggleWishDirect = (p) =>
    setWish((w) => {
      const productId = String(p.id);
      return w.some((id) => String(id) === productId)
        ? w.filter((id) => String(id) !== productId)
        : [...w, productId];
    });
  const toggleWish = (p) => {
    toggleWishDirect(p);
  };
  const addCustom = () => {
    const p = {
      id: `custom-${Date.now()}`,
      name: `Custom ${custom.form}`,
      category: "Made to order",
      priceValue: customPrice,
      price: money(customPrice),
      image: customImage,
      artisan: "OzaBay Custom Studio",
      city: "India",
      material: custom.material,
      custom: { ...custom },
    };
    if (add(p)) setModal("cart");
  };
  const submitCustom = (e) => {
    e.preventDefault();
    const id = `OZ-C${Date.now().toString().slice(-7)}`;
    const payload = {
      requestId: id,
      createdAt: new Date().toISOString(),
      customer: orderForm,
      design: custom,
      price: customPrice,
    };
    localStorage.setItem("ozabay-last-custom-request", JSON.stringify(payload));
    setRequestId(id);
    setOrderSent(true);
    setCustomStep(1);
  };
  const completeOrder = (savedOrder) => {
    const order = {
      id: savedOrder._id,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt,
      items: savedOrder.items.map((item) => ({
        name: item.name,
        productId: item.productId,
        qty: item.quantity,
        priceValue: item.unitPrice,
        fulfillmentStatus: item.fulfillmentStatus,
        deliveredAt: item.deliveredAt,
        cashOnDelivery: item.cashOnDelivery,
        cancellationRequest: item.cancellationRequest,
        returnRequest: item.returnRequest,
      })),
      total: savedOrder.total,
      customer: savedOrder.customer,
      status: savedOrder.orderStatus,
      paymentMethod: savedOrder.paymentMethod,
      paymentStatus: savedOrder.paymentStatus,
      paymentDetails: savedOrder.paymentDetails,
      cancelledAt: savedOrder.cancelledAt,
    };
    setOrders((current) => [
      order,
      ...current.filter((item) => item.id !== order.id),
    ]);
    setPlacedOrder(order);
    setCart([]);
    setCheckoutError("");
    setModal("order-success");
  };
  const placeOrder = async (e) => {
    e.preventDefault();
    if (!cart.length) return;
    if (account?.accountType !== "user") {
      pendingCheckoutAuth.current = true;
      setAuthView("signin");
      setModal("account");
      return;
    }
    if (
      cart.some((item) => !/^vendor-[a-fA-F0-9]{24}$/.test(String(item.id)))
    ) {
      setCheckoutError(
        "Custom-made items need a separate quote and can't be included in this checkout. Remove them from your cart to continue.",
      );
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const { payment, ...customer } = checkout;
      const { order, razorpay } = await requestAuthenticatedApi("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.id,
            quantity: item.qty,
          })),
          customer,
          paymentMethod: payment,
        }),
      });

      if (payment === "Cash on delivery") {
        completeOrder(order);
        return;
      }

      await loadRazorpay();
      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable in this browser.");
      }
      if (!razorpay?.keyId || !razorpay?.orderId) {
        throw new Error(
          "Online payment could not be initialized. Please try again.",
        );
      }

      const paymentWindow = new window.Razorpay({
        key: razorpay.keyId,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        name: "OzaBay",
        description: "Handcrafted marketplace order",
        order_id: razorpay.orderId,
        prefill: {
          name: checkout.name,
          email: checkout.email,
          contact: checkout.phone,
        },
        theme: { color: "#17365f" },
        config: {
          display: {
            blocks: {
              online: {
                name: "Pay using UPI, cards, wallets or netbanking",
                instruments: [
                  { method: "upi" },
                  { method: "card" },
                  { method: "wallet" },
                  { method: "netbanking" },
                ],
              },
            },
            sequence: ["block.online"],
            hide: [{ method: "upi", flows: ["collect"] }],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (paymentResult) => {
          let verificationError;
          const verificationOptions = {
            method: "POST",
            body: JSON.stringify({
              orderId: order._id,
              ...paymentResult,
            }),
          };
          for (let attempt = 0; attempt < 4; attempt += 1) {
            if (attempt > 0) {
              await new Promise((resolve) =>
                window.setTimeout(resolve, attempt * 750),
              );
            }
            try {
              const verified = await requestAuthenticatedApi(
                "/orders/verify-payment",
                verificationOptions,
              );
              completeOrder(verified.order);
              setCheckoutBusy(false);
              return;
            } catch (error) {
              verificationError = error;
              const paymentMayStillSettle =
                error.message === "The payment has not been captured for this order.";
              const retryableResponse =
                !Number.isInteger(error.status) ||
                error.status >= 500 ||
                error.status === 408 ||
                error.status === 429;
              if (!paymentMayStillSettle && !retryableResponse) break;
            }
          }

          for (let attempt = 0; attempt < 3; attempt += 1) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, (attempt + 1) * 1000),
            );
            try {
              const { orders: latestOrders } = await requestAuthenticatedApi(
                "/orders/mine",
                { cache: "no-store" },
              );
              const paidOrder = latestOrders?.find(
                (latestOrder) =>
                  latestOrder._id === order._id &&
                  latestOrder.paymentStatus === "paid",
              );
              if (paidOrder) {
                completeOrder(paidOrder);
                setCheckoutBusy(false);
                return;
              }
            } catch (refreshError) {
              console.error(
                "Unable to refresh order after payment verification failed:",
                refreshError,
              );
            }
          }
          setCheckoutError(
            `Razorpay has not confirmed this payment yet, so the order is not confirmed. Do not retry until the payment status is resolved. Check your Orders page; contact support with order ${order._id} if it remains unpaid. ${verificationError?.message || "Payment verification could not be completed."}`,
          );
          setCheckoutBusy(false);
        },
        modal: {
          ondismiss: () => setCheckoutBusy(false),
          escape: true,
          confirm_close: true,
        },
      });
      paymentWindow.on("payment.failed", (response) => {
        console.error("Razorpay payment failed:", response?.error);
        setCheckoutError(
          `Razorpay could not complete this payment${response?.error?.description ? `: ${response.error.description}` : ""}. Your order is not confirmed. If your bank account was debited, check for a reversal before retrying.`,
        );
        setCheckoutBusy(false);
      });
      paymentWindow.open();
    } catch (error) {
      setCheckoutError(error.message);
      setCheckoutBusy(false);
    }
  };
  const finishAuthentication = (data) => {
    if (!data) return;
    const { accessToken: token, ...user } = data;
    localStorage.setItem("ozabay-account", JSON.stringify(user));
    if (token) {
      sessionStorage.setItem("ozabay-access-token", token);
      setAccessToken(token);
    }
    setAccount(user);
    setVendorSessionReady(true);
    setVendorSessionError("");
    if (pendingCheckoutAuth.current && user.accountType === "user") {
      pendingCheckoutAuth.current = false;
      setModal("checkout");
    } else {
      pendingCheckoutAuth.current = false;
      setModal(null);
    }
    setCraftRoute(null);
    const isVendor = user.accountType === "vendor";
    setVendorRoute(isVendor);
    navigate(isVendor ? "/vendor" : "/", { replace: true });
    if (isVendor) {
      void fetchVendorProducts();
    }
  };
  const signUp = (data) => finishAuthentication(data);
  const signIn = async (credentials) => {
    const response = await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(credentials),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.message || "Unable to sign in. Please try again.");
    if (result.admin) {
      if (!result.adminToken) {
        throw new Error("The admin session could not be created. Please try again.");
      }
      sessionStorage.setItem(ADMIN_TOKEN_KEY, result.adminToken);
      navigate(ADMIN_DASHBOARD_PATH, { replace: true });
      return;
    }
    finishAuthentication({ ...result.user, accessToken: result.accessToken });
  };
  const requestPasswordReset = async (email) => {
    const response = await fetch(apiUrl("/api/auth/forgot-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        result.message || "Unable to request a reset code. Please try again.",
      );
    return result;
  };
  const resetPassword = async (data) => {
    const response = await fetch(apiUrl("/api/auth/reset-password"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        result.message || "Unable to reset your password. Please try again.",
      );
    return result;
  };
  const refreshAccessToken = () => {
    if (!refreshAccessTokenPromise) {
      refreshAccessTokenPromise = (async () => {
        const response = await fetch(apiUrl("/api/auth/refresh-token"), {
          method: "GET",
          credentials: "include",
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401) {
            sessionStorage.removeItem("ozabay-access-token");
            localStorage.removeItem("ozabay-account");
            setAccessToken("");
            setAccount(null);
            setAuthView("signin");
          }
          const error = new Error(
            result.message || "Your session has expired. Please sign in again.",
          );
          error.status = response.status;
          throw error;
        }
        if (!result.accessToken)
          throw new Error(
            "Your session could not be refreshed. Please sign in again.",
          );
        sessionStorage.setItem("ozabay-access-token", result.accessToken);
        setAccessToken(result.accessToken);
        return result.accessToken;
      })().finally(() => {
        refreshAccessTokenPromise = null;
      });
    }
    return refreshAccessTokenPromise;
  };
  const fetchVendorProducts = async () => {
    setVendorProductsLoaded(false);
    try {
      const result = await requestVendorApi("/products");
      setVendorProducts(Array.isArray(result.products) ? result.products : []);
    } catch (error) {
      console.error("Unable to load vendor products:", error);
      setVendorProducts([]);
    } finally {
      setVendorProductsLoaded(true);
    }
  };

  useEffect(() => {
    if (account?.accountType === "vendor") {
      void fetchVendorProducts();
      return;
    }
    setVendorProducts([]);
    setVendorProductsLoaded(false);
  }, [account?._id, account?.accountType]);

  useEffect(() => {
    if (account?.accountType !== "user") {
      setOrders([]);
      return;
    }

    let cancelled = false;
    let latestRequest = 0;
    const loadOrders = ({ silent = false } = {}) => {
      const requestNumber = ++latestRequest;
      requestAuthenticatedApi("/orders/mine", { cache: "no-store" })
        .then(({ orders: savedOrders }) => {
          if (cancelled || requestNumber !== latestRequest) return;
          setOrders(
            (savedOrders || []).map((order) => ({
              id: order._id,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              items: order.items.map((item) => ({
                name: item.name,
                productId: item.productId,
                qty: item.quantity,
                priceValue: item.unitPrice,
                fulfillmentStatus: item.fulfillmentStatus,
                deliveredAt: item.deliveredAt,
                cashOnDelivery: item.cashOnDelivery,
                cancellationRequest: item.cancellationRequest,
                returnRequest: item.returnRequest,
              })),
              total: order.total,
              customer: order.customer,
              status: order.orderStatus,
              paymentMethod: order.paymentMethod,
              paymentStatus: order.paymentStatus,
              paymentDetails: order.paymentDetails,
              cancelledAt: order.cancelledAt,
            })),
          );
        })
        .catch((error) => {
          if (!cancelled && requestNumber === latestRequest && !silent) {
            console.error("Unable to load customer orders:", error);
          }
        });
    };

    customerOrdersRefreshRef.current = () => loadOrders({ silent: true });
    loadOrders();
    const interval = window.setInterval(
      () => {
        if (document.visibilityState === "visible") {
          loadOrders({ silent: true });
        }
      },
      30000,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") loadOrders({ silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      customerOrdersRefreshRef.current = null;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [account?._id, account?.accountType]);

  useEffect(() => {
    if (account?.accountType !== "user") return;
    const savedLocation = account.deliveryLocation || {};
    setCheckout((current) => ({
      ...current,
      name: current.name || savedLocation.fullName || account.name || "",
      email: current.email || account.email || "",
      phone: current.phone || savedLocation.mobile || "",
      address:
        current.address ||
        [savedLocation.building, savedLocation.area, savedLocation.address]
          .filter(Boolean)
          .join(", "),
      city: current.city || savedLocation.city || "",
      pincode: current.pincode || savedLocation.pincode || "",
    }));
  }, [account?._id, account?.accountType]);

  const requestVendorApi = async (path, options = {}) => {
    let token = accessToken || sessionStorage.getItem("ozabay-access-token");
    if (!token) token = await refreshAccessToken();
    const send = (authToken) =>
      fetch(apiUrl(`/api/vendor${path}`), {
        ...options,
        headers: { ...options.headers, Authorization: `Bearer ${authToken}` },
      });
    let response = await send(token);
    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await send(token);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        result.message || "Unable to complete this vendor request.",
      );
    return result;
  };
  const requestAuthenticatedApi = async (path, options = {}) => {
    let token = accessToken || sessionStorage.getItem("ozabay-access-token");
    if (!token) token = await refreshAccessToken();
    const send = (authToken) =>
      fetch(apiUrl(`/api${path}`), {
        ...options,
        headers: {
          ...options.headers,
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
    let response = await send(token);
    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await send(token);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(
        result.message || "Unable to complete this request.",
      );
      error.status = response.status;
      throw error;
    }
    return result;
  };
  useEffect(() => {
    if (account?.accountType !== "vendor") {
      setVendorSessionReady(true);
      setVendorSessionError("");
      return;
    }

    let active = true;
    setVendorSessionReady(false);
    setVendorSessionError("");
    requestAuthenticatedApi("/auth/me")
      .then(({ user }) => {
        if (!user?.id || !user.accountType) {
          throw new Error("The server returned an invalid account session.");
        }
        const verifiedAccount = {
          ...account,
          ...user,
          _id: user.id || account._id,
        };
        localStorage.setItem("ozabay-account", JSON.stringify(verifiedAccount));
        if (active) setAccount(verifiedAccount);
      })
      .catch((error) => {
        if (!active) return;
        if (error.status === 401 || error.status === 403) {
          sessionStorage.removeItem("ozabay-access-token");
          localStorage.removeItem("ozabay-account");
          setAccessToken("");
          setAccount(null);
          return;
        }
        setVendorSessionError(
          error.message || "Unable to verify your vendor session.",
        );
      })
      .finally(() => {
        if (active) setVendorSessionReady(true);
      });

    return () => {
      active = false;
    };
  }, [account?.accountType]);
  const cancelCustomerOrder = async (orderId) => {
    const result = await requestAuthenticatedApi(
      `/orders/${encodeURIComponent(orderId)}/cancel`,
      { method: "POST" },
    );
    const savedOrder = result.order;
    const order = {
      id: savedOrder._id,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt,
      items: savedOrder.items.map((item) => ({
        name: item.name,
        productId: item.productId,
        qty: item.quantity,
        priceValue: item.unitPrice,
        fulfillmentStatus: item.fulfillmentStatus,
        deliveredAt: item.deliveredAt,
        cashOnDelivery: item.cashOnDelivery,
        cancellationRequest: item.cancellationRequest,
        returnRequest: item.returnRequest,
      })),
      total: savedOrder.total,
      customer: savedOrder.customer,
      status: savedOrder.orderStatus,
      paymentMethod: savedOrder.paymentMethod,
      paymentStatus: savedOrder.paymentStatus,
      paymentDetails: savedOrder.paymentDetails,
      cancelledAt: savedOrder.cancelledAt,
    };
    setOrders((current) =>
      current.map((existing) => (existing.id === order.id ? order : existing)),
    );
    return result;
  };
  const requestOrderItemCancellation = async (
    orderId,
    productId,
    reason = "",
  ) => {
    const result = await requestAuthenticatedApi(
      `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(productId)}/cancel-request`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
    const savedOrder = result.order;
    const order = {
      id: savedOrder._id,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt,
      items: savedOrder.items.map((item) => ({
        name: item.name,
        productId: item.productId,
        qty: item.quantity,
        priceValue: item.unitPrice,
        fulfillmentStatus: item.fulfillmentStatus,
        deliveredAt: item.deliveredAt,
        cashOnDelivery: item.cashOnDelivery,
        cancellationRequest: item.cancellationRequest,
        returnRequest: item.returnRequest,
      })),
      total: savedOrder.total,
      customer: savedOrder.customer,
      status: savedOrder.orderStatus,
      paymentMethod: savedOrder.paymentMethod,
      paymentStatus: savedOrder.paymentStatus,
      paymentDetails: savedOrder.paymentDetails,
      cancelledAt: savedOrder.cancelledAt,
    };
    setOrders((current) =>
      current.map((existing) => (existing.id === order.id ? order : existing)),
    );
    return result;
  };
  const requestOrderItemReturn = async (orderId, productId, reason = "") => {
    const result = await requestAuthenticatedApi(
      `/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(productId)}/return`,
      { method: "POST", body: JSON.stringify({ reason }) },
    );
    const savedOrder = result.order;
    const order = {
      id: savedOrder._id,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt,
      items: savedOrder.items.map((item) => ({
        name: item.name,
        productId: item.productId,
        qty: item.quantity,
        priceValue: item.unitPrice,
        fulfillmentStatus: item.fulfillmentStatus,
        deliveredAt: item.deliveredAt,
        cashOnDelivery: item.cashOnDelivery,
        cancellationRequest: item.cancellationRequest,
        returnRequest: item.returnRequest,
      })),
      total: savedOrder.total,
      customer: savedOrder.customer,
      status: savedOrder.orderStatus,
      paymentMethod: savedOrder.paymentMethod,
      paymentStatus: savedOrder.paymentStatus,
      paymentDetails: savedOrder.paymentDetails,
      cancelledAt: savedOrder.cancelledAt,
    };
    setOrders((current) =>
      current.map((existing) => (existing.id === order.id ? order : existing)),
    );
    return result;
  };
  const listSupportMessages = ({ markRead = false } = {}) =>
    requestAuthenticatedApi(`/support${markRead ? "?markRead=true" : ""}`);
  const getSupportUnreadCount = () =>
    requestAuthenticatedApi("/support/unread-count");
  const createSupportMessage = (payload) =>
    requestAuthenticatedApi("/support", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  const replySupportMessage = (ticketId, message) =>
    requestAuthenticatedApi(`/support/${encodeURIComponent(ticketId)}/replies`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
  const submitProductReview = async (product, review) => {
    const result = await requestAuthenticatedApi(
      `/products/${encodeURIComponent(product.id)}/reviews`,
      { method: "POST", body: JSON.stringify(review) },
    );
    setReviewSummaries((current) => ({
      ...current,
      [product.id]: result.summary,
    }));
    setReviewRefreshToken((current) => current + 1);
    return result;
  };
  const requireReviewSignIn = () => {
    setReviewLoginRequired(true);
    setAuthView("signin");
    setModal("account");
  };
  const requestPasswordChange = async (currentPassword) => {
    return requestAuthenticatedApi("/auth/change-password/request", {
      method: "POST",
      body: JSON.stringify({ password: currentPassword }),
    });
  };

  const confirmPasswordChange = async (payload) => {
    return requestAuthenticatedApi("/auth/change-password/confirm", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  };

  const updateProfile = async (changes) => {
    let token = accessToken || sessionStorage.getItem("ozabay-access-token");
    if (!token) token = await refreshAccessToken();
    const send = (authToken) =>
      fetch(apiUrl("/api/auth/profile"), {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        credentials: "include",
        body: JSON.stringify(changes),
      });
    let response = await send(token);
    if (response.status === 401) {
      token = await refreshAccessToken();
      response = await send(token);
    }
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(
        result.message || "Unable to update your account. Please try again.",
      );
    localStorage.setItem("ozabay-account", JSON.stringify(result.user));
    setAccount(result.user);
    return result.user;
  };
  const saveDeliveryLocation = async (
    deliveryLocations,
    activeLocationIndex,
  ) => {
    const updatedAccount = await updateProfile({
      deliveryLocations,
      activeLocationIndex,
    });
    const deliveryLocation = updatedAccount.deliveryLocation;
    setCheckout((current) => ({
      ...current,
      name: deliveryLocation?.fullName || updatedAccount.name || current.name,
      email: updatedAccount.email || current.email,
      phone: deliveryLocation?.mobile || current.phone,
      address: deliveryLocation
        ? [deliveryLocation.building, deliveryLocation.area]
            .filter(Boolean)
            .join(", ")
        : "",
      city: deliveryLocation?.city || current.city,
      pincode: deliveryLocation?.pincode || current.pincode,
    }));
  };
  const logout = async () => {
    const response = await fetch(apiUrl("/api/auth/logout"), {
      method: "GET",
      credentials: "include",
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 400)
      throw new Error(
        result.message || "Unable to sign out. Please try again.",
      );
    localStorage.removeItem("ozabay-account");
    sessionStorage.removeItem("ozabay-access-token");
    setAccessToken("");
    setAccount(null);
    setVendorSessionReady(true);
    setVendorSessionError("");
    setVendorProducts([]);
    setVendorProductsLoaded(false);
    setVendorRoute(false);
    setAuthView("signin");
    setModal(null);
    navigate("/", { replace: true });
  };
  const openAccount = () => setModal("account");
  const openNav = (id, extra) => {
    if (account?.accountType === "vendor" || vendorRoute) {
      if (id === "dashboard") {
        setVendorRoute(true);
        navigate("/vendor");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      if (id === "listings") {
        setVendorRoute(true);
        navigate("/vendor");
        setTimeout(
          () =>
            document
              .getElementById("vendor-product-list")
              ?.scrollIntoView({ behavior: "smooth" }),
          60,
        );
        return;
      }
      if (id === "add-product") {
        setVendorRoute(true);
        navigate("/vendor");
        setTimeout(
          () =>
            document
              .getElementById("vendor-product-form")
              ?.scrollIntoView({ behavior: "smooth" }),
          60,
        );
        return;
      }
      if (id === "locations") {
        setVendorRoute(true);
        navigate("/vendor");
        setTimeout(
          () =>
            document
              .getElementById("vendor-locations")
              ?.scrollIntoView({ behavior: "smooth" }),
          60,
        );
        return;
      }
      if (id === "analytics" || id === "orders") {
        setVendorRoute(true);
        navigate("/vendor");
        setTimeout(
          () =>
            document
              .getElementById("vendor-orders")
              ?.scrollIntoView({ behavior: "smooth" }),
          60,
        );
        return;
      }
      if (id === "vendor-support") {
        setVendorRoute(true);
        navigate("/vendor");
        setTimeout(
          () => document.getElementById("vendor-support")?.scrollIntoView({ behavior: "smooth" }),
          60,
        );
        return;
      }
    }
    const map = {
      shop: "products",
      collections: "collections",
      artisans: "artisans",
      "create-your-own": "create",
      journal: "journal",
      about: "story",
    };
    if (id === "collections" && extra) {
      openCollection(extra);
      return;
    }
    if (id === "sell") {
      if (account?.accountType === "vendor") {
        setVendorRoute(true);
        navigate("/vendor");
        return;
      }
      setSignupAccountType("vendor");
      setAuthView("signup");
      setModal("account");
      return;
    }
    if (["corporate", "support"].includes(id)) {
      setModal(id);
      return;
    }
    go(map[id] || "home");
  };
  const resetCustom = () =>
    setCustom({
      form: "Vessel",
      material: "Clay",
      finish: "Natural",
      size: "Medium",
      tone: "Earth",
      engraving: "",
      notes: "",
    });
  const openCollection = (category) => {
    setFilter(category);
    setPriceBand(null);
    setQuery("");
    go("products");
  };
  const openTheme = (theme) => {
    setFilter("All");
    setQuery(theme.query || "");
    go("products");
  };
  const openPrice = (band) => {
    setFilter("All");
    setQuery("");
    go("products");
    setTimeout(() => setSort(band.min ? "price-low" : "price-low"), 0);
  };
  const openRegion = (region) => {
    const state = INDIA_CRAFTS.find((s) => s.name === region.name);
    if (state) openStateCraft(state, region.query || null);
  };
  const customOptions = {
    form: Object.keys(CUSTOM_PRICES.form),
    material: Object.keys(CUSTOM_PRICES.material),
    finish: Object.keys(CUSTOM_PRICES.finish),
    size: Object.keys(CUSTOM_PRICES.size),
    tone: Object.keys(CUSTOM_PRICES.tone),
  };

  return (
    <>
      <div
        ref={scrollProgressRef}
        className="scroll-progress"
        aria-hidden="true"
      />
      <Navbar
        activeId={vendorRoute ? "dashboard" : "shop"}
        cartCount={cartCount}
        isVendor={account?.accountType === "vendor" || vendorRoute}
        registeredProducts={registeredProducts}
        onSearchClick={() => setModal("search")}
        onAccountClick={openAccount}
        onCartClick={() => setModal("cart")}
        onNavClick={openNav}
        onSelectCategory={openCollection}
      />
      <main id="home">
        {vendorRoute ? (
          !vendorSessionReady ? (
            <section className="vendor-access-page" role="status">
              <div className="oz-container">
                Verifying your private maker studio session…
              </div>
            </section>
          ) : vendorSessionError ? (
            <section className="vendor-access-page" role="alert">
              <div className="oz-container">
                <p>{vendorSessionError}</p>
                <button className="hero-action" onClick={() => window.location.reload()}>
                  Retry
                </button>
              </div>
            </section>
          ) : account?.accountType === "vendor" ? (
            <Suspense fallback={<div className="catalog-loading">Loading maker studio…</div>}>
              <VendorDashboard
                account={account}
                request={requestVendorApi}
                onGoToMarketplace={() => {
                  setVendorRoute(false);
                  navigate("/", { replace: true });
                }}
              />
            </Suspense>
          ) : (
            <section className="vendor-access-page">
              <div className="oz-container">
                <p className="eyebrow">OzaBay maker studio</p>
                <h1>
                  For the people
                  <br />
                  <em>who make it.</em>
                </h1>
                <p>
                  Sign in with your vendor account to manage your products and
                  offers.
                </p>
                <button
                  className="hero-action"
                  onClick={() => {
                    setAuthView("signin");
                    setModal("account");
                  }}
                >
                  Sign in to your vendor account ↗
                </button>
                <button
                  className="text-link"
                  onClick={() => {
                    setSignupAccountType("vendor");
                    setAuthView("signup");
                    setModal("account");
                  }}
                >
                  Create a vendor account
                </button>
              </div>
            </section>
          )
        ) : craftRoute ? (
          (() => {
            const state = INDIA_CRAFTS.find((s) => stateSlug(s) === craftRoute);
            return state ? (
              <Suspense fallback={<div className="catalog-loading">Loading craft edit…</div>}>
                <StateCraftMarketplace
                  state={state}
                  products={REGIONAL_CRAFT_PRODUCTS.filter(
                    (p) => p.state === state.name,
                  )}
                  onBack={backToAtlas}
                  onProduct={(p) => setModal({ type: "product", product: p })}
                  onAdd={(p) => {
                    if (add(p)) setModal("cart");
                  }}
                  onToggleWish={toggleWish}
                  wish={wish}
                />
              </Suspense>
            ) : (
              <div className="oz-container state-market-empty-page">
                <h1>Craft edit not found.</h1>
                <button className="hero-action" onClick={backToAtlas}>
                  Back to India Craft Atlas ↗
                </button>
              </div>
            );
          })()
        ) : (
          <>
            <Hero
              onExploreClick={() => go("collections")}
              onCreateClick={() => go("create")}
            />

            <Reveal className="oz-section oz-intro" id="story">
              <div className="oz-container oz-intro__grid">
                <p className="eyebrow">The digital atelier</p>
                <div>
                  <h2>
                    Objects that carry the <em>human touch.</em>
                  </h2>
                  <p>
                    OzaBay brings together small-batch objects made by
                    independent Indian artisans. Every curve, weave and tool
                    mark is part of the story.
                  </p>
                  <button
                    className="text-link"
                    onClick={() => setModal("about")}
                  >
                    Discover the OzaBay story ↗
                  </button>
                </div>
              </div>
            </Reveal>

            {recentlyViewed.length > 0 && (
              <section className="oz-section recently-viewed">
                <div className="oz-container">
                  <Reveal>
                    <div className="section-head">
                      <div>
                        <p className="eyebrow">Continue your journey</p>
                        <h2>
                          Recently <em>viewed.</em>
                        </h2>
                      </div>
                      <p>Pick up where you left off.</p>
                    </div>
                  </Reveal>
                  <div className="recent-rail">
                    {catalogProducts
                      .filter((p) => recentlyViewed.includes(p.id))
                      .map((p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setModal({ type: "product", product: p })
                          }
                        >
                          <img loading="lazy" decoding="async" src={p.image} alt={p.name} />
                          <span>{p.category}</span>
                          <strong>{p.name}</strong>
                          <small>{p.price}</small>
                        </button>
                      ))}
                  </div>
                </div>
              </section>
            )}
            <CraftFilm />
            <MakerStories />
            {registeredProductsError && (
              <div className="oz-container">
                <p className="registered-products__error" role="alert">
                  {registeredProductsError}
                </p>
              </div>
            )}
            {reviewSummaryError && (
              <div className="oz-container">
                <p className="registered-products__error" role="alert">
                  {reviewSummaryError}
                </p>
              </div>
            )}

            {/* ── Curated Collections from Registered Vendor Products by Category ── */}
            <section id="collections" className="oz-section oz-collections">
              <div className="oz-container">
                <Reveal>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Artisan Collections</p>
                      <h2>
                        Crafted by <em>category.</em>
                      </h2>
                    </div>
                    <p>
                      Explore pieces registered by independent makers across
                      India, organized into craft collections.
                    </p>
                  </div>
                </Reveal>

                {registeredCollections.length > 0 ? (
                  <div className="collection-grid">
                    {registeredCollections.map((group) => (
                      <article key={group.category} className="collection-card">
                        <button
                          type="button"
                          onClick={() => openCollection(group.category)}
                        >
                          <div className="collection-card__image">
                            {group.coverImage ? (
                              <img loading="lazy" decoding="async"
                                src={group.coverImage}
                                alt={group.category}
                              />
                            ) : (
                              <div className="collection-card__placeholder">
                                ✦
                              </div>
                            )}
                            <span>
                              {group.count}{" "}
                              {group.count === 1 ? "piece" : "pieces"}
                            </span>
                          </div>
                          <div className="collection-card__copy">
                            <div>
                              <h3>{group.category}</h3>
                              <p>{group.material} · Made by verified makers</p>
                            </div>
                            <strong>Explore ↗</strong>
                          </div>
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="collection-empty-placeholder">
                    <span className="collection-empty-icon">🏺</span>
                    <h3>Collections in the making</h3>
                    <p>
                      Artisan makers are currently registering their handcrafted
                      pieces. Check back soon or explore the active marketplace.
                    </p>
                    <button
                      type="button"
                      className="hero-action"
                      onClick={() => go("products")}
                    >
                      View Marketplace ↗
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section id="products" className="oz-section oz-products">
              <div className="oz-container">
                <Reveal>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">The marketplace</p>
                      <h2>
                        Made for <em>slow living.</em>
                      </h2>
                    </div>
                    <p>
                      {registeredProductsLoaded
                        ? registeredProducts.length > 0
                          ? `${registeredProducts.length} ${registeredProducts.length === 1 ? "piece" : "pieces"} across the marketplace. Explore maker listings with product stories, 3D views and state-wise craft collections.`
                          : "Makers are setting up their listings — check back soon."
                        : "Loading maker listings…"}
                    </p>
                  </div>
                </Reveal>
                <div className="catalog-toolbar">
                  <div className="filter-row">
                    {categories.map((category) => (
                      <button
                        key={category}
                        className={
                          filter === category && priceBand === null
                            ? "is-active"
                            : ""
                        }
                        onClick={() => {
                          setFilter(category);
                          setPriceBand(null);
                        }}
                      >
                        {category}
                      </button>
                    ))}
                    {priceBand && (
                      <button
                        className="is-active"
                        onClick={() => setPriceBand(null)}
                      >
                        {priceBand.label} ×
                      </button>
                    )}
                  </div>
                  <div className="catalog-tools">
                    <span>{shown.length} pieces</span>
                    <select
                      value={sort}
                      onChange={(event) => setSort(event.target.value)}
                    >
                      <option value="featured">Featured</option>
                      <option value="price-low">Price: low to high</option>
                      <option value="price-high">Price: high to low</option>
                      <option value="name">Name</option>
                    </select>
                  </div>
                </div>
                {/* Loading state */}
                {!registeredProductsLoaded && !registeredProductsError && (
                  <div className="catalog-loading">
                    <div
                      className="catalog-loading__spinner"
                      aria-hidden="true"
                    />
                    <p>Loading maker listings…</p>
                  </div>
                )}

                {/* Loaded but no products registered at all */}
                {registeredProductsLoaded &&
                  registeredProducts.length === 0 && (
                    <div className="empty-state empty-state--marketplace">
                      <span className="empty-state__icon" aria-hidden="true">
                        ✦
                      </span>
                      <h3>No maker listings yet.</h3>
                      <p>
                        Makers are setting up their storefronts — check back
                        soon.
                      </p>
                    </div>
                  )}

                {/* Products loaded, but filter/search returns nothing */}
                {registeredProductsLoaded &&
                  registeredProducts.length > 0 &&
                  visible.length === 0 && (
                    <div className="empty-state">
                      <h3>No pieces found.</h3>
                      <p>Try another search or collection.</p>
                      <button
                        className="hero-action"
                        onClick={() => {
                          setFilter("All");
                          setQuery("");
                          setPriceBand(null);
                        }}
                      >
                        Reset edit ↗
                      </button>
                    </div>
                  )}

                {visible.length ? (
                  <div className="product-grid">
                    {visible.map((product, index) => (
                      <Reveal key={product.id}>
                        <TiltCard
                          className={`product-card ${product.vendorProduct ? "product-card--vendor" : ""}`}
                        >
                          <div
                            className="product-image"
                            onClick={() =>
                              setModal({ type: "product", product })
                            }
                            role="button"
                            tabIndex="0"
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                setModal({ type: "product", product });
                              }
                            }}
                          >
                            <img loading="lazy" decoding="async" src={product.image} alt={product.name} />
                            <span className="product-badge">
                              {product.category || "Maker listing"}
                            </span>
                            <button
                              type="button"
                              className={`wishlist-btn ${wish.some((id) => String(id) === String(product.id)) ? "is-liked" : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleWish(product);
                              }}
                              aria-label={
                                wish.some(
                                  (id) => String(id) === String(product.id),
                                )
                                  ? `Remove ${product.name} from favorites`
                                  : `Add ${product.name} to favorites`
                              }
                              aria-pressed={wish.some(
                                (id) => String(id) === String(product.id),
                              )}
                            >
                              {wish.some(
                                (id) => String(id) === String(product.id),
                              )
                                ? "♥"
                                : "♡"}
                            </button>
                            <div
                              className="product-card__tools"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <button
                                onClick={() =>
                                  setModal({ type: "product", product })
                                }
                              >
                                Quick view
                              </button>
                              <button
                                onClick={() =>
                                  setModal({ type: "3d", product })
                                }
                              >
                                3D view
                              </button>
                            </div>
                            <span className="product-image__hint">
                              Tap to explore
                            </span>
                          </div>
                          <div className="product-card__meta">
                            <div>
                              <span>
                                {product.artisan}
                                {product.city ? ` · ${product.city}` : ""}
                              </span>
                              <h3>{product.name}</h3>
                              <p>
                                {product.material}
                                {reviewSummaries[product.id]?.reviewCount
                                  ? ` · ★ ${reviewSummaries[product.id].averageRating.toFixed(1)} (${reviewSummaries[product.id].reviewCount})`
                                  : product.rating
                                    ? ` · ★ ${product.rating}`
                                    : ""}
                              </p>
                            </div>
                            <strong>{product.price}</strong>
                          </div>
                          <button
                            className="product-add"
                            onClick={() => {
                              if (add(product)) setModal("cart");
                            }}
                          >
                            Add to bag <span>↗</span>
                          </button>
                        </TiltCard>
                      </Reveal>
                    ))}
                  </div>
                ) : null}
                {visible.length < shown.length && (
                  <div className="load-more">
                    <span>
                      Showing {visible.length} of {shown.length}
                    </span>
                    <button
                      className="hero-action"
                      onClick={() =>
                        setPage((current) => Math.min(totalPages, current + 1))
                      }
                    >
                      Load more pieces ↗
                    </button>
                  </div>
                )}
              </div>
            </section>

            <section id="artisans" className="oz-section artisans-section">
              <div className="oz-container">
                <Reveal>
                  <div className="section-head">
                    <div>
                      <p className="eyebrow">Made by people</p>
                      <h2>
                        Meet the <em>makers.</em>
                      </h2>
                    </div>
                    <p>
                      Each maker has a place in the marketplace—not just a name
                      beneath a product.
                    </p>
                  </div>
                </Reveal>
                <div className="artisan-grid">
                  {ARTISANS.map((a) => (
                    <article className="artisan-card" key={a.id}>
                      <button
                        onClick={() =>
                          setModal({ type: "artisan", artisan: a })
                        }
                      >
                        <div className="artisan-card__image">
                          <img loading="lazy" decoding="async" src={a.image} alt={a.name} />
                          <span>INDIA · {a.city.split(",")[0]}</span>
                        </div>
                        <div className="artisan-card__copy">
                          <p>{a.craft}</p>
                          <h3>{a.name}</h3>
                          <span>{a.story}</span>
                          <strong>Open maker profile ↗</strong>
                        </div>
                      </button>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <RegionalCrafts
              onRegion={openRegion}
              onProduct={(p) => setModal({ type: "product", product: p })}
            />

            <section id="reviews" className="oz-section reviews-section">
              <div className="oz-container">
                <Reveal>
                  <div className="section-head reviews-head">
                    <div>
                      <p className="eyebrow">The OzaBay journal of feedback</p>
                      <h2>
                        Loved for the <em>little details.</em>
                      </h2>
                    </div>
                    <p>
                      Explore the review experience we are building for OzaBay.
                      Product ratings, written notes and customer imagery can
                      all live here once the review backend is connected.
                    </p>
                  </div>
                </Reveal>
                <div className="reviews-summary">
                  <div className="reviews-score">
                    <strong>4.9</strong>
                    <span>★★★★★</span>
                    <small>Demo review experience</small>
                  </div>
                  <div className="reviews-bars">
                    {[
                      [5, 82],
                      [4, 13],
                      [3, 4],
                      [2, 1],
                      [1, 0],
                    ].map(([n, w]) => (
                      <div key={n}>
                        <span>{n} ★</span>
                        <i>
                          <b style={{ width: `${w}%` }} />
                        </i>
                        <em>{w}%</em>
                      </div>
                    ))}
                  </div>
                  <div className="reviews-trust">
                    <span>HANDMADE</span>
                    <strong>Craft-first</strong>
                    <small>
                      Maker story · material · care · customer notes
                    </small>
                  </div>
                </div>
                <div className="reviews-grid">
                  {[
                    [
                      "Aarohi S.",
                      "Jaipur Blue Pottery Vase",
                      "The piece has such a quiet presence. I loved seeing the maker story before deciding where it would sit at home.",
                      "https://images.pexels.com/photos/4307872/pexels-photo-4307872.jpeg?auto=compress&cs=tinysrgb&w=1000",
                      5,
                    ],

                    [
                      "Kabir M.",
                      "Neel Indigo Bowl Set",
                      "The product view makes the silhouette and scale much easier to understand. The indigo finish is beautiful.",
                      "https://images.pexels.com/photos/4308159/pexels-photo-4308159.jpeg?auto=compress&cs=tinysrgb&w=1000",
                      5,
                    ],

                    [
                      "Naina P.",
                      "Mitti Sculptural Vase",
                      "The tiny variations are exactly what make handmade objects feel special. The passport concept is a lovely touch.",
                      "https://images.pexels.com/photos/7627130/pexels-photo-7627130.jpeg?auto=compress&cs=tinysrgb&w=1000",
                      4,
                    ],

                    [
                      "Riya K.",
                      "Ganga Handloom Runner",
                      "The texture-first presentation feels much more useful than a generic product grid. It feels considered.",
                      "https://images.pexels.com/photos/17611927/pexels-photo-17611927.jpeg?auto=compress&cs=tinysrgb&w=1000",
                      5,
                    ],

                    [
                      "Arjun R.",
                      "Neem Carved Serving Board",
                      "I wanted something functional but not mass-produced. The craft story helps explain what makes the piece different.",
                      "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTrOWIfL8p2wnh6Js43L2qyHxkZGWCHsLX5odyxYzKadg&s=10",
                      5,
                    ],

                    [
                      "Maya D.",
                      "Aangan Stoneware Lamp",
                      "The combination of artisan details, material information and the 3D concept makes browsing much easier.",
                      "https://images.pexels.com/photos/36562466/pexels-photo-36562466.jpeg?auto=compress&cs=tinysrgb&w=1000",
                      4,
                    ],
                  ].map(([name, product, text, image, rating], i) => (
                    <article className="review-card" key={name}>
                      <div className="review-card__image">
                        <img loading="lazy" decoding="async" src={image} alt="" />
                        <span>REVIEW PREVIEW</span>
                      </div>
                      <div className="review-card__body">
                        <div className="review-card__top">
                          <span>{"★".repeat(rating)}</span>
                          <small>Demo note</small>
                        </div>
                        <p>“{text}”</p>
                        <div className="review-card__person">
                          <strong>{name}</strong>
                          <span>{product}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section id="create" className="oz-section oz-create">
              <div className="oz-container">
                <Reveal>
                  <div className="section-head custom-studio-head">
                    <div>
                      <p className="eyebrow">OzaBay Custom Studio</p>
                      <h2>
                        Create something <em>that is yours.</em>
                      </h2>
                    </div>
                  </div>
                </Reveal>
                <div className="create-grid create-grid--video">
                  <div className="create-video-pane">
                    <LazyVideo
                      className="create-video"
                      src="/videos/OZABAY.mp4"
                      active
                      poster={IMG.terracotta}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="create-upload-pane">
                    <CustomDesignUpload
                      onConfirm={() => {
                        setOrderSent(false);
                        setCustomStep(1);
                        setModal("custom-order");
                      }}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="oz-section order-track-section">
              <div className="oz-container track-grid">
                <div>
                  <p className="eyebrow">After checkout</p>
                  <h2>
                    Track the <em>craft journey.</em>
                  </h2>
                  <p>
                    Enter any demo OzaBay order ID generated by this frontend to
                    see the UI for order status, maker stage and delivery
                    handoff.
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setModal("tracking");
                    }}
                    className="track-form"
                  >
                    <input
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="e.g. OZ-1234567"
                    />
                    <button className="hero-action">Track order ↗</button>
                  </form>
                </div>
                <div className="timeline">
                  <div className="timeline-step is-done">
                    <span>01</span>
                    <div>
                      <strong>Order received</strong>
                      <small>Payment / request captured</small>
                    </div>
                  </div>
                  <div className="timeline-step is-current">
                    <span>02</span>
                    <div>
                      <strong>Maker crafting</strong>
                      <small>Handmade work in progress</small>
                    </div>
                  </div>
                  <div className="timeline-step">
                    <span>03</span>
                    <div>
                      <strong>Quality checked</strong>
                      <small>Final inspection & passport</small>
                    </div>
                  </div>
                  <div className="timeline-step">
                    <span>04</span>
                    <div>
                      <strong>On the way</strong>
                      <small>Courier handoff</small>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="oz-section sell-section">
              <div className="oz-container sell-grid">
                <div>
                  <p className="eyebrow">For independent makers</p>
                  <h2>
                    Bring your craft <em>to OzaBay.</em>
                  </h2>
                  <p>
                    Vendor accounts can register and manage product listings,
                    photos, videos, pricing and offers from one private studio.
                  </p>
                  <button
                    className="hero-action"
                    onClick={() => openNav("sell")}
                  >
                    Open seller studio ↗
                  </button>
                </div>
                <div className="seller-card">
                  <div>
                    <span>MAKER STUDIO</span>
                    <strong>06</strong>
                  </div>
                  <p>Profile completeness</p>
                  <div className="progress">
                    <i />
                  </div>
                  <ul>
                    <li>Maker profile</li>
                    <li>Product catalogue</li>
                    <li>Custom order inbox</li>
                    <li>Craft passport</li>
                    <li>Order fulfilment</li>
                  </ul>
                </div>
              </div>
            </section>

            <TrustStrip />

            <section className="oz-section newsletter">
              <div className="oz-container newsletter-box">
                <div>
                  <p className="eyebrow">The OzaBay letter</p>
                  <h2>
                    New makers, new drops,
                    <br />
                    <em>quietly delivered.</em>
                  </h2>
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setModal("thanks");
                  }}
                >
                  <input
                    type="email"
                    required
                    placeholder="Your email address"
                  />
                  <button>Subscribe ↗</button>
                </form>
              </div>
            </section>
          </>
        )}
      </main>

      <footer className="oz-footer">
        {/* ── Footer Pillars Strip ── */}
        <div className="oz-footer__pillars">
          <div className="oz-container oz-footer__pillars-grid">
            <div className="oz-footer__pillar-item">
              <span className="oz-footer__pillar-icon">🏺</span>
              <div>
                <strong>Direct Maker Studios</strong>
                <small>Handcrafted in small batches across India</small>
              </div>
            </div>
            <div className="oz-footer__pillar-item">
              <span className="oz-footer__pillar-icon">✦</span>
              <div>
                <strong>Craft Passport Verified</strong>
                <small>Material transparency & artisan origin</small>
              </div>
            </div>
            <div className="oz-footer__pillar-item">
              <span className="oz-footer__pillar-icon">🌿</span>
              <div>
                <strong>Conscious & Sustainable</strong>
                <small>Plastic-free packing & fair artisan pricing</small>
              </div>
            </div>
            <div className="oz-footer__pillar-item">
              <span className="oz-footer__pillar-icon">📦</span>
              <div>
                <strong>Inspected & Insured Transit</strong>
                <small>Safely packed to travel across 28 states</small>
              </div>
            </div>
          </div>
        </div>

        {/* ── Main Footer Grid ── */}
        <div className="oz-container footer-grid footer-grid--premium">
          <div className="footer-brand-col">
            <a className="footer-brand-logo" href="#home">
              <span className="footer-logo-mark">✦</span> OzaBay
            </a>
            <p className="footer-brand-copy">
              Connecting generational Indian craft traditions with mindful,
              contemporary living. Every piece carries the signature marks of
              human hands.
            </p>
            <div className="footer-craft-origin">
              <span className="footer-origin-dot" />
              <span>
                Artisan Ateliers in Jaipur · Molela · Saharanpur · Khurja ·
                Kutch
              </span>
            </div>
          </div>

          <div>
            <span className="footer-heading">Collections</span>
            <button type="button" onClick={() => openCollection("Ceramics")}>
              Ceramics & Stoneware
            </button>
            <button
              type="button"
              onClick={() => openCollection("Blue Pottery")}
            >
              Jaipur Blue Pottery
            </button>
            <button type="button" onClick={() => openCollection("Terracotta")}>
              Fired Terracotta
            </button>
            <button type="button" onClick={() => openCollection("Textiles")}>
              Handloom Textiles
            </button>
            <button type="button" onClick={() => openCollection("Woodcraft")}>
              Carved Woodcraft
            </button>
            <button type="button" onClick={() => openCollection("Metalcraft")}>
              Brass & Kansa
            </button>
            <button type="button" onClick={() => openCollection("Jewellery")}>
              Artisan Jewellery
            </button>
            <button type="button" onClick={() => go("collections")}>
              View All Collections ↗
            </button>
          </div>

          <div>
            <span className="footer-heading">The Atelier</span>
            <button type="button" onClick={() => go("products")}>
              The Marketplace
            </button>
            <button type="button" onClick={() => go("artisans")}>
              Meet the Makers
            </button>
            <button type="button" onClick={() => go("crafts-india")}>
              India Craft Atlas
            </button>
            <button type="button" onClick={() => go("create")}>
              Create Your Own
            </button>
            <button type="button" onClick={() => setModal("corporate")}>
              Corporate Gifting
            </button>
            <button type="button" onClick={() => setModal("about")}>
              Our Story
            </button>
          </div>

          <div>
            <span className="footer-heading">Artisan Hub</span>
            <button type="button" onClick={() => openNav("sell")}>
              Sell on OzaBay
            </button>
            <button type="button" onClick={() => openNav("sell")}>
              Maker Studio Access
            </button>
            <button type="button" onClick={() => setModal("corporate")}>
              Craft Commissions
            </button>
            <button type="button" onClick={() => openNav("sell")}>
              Shop Locations
            </button>
            <button type="button" onClick={() => setModal("support")}>
              Partner Standards
            </button>
          </div>

          <div>
            <span className="footer-heading">Your Space & Care</span>
            <button type="button" onClick={openAccount}>
              Artisan Account
            </button>
            {account?.accountType !== "vendor" && (
              <>
                <button type="button" onClick={() => setModal("wishlist")}>
                  Saved Wishlist ({wish.length})
                </button>
                <button type="button" onClick={() => setModal("cart")}>
                  Your Bag ({cartCount})
                </button>
                <button type="button" onClick={() => setModal("tracking")}>
                  Track Craft Order
                </button>
              </>
            )}
            <button type="button" onClick={() => setModal("support")}>
              Customer Concierge
            </button>
            <button type="button" onClick={() => setModal("support")}>
              Shipping & Returns
            </button>
          </div>
        </div>

        {/* ── Footer Bottom Copyright & Badges Bar ── */}
        <div className="oz-footer__bottom">
          <div className="oz-container oz-footer__bottom-inner">
            <p className="oz-footer__copyright">
              © {new Date().getFullYear()} OzaBay Crafts Pvt. Ltd. Preserving
              slow, living craft traditions across India 🇮🇳
            </p>
            <div className="oz-footer__legal-links">
              <button type="button" onClick={() => setModal("about")}>
                Craft Transparency
              </button>
              <span>·</span>
              <button type="button" onClick={() => setModal("support")}>
                Fair Artisan Charter
              </button>
              <span>·</span>
              <button type="button" onClick={() => setModal("support")}>
                Terms & Conditions
              </button>
              <span>·</span>
              <button type="button" onClick={() => setModal("support")}>
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </footer>

      {modal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setModal(null);
            }
          }}
        >
          <div className={`modal ${modal?.type === "3d" ? "modal--3d" : ""}`}>
            {modal?.type === "3d" && (
              <Suspense fallback={<div className="catalog-loading">Loading product viewer…</div>}>
                <Product3DViewer
                  product={modal.product}
                  onClose={() => setModal(null)}
                  onAdd={(p) => {
                    if (add(p)) setModal("cart");
                  }}
                  onSpace={(p) => setModal({ type: "space", product: p })}
                />
              </Suspense>
            )}
            {modal?.type === "product" && (
              <Suspense fallback={<div className="catalog-loading">Loading product details…</div>}>
                <ProductDetail
                  key={modal.product.id || modal.product.name}
                  product={modal.product}
                  reviewRefreshToken={reviewRefreshToken}
                  onClose={() => setModal(null)}
                  onAdd={(p) => {
                    if (add(p)) setModal("cart");
                  }}
                  onView3D={(p) => setModal({ type: "3d", product: p })}
                  onSpace={(p) => setModal({ type: "space", product: p })}
                  onReview={(p) => {
                    setReviewProduct(p);
                    setReviewLoginRequired(false);
                  }}
                />
              </Suspense>
            )}
            {modal?.type === "space" &&
              (() => {
                const product = modal.product;
                const spaceImages = product.images?.length
                  ? product.images
                  : [product.image, product.galleryImage].filter(
                      (image, index, all) =>
                        image && all.indexOf(image) === index,
                    );
                const imageIndex = Math.min(
                  modal.spaceImageIndex || 0,
                  spaceImages.length - 1,
                );
                const zoom = modal.spaceZoom || 1;
                return (
                  <>
                    <button
                      className="modal-close"
                      onClick={() => setModal(null)}
                    >
                      ×
                    </button>
                    <p className="eyebrow">View in your space</p>
                    <h2>
                      Preview <em>{product.name}</em> at home.
                    </h2>
                    <div className="space-room">
                      <div className="space-floor" />
                      <div className="space-wall">
                        <span>OzaBay room preview</span>
                        <div className="space-object">
                          <img loading="lazy" decoding="async"
                            src={spaceImages[imageIndex]}
                            alt={`${product.name} view ${imageIndex + 1}`}
                            style={{ transform: `scale(${zoom})` }}
                          />
                        </div>
                        <div
                          className="space-preview-zoom"
                          aria-label="Preview zoom controls"
                        >
                          <button
                            type="button"
                            aria-label="Zoom out"
                            title="Zoom out"
                            disabled={zoom <= 1}
                            onClick={() =>
                              setModal((current) => ({
                                ...current,
                                spaceZoom: Math.max(
                                  1,
                                  Number((zoom - 0.25).toFixed(2)),
                                ),
                              }))
                            }
                          >
                            −
                          </button>
                          <span aria-live="polite">
                            {Math.round(zoom * 100)}%
                          </span>
                          <button
                            type="button"
                            aria-label="Zoom in"
                            title="Zoom in"
                            disabled={zoom >= 3}
                            onClick={() =>
                              setModal((current) => ({
                                ...current,
                                spaceZoom: Math.min(
                                  3,
                                  Number((zoom + 0.25).toFixed(2)),
                                ),
                              }))
                            }
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                    {spaceImages.length > 1 && (
                      <div
                        className="space-image-gallery"
                        aria-label="Product images"
                      >
                        {spaceImages.map((image, index) => (
                          <button
                            key={`${image}-${index}`}
                            type="button"
                            className={imageIndex === index ? "is-active" : ""}
                            aria-label={`Show product image ${index + 1}`}
                            aria-pressed={imageIndex === index}
                            onClick={() =>
                              setModal((current) => ({
                                ...current,
                                spaceImageIndex: index,
                                spaceZoom: 1,
                              }))
                            }
                          >
                            <img loading="lazy" decoding="async" src={image} alt="" />
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="space-note">
                      This is a frontend room-scale preview concept. A
                      production AR layer can replace it later without changing
                      the product flow.
                    </p>
                    <button
                      className="hero-action"
                      onClick={() => {
                        if (add(product)) setModal("cart");
                      }}
                    >
                      Add to bag ↗
                    </button>
                  </>
                );
              })()}
            {modal?.type === "artisan" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <div className="artisan-modal artisan-modal--premium">
                  <div className="artisan-modal__media">
                    <img loading="lazy" decoding="async" src={modal.artisan.image} alt={modal.artisan.name} />
                    <div className="artisan-modal__media-note">
                      PORTRAIT · REPRESENTATIVE WORKSHOP PROFILE
                    </div>
                  </div>
                  <div>
                    <p className="eyebrow">{modal.artisan.craft}</p>
                    <h2>
                      {modal.artisan.name}
                      <br />
                      <em>by hand.</em>
                    </h2>
                    <p>{modal.artisan.story}</p>
                    <div className="artisan-facts">
                      <span>
                        Studio <b>{modal.artisan.city}</b>
                      </span>
                      <span>
                        Craft <b>{modal.artisan.products}</b>
                      </span>
                      <span>
                        Marketplace status <b>Maker profile UI</b>
                      </span>
                    </div>
                    <div className="artisan-modal__film">
                      <div>
                        <span>WATCH THE MAKING</span>
                        <strong>Representative workshop film</strong>
                        <small>
                          Commissioned OzaBay maker footage can replace this
                          later.
                        </small>
                      </div>
                      <button
                        onClick={() => {
                          const story =
                            MAKER_STORIES.find(
                              (s) => s.maker === modal.artisan.name,
                            ) || MAKER_STORIES[0];
                          setModal({ type: "maker-video", story });
                        }}
                      >
                        Play film ↗
                      </button>
                    </div>
                    <button
                      className="hero-action"
                      onClick={() => {
                        setFilter(modal.artisan.products);
                        setQuery("");
                        setModal(null);
                        go("products");
                      }}
                    >
                      Shop this maker ↗
                    </button>
                  </div>
                </div>
              </>
            )}
            {modal?.type === "maker-video" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <div className="maker-video-modal">
                  <div className="maker-video-modal__media">
                    <video
                      src={modal.story.video}
                      autoPlay
                      muted
                      loop
                      playsInline
                      controls
                      poster={
                        modal.story.id.includes("meera")
                          ? IMG.terracotta
                          : modal.story.id.includes("raghav")
                            ? IMG.blue
                            : modal.story.id.includes("sana")
                              ? IMG.indigo
                              : IMG.sculptural
                      }
                      onError={(e) => {
                        if (e.currentTarget.src !== modal.story.fallback)
                          e.currentTarget.src = modal.story.fallback;
                      }}
                    />
                  </div>
                  <div className="maker-video-modal__copy">
                    <p className="eyebrow">{modal.story.chapter}</p>
                    <h2>
                      {modal.story.maker}
                      <br />
                      <em>{modal.story.craft}</em>
                    </h2>
                    <p>{modal.story.story}</p>
                    <span>{modal.story.source}</span>
                    <button
                      className="hero-action"
                      onClick={() => {
                        const a = ARTISANS.find(
                          (x) => x.name === modal.story.maker,
                        );
                        if (a) {
                          setModal({ type: "artisan", artisan: a });
                        }
                      }}
                    >
                      Back to maker story ↗
                    </button>
                  </div>
                </div>
              </>
            )}
            {modal?.type === "gift-result" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <div className="gift-result-modal">
                  <div>
                    <p className="eyebrow">Gift edit ready</p>
                    <h2>
                      A thoughtful edit{" "}
                      <em>for {gift.recipient.toLowerCase()}.</em>
                    </h2>
                    <p>
                      We matched your occasion, style and budget with handmade
                      pieces. Review the edit before you add it to your bag or
                      send it to our gifting team.
                    </p>
                  </div>
                  <div className="gift-result-grid">
                    {modal.items.map((p) => (
                      <article key={p.id}>
                        <img loading="lazy" decoding="async" src={p.image} alt={p.name} />
                        <div>
                          <span>{p.category}</span>
                          <strong>{p.name}</strong>
                          <small>{p.price}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="gift-result-summary">
                    <div>
                      <span>Occasion</span>
                      <strong>{gift.occasion}</strong>
                    </div>
                    <div>
                      <span>Recipient</span>
                      <strong>{gift.recipient}</strong>
                    </div>
                    <div>
                      <span>Style</span>
                      <strong>{gift.style}</strong>
                    </div>
                    <div>
                      <span>Wrapping</span>
                      <strong>
                        {gift.wrapping ? "Included" : "Not added"}
                      </strong>
                    </div>
                    <div className="gift-result-total">
                      <span>Estimated edit</span>
                      <strong>{money(modal.total)}</strong>
                    </div>
                  </div>
                  {gift.message && (
                    <div className="gift-message-preview">
                      <span>GIFT MESSAGE</span>
                      <p>“{gift.message}”</p>
                    </div>
                  )}
                  <div className="gift-result-actions">
                    <button
                      className="hero-action"
                      onClick={() => {
                        modal.items.forEach(addToCartDirect);
                        setModal("cart");
                      }}
                    >
                      Add gift edit to bag ↗
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        setModal({
                          type: "gift-request",
                          items: modal.items,
                          total: modal.total,
                        })
                      }
                    >
                      Send gifting request ↗
                    </button>
                    <button
                      className="text-link"
                      onClick={() => setModal(null)}
                    >
                      Keep editing
                    </button>
                  </div>
                </div>
              </>
            )}
            {modal === "search" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Search OzaBay</p>
                <h2>
                  Find a <em>piece.</em>
                </h2>
                <div className="search-field">
                  <input
                    className="search-input"
                    type="search"
                    aria-label="Search products"
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && searchResults[0]) {
                        event.preventDefault();
                        setModal({
                          type: "product",
                          product: searchResults[0],
                        });
                      }
                    }}
                    placeholder="Search by product, craft, maker, place…"
                  />
                  {query && (
                    <button
                      type="button"
                      className="search-clear"
                      onClick={() => setQuery("")}
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="search-results" aria-live="polite">
                  {!query.trim() ? (
                    <p className="search-results__message">
                      Search names, crafts, makers, locations, or product
                      details.
                    </p>
                  ) : searchResults.length ? (
                    <>
                      <p className="search-results__count">
                        {searchMatches.length}{" "}
                        {searchMatches.length === 1
                          ? "matching piece"
                          : "matching pieces"}
                        {searchMatches.length > searchResults.length
                          ? ` · showing the best ${searchResults.length}`
                          : ""}
                      </p>
                      {searchResults.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          aria-label={`View ${product.name}, ${product.category}, ${product.price}`}
                          onClick={() => setModal({ type: "product", product })}
                        >
                          <img loading="lazy" decoding="async" src={product.image} alt="" />
                          <span>
                            {product.name}
                            <small>
                              {product.category} · {product.artisan}
                            </small>
                          </span>
                          <strong>{product.price}</strong>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="search-results__message">
                      No matching products yet. Try a shorter name, craft,
                      maker, or location.
                    </p>
                  )}
                </div>
              </>
            )}
            {modal === "account" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                {account ? (
                  <Suspense fallback={<div className="catalog-loading">Loading account…</div>}>
                    <AccountSection
                      account={account}
                      isVendor={account.accountType === "vendor"}
                      vendorProducts={vendorProducts}
                      vendorProductsLoaded={vendorProductsLoaded}
                      favorites={[
                        ...catalogProducts,
                        ...REGIONAL_CRAFT_PRODUCTS,
                      ].filter((p) =>
                        wish.some((id) => String(id) === String(p.id)),
                      )}
                      bag={cart}
                      bagTotal={cartTotal}
                      onSaveProfile={updateProfile}
                      onRequestPasswordChange={requestPasswordChange}
                      onConfirmPasswordChange={confirmPasswordChange}
                      onSaveLocation={saveDeliveryLocation}
                      onRemoveFavorite={(id) =>
                        setWish((current) =>
                          current.filter((item) => String(item) !== String(id)),
                        )
                      }
                      onRemoveBag={remove}
                      onUpdateQuantity={qty}
                      onAddToBag={add}
                      onBuyNow={() => setModal("checkout")}
                      onOpenVendorPanel={() => {
                        setVendorRoute(true);
                        navigate("/vendor");
                        setModal(null);
                      }}
                      onLogout={logout}
                      orders={orders}
                      onCancelOrder={cancelCustomerOrder}
                      onRequestOrderItemReturn={requestOrderItemReturn}
                      onRequestOrderItemCancellation={requestOrderItemCancellation}
                      onRefreshOrders={() => customerOrdersRefreshRef.current?.()}
                      onListSupportMessages={listSupportMessages}
                      onGetSupportUnreadCount={getSupportUnreadCount}
                      onCreateSupportMessage={createSupportMessage}
                      onReplySupportMessage={replySupportMessage}
                    />
                  </Suspense>
                ) : authView === "signin" ? (
                  <Suspense fallback={<div className="catalog-loading">Loading sign in…</div>}>
                    <SignIn
                      onSignIn={signIn}
                      onGoogleSignIn={signUp}
                      onRequestPasswordReset={requestPasswordReset}
                      onResetPassword={resetPassword}
                      onSignUp={() => {
                        setSignupAccountType("user");
                        setAuthView("signup");
                      }}
                    />
                  </Suspense>
                ) : (
                  <Suspense fallback={<div className="catalog-loading">Loading sign up…</div>}>
                    <SignUp
                      key={signupAccountType}
                      onSignUp={signUp}
                      onSignIn={() => setAuthView("signin")}
                      initialAccountType={signupAccountType}
                    />
                  </Suspense>
                )}
              </>
            )}
            {modal === "wishlist" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Saved pieces</p>
                <h2>
                  Your <em>wishlist.</em>
                </h2>
                {wish.length ? (
                  <div className="wishlist-list">
                    {[...catalogProducts, ...REGIONAL_CRAFT_PRODUCTS]
                      .filter((p) =>
                        wish.some((id) => String(id) === String(p.id)),
                      )
                      .map((p, i) => (
                        <article
                          key={p.id}
                          className="wishlist-item"
                          style={{ "--bag-index": i }}
                        >
                          <img loading="lazy" decoding="async" src={p.image} alt={p.name} />
                          <div className="wishlist-item__info">
                            <strong>{p.name}</strong>
                            <span>
                              {p.category} · {money(p.priceValue)}
                            </span>
                          </div>
                          <div className="wishlist-item__actions">
                            <button
                              className="buy-now"
                              onClick={() => {
                                if (add(p)) setModal("checkout");
                              }}
                            >
                              Buy now
                            </button>
                            <button
                              onClick={() => {
                                if (add(p)) setModal("cart");
                              }}
                            >
                              Add to bag
                            </button>
                            <button
                              className="wishlist-item__remove"
                              onClick={() => toggleWish(p)}
                            >
                              Remove
                            </button>
                          </div>
                        </article>
                      ))}
                  </div>
                ) : (
                  <p>
                    Your wishlist is empty. Tap ♡ on any product to save it.
                  </p>
                )}
              </>
            )}
            {modal === "cart" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Your bag</p>
                <h2>
                  {cartCount
                    ? `${cartCount} ${cartCount === 1 ? "piece" : "pieces"}.`
                    : "Your bag is quiet."}
                </h2>
                {cart.length ? (
                  <>
                    <div className="bag-list">
                      {cart.map((p, i) => (
                        <article
                          key={p.id}
                          className={
                            "bag-item" +
                            (leaving.includes(p.id) ? " is-removing" : "")
                          }
                          style={{ "--bag-index": i }}
                        >
                          <img loading="lazy" decoding="async" src={p.image} alt={p.name} />
                          <div className="bag-item__info">
                            <strong>{p.name}</strong>
                            <span>
                              {p.custom ? "Custom · made to order" : "Handmade"}{" "}
                              · {money(p.priceValue)}
                            </span>
                            <button
                              className="bag-item__remove"
                              onClick={() => remove(p.id)}
                            >
                              <span aria-hidden="true">✕</span> Remove
                            </button>
                          </div>
                          <div className="bag-item__end">
                            <div className="qty-control">
                              <button
                                onClick={() => qty(p.id, -1)}
                                aria-label="Decrease quantity"
                              >
                                −
                              </button>
                              <b>{p.qty}</b>
                              <button
                                onClick={() => qty(p.id, 1)}
                                aria-label="Increase quantity"
                              >
                                +
                              </button>
                            </div>
                            <strong className="bag-item__total">
                              {money(p.priceValue * p.qty)}
                            </strong>
                          </div>
                        </article>
                      ))}
                    </div>
                    <div className="bag-summary">
                      <div className="bag-summary__row">
                        <span>
                          Subtotal · {cartCount}{" "}
                          {cartCount === 1 ? "piece" : "pieces"}
                        </span>
                        <strong>{money(cartTotal)}</strong>
                      </div>
                      <p>
                        Every piece is handmade, quality-checked, and packed to
                        travel safely. Shipping is calculated at checkout.
                      </p>
                      <button className="bag-summary__clear" onClick={clearAll}>
                        ✕ Empty your bag
                      </button>
                    </div>
                    <div className="bag-actions">
                      <button
                        className="hero-action"
                        onClick={() => setModal("checkout")}
                      >
                        Proceed to checkout{" "}
                        <span className="bag-actions__arrow">↗</span>
                      </button>
                      <button
                        className="text-link bag-actions__continue"
                        onClick={() => {
                          setModal(null);
                          go("products");
                        }}
                      >
                        Continue shopping{" "}
                        <span className="bag-actions__arrow">↗</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <p>Start with something handmade from the edit.</p>
                )}
                {!cart.length && (
                  <button
                    className="text-link"
                    onClick={() => {
                      setModal(null);
                      go("products");
                    }}
                  >
                    Continue shopping ↗
                  </button>
                )}
              </>
            )}
            {modal === "checkout" && (
              <>
                <button
                  className="modal-close checkout-back-btn"
                  onClick={() => setModal("cart")}
                  aria-label="Back to cart"
                >
                  ←
                </button>
                <div className="checkout-shell">
                  {/* ── LEFT PANEL ─ Order Summary ── */}
                  <div className="checkout-panel checkout-panel--left">
                    <p className="eyebrow">Secure Checkout</p>
                    <h2 className="checkout-heading">
                      Almost <em>there.</em>
                    </h2>

                    {/* Mini cart recap */}
                    <div className="checkout-recap">
                      {cart.map((p) => (
                        <div key={p.id} className="checkout-recap__item">
                          <div className="checkout-recap__img-wrap">
                            <img loading="lazy" decoding="async" src={p.image} alt={p.name} />
                            <span className="checkout-recap__qty">{p.qty}</span>
                          </div>
                          <div className="checkout-recap__info">
                            <strong>{p.name}</strong>
                            <span>
                              {p.custom ? "Custom · made to order" : "Handmade"}
                            </span>
                          </div>
                          <strong className="checkout-recap__price">
                            {money(p.priceValue * p.qty)}
                          </strong>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="checkout-totals">
                      <div className="checkout-totals__row">
                        <span>Subtotal</span>
                        <span>{money(cartTotal)}</span>
                      </div>
                      <div className="checkout-totals__row">
                        <span>Shipping</span>
                        <span className="checkout-totals__free">Free</span>
                      </div>
                      <div className="checkout-totals__row checkout-totals__row--total">
                        <strong>Total</strong>
                        <strong>{money(cartTotal)}</strong>
                      </div>
                    </div>

                    {/* Trust badges */}
                    <div className="checkout-trust">
                      <div className="checkout-trust__badge">
                        <span className="checkout-trust__icon">🔒</span>
                        <span>Secure payment</span>
                      </div>
                      <div className="checkout-trust__badge">
                        <span className="checkout-trust__icon">🚚</span>
                        <span>Free delivery</span>
                      </div>
                      <div className="checkout-trust__badge">
                        <span className="checkout-trust__icon">✦</span>
                        <span>Handcrafted</span>
                      </div>
                    </div>
                  </div>

                  {/* ── RIGHT PANEL ─ Form ── */}
                  <div className="checkout-panel checkout-panel--right">
                    <form className="checkout-form" onSubmit={placeOrder}>
                      <div className="checkout-section">
                        <p className="checkout-section__title">Contact</p>
                        <div className="checkout-fields">
                          <div className="checkout-field">
                            <label htmlFor="co-name">Full name</label>
                            <input
                              id="co-name"
                              required
                              placeholder="Your name"
                              value={checkout.name}
                              onChange={(e) =>
                                setCheckout((v) => ({
                                  ...v,
                                  name: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="checkout-field checkout-field--half">
                            <label htmlFor="co-phone">Phone</label>
                            <input
                              id="co-phone"
                              required
                              placeholder="+91 98765 43210"
                              value={checkout.phone}
                              onChange={(e) =>
                                setCheckout((v) => ({
                                  ...v,
                                  phone: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="checkout-field checkout-field--half">
                            <label htmlFor="co-email">Email</label>
                            <input
                              id="co-email"
                              required
                              type="email"
                              placeholder="you@example.com"
                              value={checkout.email}
                              onChange={(e) =>
                                setCheckout((v) => ({
                                  ...v,
                                  email: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="checkout-section">
                        <p className="checkout-section__title">
                          Delivery address
                        </p>
                        <div className="checkout-fields">
                          <div className="checkout-field">
                            <label htmlFor="co-address">Street address</label>
                            <input
                              id="co-address"
                              required
                              placeholder="House / flat, street, area"
                              value={checkout.address}
                              onChange={(e) =>
                                setCheckout((v) => ({
                                  ...v,
                                  address: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="checkout-field checkout-field--half">
                            <label htmlFor="co-city">City</label>
                            <input
                              id="co-city"
                              required
                              placeholder="Mumbai"
                              value={checkout.city}
                              onChange={(e) =>
                                setCheckout((v) => ({
                                  ...v,
                                  city: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="checkout-field checkout-field--half">
                            <label htmlFor="co-pin">PIN code</label>
                            <input
                              id="co-pin"
                              required
                              pattern="[0-9]{6}"
                              placeholder="400001"
                              value={checkout.pincode}
                              onChange={(e) =>
                                setCheckout((v) => ({
                                  ...v,
                                  pincode: e.target.value,
                                }))
                              }
                            />
                          </div>
                        </div>
                      </div>

                      <div className="checkout-section">
                        <p className="checkout-section__title">
                          Payment method
                        </p>
                        <div className="checkout-payment-opts">
                          {[
                            {
                              value: "Cash on delivery",
                              icon: "💵",
                              label: "Cash on Delivery",
                            },
                            {
                              value: "Razorpay",
                              icon: "🔒",
                              label: "Pay by UPI, card, wallet or netbanking",
                            },
                          ].map((opt) => (
                            <label
                              key={opt.value}
                              className={
                                "checkout-payment-opt" +
                                (checkout.payment === opt.value
                                  ? " is-selected"
                                  : "")
                              }
                            >
                              <input
                                type="radio"
                                name="payment"
                                value={opt.value}
                                checked={checkout.payment === opt.value}
                                onChange={(e) =>
                                  setCheckout((v) => ({
                                    ...v,
                                    payment: e.target.value,
                                  }))
                                }
                              />
                              <span className="checkout-payment-opt__icon">
                                {opt.icon}
                              </span>
                              <span className="checkout-payment-opt__label">
                                {opt.label}
                              </span>
                              <span className="checkout-payment-opt__check">
                                ✓
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {checkoutError && (
                        <p className="checkout-error" role="alert">
                          {checkoutError}
                        </p>
                      )}
                      <button
                        className="checkout-submit"
                        type="submit"
                        disabled={checkoutBusy}
                      >
                        <span>
                          {checkoutBusy
                            ? "Processing…"
                            : checkout.payment === "Razorpay"
                              ? "Pay securely"
                              : "Place order"}
                        </span>
                        <span className="checkout-submit__amount">
                          {money(cartTotal)}
                        </span>
                        <span className="checkout-submit__arrow">↗</span>
                      </button>
                      <p className="checkout-disclaimer">
                        Online payments are processed securely by Razorpay. Cash
                        on delivery is payable to the courier.
                      </p>
                    </form>
                  </div>
                </div>
              </>
            )}
            {placedOrder && modal === "order-success" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Order confirmed</p>
                <h2>
                  Your order is <em>saved.</em>
                </h2>
                <p>
                  Order ID: <strong>{placedOrder.id}</strong>. Your order is
                  saved to your account and shared with the relevant maker.
                </p>
                <div className="custom-order-success">
                  <span>Total</span>
                  <strong>{money(placedOrder.total)}</strong>
                  <span>Current stage</span>
                  <strong>{placedOrder.status}</strong>
                </div>
                <button
                  className="hero-action"
                  onClick={() => {
                    setTracking(placedOrder.id);
                    setModal("tracking");
                  }}
                >
                  Track this order ↗
                </button>
              </>
            )}
            {modal === "tracking" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Order tracking</p>
                <h2>
                  Craft journey <em>in motion.</em>
                </h2>
                <div className="track-code">
                  <span>ORDER ID</span>
                  <strong>{tracking || placedOrder?.id || "OZ-DEMO"}</strong>
                </div>
                <div className="timeline timeline--modal">
                  <div className="timeline-step is-done">
                    <span>01</span>
                    <div>
                      <strong>Order received</strong>
                      <small>Request captured</small>
                    </div>
                  </div>
                  <div className="timeline-step is-current">
                    <span>02</span>
                    <div>
                      <strong>Maker crafting</strong>
                      <small>Handmade work in progress</small>
                    </div>
                  </div>
                  <div className="timeline-step">
                    <span>03</span>
                    <div>
                      <strong>Quality checked</strong>
                      <small>Craft passport attached</small>
                    </div>
                  </div>
                  <div className="timeline-step">
                    <span>04</span>
                    <div>
                      <strong>Dispatched</strong>
                      <small>Courier handoff</small>
                    </div>
                  </div>
                </div>
              </>
            )}
            {modal === "custom-order" && !orderSent && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <div className="custom-request-shell">
                  <div className="custom-request-intro">
                    <p className="eyebrow">Made-to-order studio</p>
                    <h2>
                      Tell us how to make your <em>piece.</em>
                    </h2>
                    <p>
                      First confirm the design you created. Then share the few
                      details our maker needs to turn it into a real product.
                      We’ll review the request before production.
                    </p>
                    <div className="custom-request-steps">
                      <span
                        className={customStep === 1 ? "is-active" : "is-done"}
                      >
                        01 <b>Review design</b>
                      </span>
                      <span className={customStep === 2 ? "is-active" : ""}>
                        02 <b>Your details</b>
                      </span>
                      <span>
                        03 <b>We make it</b>
                      </span>
                    </div>
                    <div className="custom-request-note">
                      <strong>How it works</strong>
                      <span>1. You send the brief</span>
                      <span>2. OzaBay reviews it</span>
                      <span>3. We confirm price & timeline</span>
                      <span>4. Maker creates your piece</span>
                    </div>
                  </div>
                  {customStep === 1 ? (
                    <div className="custom-request-panel">
                      <div className="custom-design-card">
                        <div
                          className="custom-design-card__image"
                          style={{ backgroundImage: `url(${customImage})` }}
                        >
                          <span>YOUR DESIGN</span>
                        </div>
                        <div className="custom-design-card__body">
                          <div>
                            <span>Form</span>
                            <strong>{custom.form}</strong>
                          </div>
                          <div>
                            <span>Material</span>
                            <strong>{custom.material}</strong>
                          </div>
                          <div>
                            <span>Finish</span>
                            <strong>{custom.finish}</strong>
                          </div>
                          <div>
                            <span>Size</span>
                            <strong>{custom.size}</strong>
                          </div>
                          <div>
                            <span>Tone</span>
                            <strong>{custom.tone}</strong>
                          </div>
                          {custom.engraving && (
                            <div>
                              <span>Engraving</span>
                              <strong>{custom.engraving}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="custom-request-price">
                        <span>Estimated starting price</span>
                        <strong>{money(customPrice)}</strong>
                        <small>
                          Final price and production timeline are confirmed
                          after our review.
                        </small>
                      </div>
                      <button
                        className="hero-action custom-request-next"
                        onClick={() => setCustomStep(2)}
                      >
                        Looks good — continue ↗
                      </button>
                      <button
                        className="text-link"
                        onClick={() => {
                          setModal(null);
                          setTimeout(() => go("create"), 50);
                        }}
                      >
                        Edit my design ↗
                      </button>
                    </div>
                  ) : (
                    <form
                      className="order-form custom-request-form"
                      onSubmit={submitCustom}
                    >
                      <div className="custom-form-heading">
                        <span>STEP 02 · YOUR DETAILS</span>
                        <strong>Give the maker a clear brief.</strong>
                        <small>Required fields are marked with *</small>
                      </div>
                      <div className="form-two">
                        <label>
                          Full name *
                          <input
                            required
                            autoComplete="name"
                            value={orderForm.name}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                name: e.target.value,
                              }))
                            }
                            placeholder="Your name"
                          />
                        </label>
                        <label>
                          Email *
                          <input
                            required
                            type="email"
                            autoComplete="email"
                            value={orderForm.email}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                email: e.target.value,
                              }))
                            }
                            placeholder="you@example.com"
                          />
                        </label>
                      </div>
                      <div className="form-two">
                        <label>
                          Phone *
                          <input
                            required
                            autoComplete="tel"
                            value={orderForm.phone}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                phone: e.target.value,
                              }))
                            }
                            placeholder="+91 98765 43210"
                          />
                        </label>
                        <label>
                          Quantity *
                          <input
                            required
                            type="number"
                            min="1"
                            max="50"
                            value={orderForm.quantity}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                quantity: e.target.value,
                              }))
                            }
                          />
                        </label>
                      </div>
                      <div className="form-two">
                        <label>
                          City *
                          <input
                            required
                            autoComplete="address-level2"
                            value={orderForm.city}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                city: e.target.value,
                              }))
                            }
                            placeholder="Jaipur"
                          />
                        </label>
                        <label>
                          Budget range
                          <input
                            value={orderForm.budget}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                budget: e.target.value,
                              }))
                            }
                            placeholder="e.g. ₹5,000–₹8,000"
                          />
                        </label>
                      </div>
                      <div className="form-two">
                        <label>
                          Needed by
                          <input
                            type="date"
                            value={orderForm.neededBy}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                neededBy: e.target.value,
                              }))
                            }
                          />
                        </label>
                        <label>
                          What is it for?
                          <select
                            value={orderForm.purpose}
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                purpose: e.target.value,
                              }))
                            }
                          >
                            <option value="">Choose one</option>
                            <option>Home décor</option>
                            <option>Gift</option>
                            <option>Wedding / event</option>
                            <option>Corporate gifting</option>
                            <option>Other</option>
                          </select>
                        </label>
                      </div>
                      <label>
                        Delivery address *
                        <textarea
                          required
                          value={orderForm.address}
                          onChange={(e) =>
                            setOrderForm((v) => ({
                              ...v,
                              address: e.target.value,
                            }))
                          }
                          placeholder="House / street, area, city, state, pincode"
                        />
                      </label>
                      <label>
                        Anything the maker should know?
                        <textarea
                          value={custom.notes}
                          onChange={(e) =>
                            setCustom((c) => ({ ...c, notes: e.target.value }))
                          }
                          placeholder="Colour preference, proportions, inspiration, special care…"
                        />
                      </label>
                      <div className="custom-request-upload">
                        <div>
                          <span>REFERENCE IMAGE</span>
                          <strong>Optional — show us your inspiration</strong>
                          <small>
                            For now this frontend stores the selected file name
                            with the request.
                          </small>
                        </div>
                        <label className="upload-btn">
                          Choose image
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) =>
                              setOrderForm((v) => ({
                                ...v,
                                referenceName: e.target.files?.[0]?.name || "",
                              }))
                            }
                          />
                        </label>
                        {orderForm.referenceName && (
                          <em>{orderForm.referenceName}</em>
                        )}
                      </div>
                      <label className="approval-row">
                        <input
                          type="checkbox"
                          required
                          checked={orderForm.approval === "Yes"}
                          onChange={(e) =>
                            setOrderForm((v) => ({
                              ...v,
                              approval: e.target.checked ? "Yes" : "",
                            }))
                          }
                        />
                        <span>
                          I understand this is a made-to-order request. OzaBay
                          will confirm the final design, price and timeline
                          before production.
                        </span>
                      </label>
                      <div className="custom-request-submit">
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => setCustomStep(1)}
                        >
                          ← Back to design
                        </button>
                        <button className="hero-action">
                          Send my custom request ↗
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}
            {modal === "custom-order" && orderSent && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Request received</p>
                <h2>
                  Your design is <em>saved.</em>
                </h2>
                <p>
                  Request ID: <strong>{requestId}</strong>. This browser has
                  stored the design reference.
                </p>
                <div className="custom-order-success">
                  <span>Design</span>
                  <strong>
                    {custom.form} · {custom.material} · {custom.finish}
                  </strong>
                  <span>Estimated price</span>
                  <strong>{money(customPrice)}</strong>
                </div>
                <button className="hero-action" onClick={() => setModal(null)}>
                  Back to studio ↗
                </button>
              </>
            )}
            {modal === "sell" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Maker studio</p>
                <h2>
                  Bring your craft <em>to OzaBay.</em>
                </h2>
                <form
                  className="order-form seller-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setModal("seller-success");
                  }}
                >
                  <label>
                    Maker / studio name
                    <input required placeholder="Your studio" />
                  </label>
                  <label>
                    Craft category
                    <select>
                      <option>Ceramics</option>
                      <option>Textiles</option>
                      <option>Metalcraft</option>
                      <option>Woodcraft</option>
                      <option>Terracotta</option>
                    </select>
                  </label>
                  <label>
                    City
                    <input required placeholder="Jaipur" />
                  </label>
                  <label>
                    Short craft story
                    <textarea
                      required
                      placeholder="Tell customers what makes your work special…"
                    />
                  </label>
                  <button className="hero-action">
                    Submit maker profile ↗
                  </button>
                </form>
              </>
            )}
            {modal === "seller-success" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Maker profile received</p>
                <h2>
                  Your studio is <em>ready for review.</em>
                </h2>
                <p>
                  This is the frontend seller-onboarding state. The production
                  workflow can connect verification, inventory and order
                  management later.
                </p>
                <button className="hero-action" onClick={() => setModal(null)}>
                  Back to OzaBay ↗
                </button>
              </>
            )}
            {modal?.type === "gift-request" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <div className="gift-request-shell">
                  <div>
                    <p className="eyebrow">OzaBay gifting team</p>
                    <h2>
                      Turn the edit into a <em>gift brief.</em>
                    </h2>
                    <p>
                      Send us the selected pieces, recipient context and your
                      message. The frontend stores the request locally until the
                      gifting backend is connected.
                    </p>
                    <div className="gift-request-summary">
                      <span>
                        {gift.occasion} · {gift.recipient}
                      </span>
                      <strong>
                        {gift.style} · {gift.budget}
                      </strong>
                      <small>
                        {gift.wrapping ? "Gift wrapping requested · " : ""}
                        {gift.message
                          ? "Personalised message added"
                          : "No gift message"}
                      </small>
                    </div>
                  </div>
                  <form
                    className="order-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const id = `OZ-G${Date.now().toString().slice(-7)}`;
                      localStorage.setItem(
                        "ozabay-gift-request",
                        JSON.stringify({
                          requestId: id,
                          createdAt: new Date().toISOString(),
                          gift,
                          items: modal?.items || [],
                          total: modal?.total || 0,
                          customer: {
                            name: e.target.name.value,
                            email: e.target.email.value,
                            phone: e.target.phone.value,
                            city: e.target.city.value,
                            neededBy: e.target.neededBy.value,
                          },
                        }),
                      );
                      setRequestId(id);
                      setModal({ type: "gift-success", total: modal.total });
                    }}
                  >
                    <label>
                      Full name *
                      <input name="name" required placeholder="Your name" />
                    </label>
                    <label>
                      Email *
                      <input
                        name="email"
                        required
                        type="email"
                        placeholder="you@example.com"
                      />
                    </label>
                    <div className="form-two">
                      <label>
                        Phone *
                        <input
                          name="phone"
                          required
                          placeholder="+91 98765 43210"
                        />
                      </label>
                      <label>
                        City *
                        <input name="city" required placeholder="Jaipur" />
                      </label>
                    </div>
                    <label>
                      Needed by
                      <input name="neededBy" type="date" />
                    </label>
                    <label>
                      Anything the gifting team should know?
                      <textarea
                        name="notes"
                        placeholder="Recipient preferences, delivery timing, branding or special instructions…"
                      />
                    </label>
                    <button className="hero-action">
                      Send gifting request ↗
                    </button>
                  </form>
                </div>
              </>
            )}
            {modal?.type === "gift-success" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Gifting request received</p>
                <h2>
                  Your gift brief is <em>with us.</em>
                </h2>
                <p>
                  Request ID: <strong>{requestId}</strong>. We’ll review the
                  edit and confirm the final availability, price and delivery
                  timeline before fulfilment.
                </p>
                <div className="custom-order-success">
                  <span>Gift edit</span>
                  <strong>
                    {gift.occasion} · {gift.style} · {gift.recipient}
                  </strong>
                  <span>Estimated value</span>
                  <strong>
                    {modal?.total ? money(modal.total) : gift.budget}
                  </strong>
                  <span>Next step</span>
                  <strong>OzaBay gifting team review</strong>
                </div>
                <button className="hero-action" onClick={() => setModal(null)}>
                  Back to OzaBay ↗
                </button>
              </>
            )}
            {modal === "corporate" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Corporate & hospitality</p>
                <h2>
                  Thoughtful <em>gifting.</em>
                </h2>
                <form
                  className="order-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setModal("corporate-success");
                  }}
                >
                  <label>
                    Company
                    <input required placeholder="Studio / company" />
                  </label>
                  <label>
                    Quantity
                    <input required type="number" min="10" placeholder="50" />
                  </label>
                  <label>
                    Budget
                    <input required placeholder="₹2,50,000" />
                  </label>
                  <label>
                    Brief
                    <textarea
                      required
                      placeholder="Event, gifting theme, custom branding…"
                    />
                  </label>
                  <button className="hero-action">
                    Request a curated quote ↗
                  </button>
                </form>
              </>
            )}
            {modal === "corporate-success" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Corporate brief saved</p>
                <h2>
                  We'll turn the brief into a <em>craft edit.</em>
                </h2>
                <p>
                  The frontend is ready for quote requests, gifting sets and
                  hospitality collections.
                </p>
                <button className="hero-action" onClick={() => setModal(null)}>
                  Close ↗
                </button>
              </>
            )}
            {modal === "support" && (
              <SupportModal
                onClose={() => setModal(null)}
                onGoToOrders={
                  account
                    ? () => {
                        setModal("account");
                      }
                    : null
                }
              />
            )}
            {modal === "about" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">About OzaBay</p>
                <h2>
                  Made by people.
                  <br />
                  <em>Kept by you.</em>
                </h2>
                <p>
                  OzaBay is a digital atelier for Indian craft—bringing
                  contemporary homes closer to the people who make the objects
                  inside them. The current experience is frontend-first and
                  intentionally ready for a future backend.
                </p>
                <button className="hero-action" onClick={() => setModal(null)}>
                  Close ↗
                </button>
              </>
            )}
            {modal === "thanks" && (
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Thank you</p>
                <h2>
                  You're <em>in.</em>
                </h2>
                <p>
                  Your newsletter signup is saved as a demo action in this
                  browser.
                </p>
                <button className="hero-action" onClick={() => setModal(null)}>
                  Back to OzaBay ↗
                </button>
              </>
            )}
          </div>
        </div>
      )}
      {reviewProduct && modal !== "account" && (
        <Suspense fallback={null}>
          <ReviewForm
            product={reviewProduct}
            account={account}
            loginRequired={reviewLoginRequired}
            onRequireSignIn={requireReviewSignIn}
            onSubmit={submitProductReview}
            onClose={() => setReviewProduct(null)}
          />
        </Suspense>
      )}
    </>
  );
}
