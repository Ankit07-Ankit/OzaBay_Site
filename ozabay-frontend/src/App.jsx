import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "./components/Navbar/Navbar.jsx";
import Hero from "./components/Hero/Hero.jsx";
import Reveal from "./components/shared/Reveal.jsx";
import TiltCard from "./components/shared/TiltCard.jsx";
import BuilderGroup from "./components/custom/BuilderGroup.jsx";
import CustomLivePreview from "./components/custom/CustomLivePreview.jsx";
import CustomDesignUpload from "./components/custom/CustomDesignUpload.jsx";
import GiftBuilder from "./components/custom/GiftBuilder.jsx";
import StateCraftMarketplace from "./components/regional/StateCraftMarketplace.jsx";
import RegionalCrafts from "./components/regional/RegionalCrafts.jsx";
import CuratedEdits from "./components/marketing/CuratedEdits.jsx";
import TrustStrip from "./components/marketing/TrustStrip.jsx";
import CraftFilm from "./components/marketing/CraftFilm.jsx";
import MakerStories from "./components/marketing/MakerStories.jsx";
import Product3DViewer from "./components/product/Product3DViewer.jsx";
import ProductDetail from "./components/product/ProductDetail.jsx";
import ReviewForm from "./components/product/ReviewForm.jsx";
import SignIn from "./components/auth/SignIn.jsx";
import SignUp from "./components/auth/SignUp.jsx";
import AccountSection from "./components/account/AccountSection.jsx";
import VendorDashboard from "./components/vendor/VendorDashboard.jsx";
import { IMG } from "./data/assets.js";
import { PRODUCTS } from "./data/products.js";
import { INDIA_CRAFTS } from "./data/regionalCrafts.js";
import { REGIONAL_CRAFT_PRODUCTS } from "./data/regionalCraftProducts.js";
import { ARTISANS, COLLECTIONS, CUSTOM_PRICES } from "./data/siteContent.js";
import { money } from "./utils/formatCurrency.js";
import "./index.css";
import "./premium-upgrades.css";

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
    const products = JSON.parse(
      localStorage.getItem(storageKey) || "[]",
    );
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
            localStorage.getItem(
              savedProductsStorageKey(type, account._id),
            ) || "[]",
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
    const result = await requestAuthenticatedApi(
      `/me/products?type=${type}`,
    );
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

const getProductSearchScore = (product, query) => {
  const normalizedQuery = normalizeSearchText(query);
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
  const [registeredProducts, setRegisteredProducts] = useState([]);
  const [registeredProductsLoaded, setRegisteredProductsLoaded] = useState(false);
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
  const [tracking, setTracking] = useState("");
  const [reviewProduct, setReviewProduct] = useState(null);
  const [reviewLoginRequired, setReviewLoginRequired] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [craftRoute, setCraftRoute] = useState(() => {
    const m = window.location.pathname.match(/^\/crafts\/([^/]+)/);
    return m ? m[1] : null;
  });
  const [vendorRoute, setVendorRoute] = useState(
    () => window.location.pathname === "/vendor",
  );
  const [gift, setGift] = useState({
    occasion: "Housewarming",
    recipient: "Parents",
    budget: "₹5,000",
    style: "Earthy",
    wrapping: true,
    message: "Wishing you a beautiful new beginning.",
  });
  const perPage = 12;
  const categories = [
    "All",
    ...COLLECTIONS.map((c) => c.filter),
    "Bangles",
    "Blades",
    "Pendants",
  ];
  const catalogProducts = useMemo(() => {
    const items = [];
    for (
      let index = 0;
      index < Math.max(PRODUCTS.length, registeredProducts.length);
      index++
    ) {
      if (PRODUCTS[index]) items.push(PRODUCTS[index]);
      if (registeredProducts[index]) items.push(registeredProducts[index]);
    }
    return items;
  }, [registeredProducts]);
  const searchMatches = useMemo(
    () =>
      catalogProducts
        .map((product, index) => ({
          product,
          index,
          score: getProductSearchScore(product, query),
        }))
        .filter((result) => result.score !== null)
        .sort(
          (first, second) =>
            second.score - first.score || first.index - second.index,
        )
        .map(({ product }) => product),
    [catalogProducts, query],
  );
  const searchResults = searchMatches.slice(0, 12);
  const shown = useMemo(() => {
    let list = catalogProducts.filter(
      (p) =>
        (filter === "All" || p.category === filter) &&
        (!priceBand ||
          ((priceBand.min == null || p.priceValue >= priceBand.min) &&
            (priceBand.max == null || p.priceValue < priceBand.max))) &&
        getProductSearchScore(p, query) !== null,
    );
    if (sort === "price-low") list.sort((a, b) => a.priceValue - b.priceValue);
    if (sort === "price-high") list.sort((a, b) => b.priceValue - a.priceValue);
    if (sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [catalogProducts, filter, query, sort, priceBand]);
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
    const slug = stateSlug(state);
    const path = `/crafts/${slug}${craft ? `?craft=${encodeURIComponent(craft)}` : ""}`;
    window.history.pushState({ craftRoute: slug }, "", path);
    setCraftRoute(slug);
    setModal(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const backToAtlas = () => {
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
  useEffect(() => {
    const onPop = () => {
      const m = window.location.pathname.match(/^\/crafts\/([^/]+)/);
      setCraftRoute(m ? m[1] : null);
      setVendorRoute(window.location.pathname === "/vendor");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // Pendent images may be saved as .png, .jpg or .jpeg — if one fails to load, try the next.
  useEffect(() => {
    const exts = [".png", ".jpg", ".jpeg"];
    const onErr = (e) => {
      const t = e.target;
      if (!t || t.tagName !== "IMG") return;
      const src = t.getAttribute("src") || "";
      if (!src.includes("/images/pendents/")) return;
      const m = src.match(/\.(png|jpe?g)$/i);
      if (!m) return;
      const i = exts.indexOf("." + m[1].toLowerCase());
      if (i < 0 || i >= exts.length - 1) return;
      t.src = src.slice(0, -m[0].length) + exts[i + 1];
    };
    window.addEventListener("error", onErr, true);
    return () => window.removeEventListener("error", onErr, true);
  }, []);
  useEffect(() => {
    setPage(1);
  }, [filter, query, sort, priceBand]);
  useEffect(() => {
    if (!account?._id) {
      if (syncedAccountRef.current !== null) return;
      localStorage.removeItem("ozabay-cart");
      localStorage.removeItem("ozabay-wishlist");
      localStorage.setItem(guestSavedProductsStorageKey("cart"), JSON.stringify(cart));
      return;
    }
    if (
      !savedProductsLoadedRef.current ||
      syncedAccountRef.current !== account._id
    ) return;
    localStorage.setItem(
      savedProductsStorageKey("cart", account._id),
      JSON.stringify(cart),
    );
  }, [account?._id, cart]);
  useEffect(() => {
    if (!account?._id) {
      if (syncedAccountRef.current !== null) return;
      localStorage.setItem(guestSavedProductsStorageKey("favorites"), JSON.stringify(wish));
      return;
    }
    if (
      !savedProductsLoadedRef.current ||
      syncedAccountRef.current !== account._id
    ) return;
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
      setCart((current) =>
        mergeSavedProducts(current, serverCart.products),
      );
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
    fetch("/api/products")
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
              image: product.images[0],
              images: product.images,
              video: product.video,
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
          `/api/products/reviews/summary?productIds=${encodeURIComponent(productIds)}`,
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
    const update = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrollProgress(max > 0 ? (window.scrollY / max) * 100 : 0);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
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
  const placeOrder = (e) => {
    e.preventDefault();
    if (!cart.length) return;
    const id = `OZ-${Date.now().toString().slice(-7)}`;
    const order = {
      id,
      createdAt: new Date().toISOString(),
      items: cart,
      total: cartTotal,
      customer: checkout,
      status: "Crafting",
    };
    const nextOrders = [order, ...orders];
    const key = account?._id
      ? `ozabay-orders-${account._id}`
      : "ozabay-guest-orders";
    localStorage.setItem(key, JSON.stringify(nextOrders));
    localStorage.setItem("ozabay-last-order", JSON.stringify(order));
    setOrders(nextOrders);
    setPlacedOrder(order);
    setCart([]);
    setModal("order-success");
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
    setModal(null);
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
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(credentials),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(result.message || "Unable to sign in. Please try again.");
    finishAuthentication({ ...result.user, accessToken: result.accessToken });
  };
  const requestPasswordReset = async (email) => {
    const response = await fetch("/api/auth/forgot-password", {
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
    const response = await fetch("/api/auth/reset-password", {
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
        const response = await fetch("/api/auth/refresh-token", {
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
          throw new Error(
            result.message || "Your session has expired. Please sign in again.",
          );
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
    try {
      const result = await requestVendorApi("/products");
      setVendorProducts(Array.isArray(result.products) ? result.products : []);
    } catch (error) {
      console.error("Unable to load vendor products:", error);
    } finally {
      setVendorProductsLoaded(true);
    }
  };

  const requestVendorApi = async (path, options = {}) => {
    let token = accessToken || sessionStorage.getItem("ozabay-access-token");
    if (!token) token = await refreshAccessToken();
    const send = (authToken) =>
      fetch(`/api/vendor${path}`, {
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
      fetch(`/api${path}`, {
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
    if (!response.ok)
      throw new Error(result.message || "Unable to complete this request.");
    return result;
  };
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
  const updateProfile = async (changes) => {
    let token = accessToken || sessionStorage.getItem("ozabay-access-token");
    if (!token) token = await refreshAccessToken();
    const send = (authToken) =>
      fetch("/api/auth/profile", {
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
  const saveDeliveryLocation = async (deliveryLocations, activeLocationIndex) => {
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
        ? [deliveryLocation.building, deliveryLocation.area].filter(Boolean).join(", ")
        : "",
      city: deliveryLocation?.city || current.city,
      pincode: deliveryLocation?.pincode || current.pincode,
    }));
  };
  const logout = async () => {
    const response = await fetch("/api/auth/logout", {
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
    setVendorRoute(false);
    setAuthView("signin");
    setModal(null);
    navigate("/", { replace: true });
  };
  const openAccount = () => setModal("account");
  const openNav = (id) => {
    const map = {
      shop: "products",
      collections: "collections",
      artisans: "artisans",
      "create-your-own": "create",
      journal: "journal",
      about: "story",
    };
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
        className="scroll-progress"
        style={{ transform: `scaleX(${scrollProgress / 100})` }}
        aria-hidden="true"
      />
      <div className="page-vignette" aria-hidden="true" />
      <Navbar
        activeId={vendorRoute ? "sell" : "shop"}
        cartCount={cartCount}
        isVendor={account?.accountType === "vendor"}
        onSearchClick={() => setModal("search")}
        onAccountClick={openAccount}
        onCartClick={() => setModal("cart")}
        onNavClick={openNav}
      />
      <main id="home">
        {vendorRoute ? (
          account?.accountType === "vendor" ? (
            <VendorDashboard account={account} request={requestVendorApi} />
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
                    {PRODUCTS.filter((p) => recentlyViewed.includes(p.id)).map(
                      (p) => (
                        <button
                          key={p.id}
                          onClick={() =>
                            setModal({ type: "product", product: p })
                          }
                        >
                          <img src={p.image} alt={p.name} />
                          <span>{p.category}</span>
                          <strong>{p.name}</strong>
                          <small>{p.price}</small>
                        </button>
                      ),
                    )}
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
                      {PRODUCTS.length + registeredProducts.length} pieces
                      across the marketplace. Explore maker listings alongside
                      OzaBay edits, with product stories, 3D views and
                      state-wise craft collections.
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
                            <img src={product.image} alt={product.name} />
                            <span className="product-badge">
                              {product.vendorProduct
                                ? "Maker listing"
                                : index < 3 && page === 1
                                  ? "OzaBay Edit"
                                  : product.category}
                            </span>
                            <button
                              type="button"
                              className={`wishlist-btn ${wish.some((id) => String(id) === String(product.id)) ? "is-liked" : ""}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                toggleWish(product);
                              }}
                              aria-label={wish.some((id) => String(id) === String(product.id)) ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
                              aria-pressed={wish.some((id) => String(id) === String(product.id))}
                            >
                              {wish.some((id) => String(id) === String(product.id)) ? "♥" : "♡"}
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
                ) : (
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
                          <img src={a.image} alt={a.name} />
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
                        <img src={image} alt="" />
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
                    <video
                      className="create-video"
                      src="/videos/OZABAY.mp4"
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
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
        <div className="oz-container footer-grid">
          <div>
            <span>OzaBay</span>
            <p>
              Indian craft, contemporary living.
              <br />
              Frontend marketplace experience.
            </p>
          </div>
          <div>
            <span>Explore</span>
            {account?.accountType !== "vendor" && (
              <>
                <button onClick={() => go("products")}>Shop</button>
                <button onClick={() => go("collections")}>Collections</button>
                <button onClick={() => go("artisans")}>Artisans</button>
                <button onClick={() => go("create")}>Create Your Own</button>
              </>
            )}
          </div>
          <div>
            <span>OzaBay</span>
            <button onClick={() => setModal("about")}>About</button>
            <button onClick={() => setModal("corporate")}>Corporate</button>
            <button onClick={() => openNav("sell")}>Sell on OzaBay</button>
            <button onClick={() => setModal("support")}>Support</button>
          </div>
          <div>
            <span>Your space</span>
            <button onClick={openAccount}>Account</button>
            {account?.accountType !== "vendor" && (
              <>
                <button onClick={() => setModal("wishlist")}>
                  Wishlist ({wish.length})
                </button>
                <button onClick={() => setModal("cart")}>Bag ({cartCount})</button>
                <button onClick={() => setModal("tracking")}>Track order</button>
              </>
            )}
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
              <Product3DViewer
                product={modal.product}
                onClose={() => setModal(null)}
                onAdd={(p) => {
                  if (add(p)) setModal("cart");
                }}
                onSpace={(p) => setModal({ type: "space", product: p })}
              />
            )}
            {modal?.type === "product" && (
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
                          <img
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
                            <img src={image} alt="" />
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
                    <img src={modal.artisan.image} alt={modal.artisan.name} />
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
                        <img src={p.image} alt={p.name} />
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
                          <img src={product.image} alt="" />
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
                <button
                  className="modal-close"
                  onClick={() => setModal(null)}
                >
                  ×
                </button>
                {account ? (
                  <AccountSection
                    account={account}
                    isVendor={account.accountType === "vendor"}
                    vendorProducts={vendorProducts}
                    vendorProductsLoaded={vendorProductsLoaded}
                    favorites={[...catalogProducts, ...REGIONAL_CRAFT_PRODUCTS].filter(
                      (p) => wish.some((id) => String(id) === String(p.id)),
                    )}
                    bag={cart}
                    bagTotal={cartTotal}
                    onSaveProfile={updateProfile}
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
                  />
                ) : authView === "signin" ? (
                  <SignIn
                    onSignIn={signIn}
                    onRequestPasswordReset={requestPasswordReset}
                    onResetPassword={resetPassword}
                    onSignUp={() => {
                      setSignupAccountType("user");
                      setAuthView("signup");
                    }}
                  />
                ) : (
                  <>
                    <SignUp
                      key={signupAccountType}
                      onSignUp={signUp}
                      onSignIn={() => setAuthView("signin")}
                      initialAccountType={signupAccountType}
                    />
                  </>
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
                        <img src={p.image} alt={p.name} />
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
                          <img src={p.image} alt={p.name} />
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
                  className="modal-close"
                  onClick={() => setModal("cart")}
                >
                  ×
                </button>
                <div className="checkout-grid">
                  <div>
                    <p className="eyebrow">Checkout</p>
                    <h2>
                      Make it <em>yours.</em>
                    </h2>
                    <p>
                      Frontend checkout is ready for testing. Payment remains
                      simulated until the backend/payment layer is connected.
                    </p>
                    <div className="order-summary">
                      <span>{cartCount} pieces</span>
                      <strong>{money(cartTotal)}</strong>
                    </div>
                  </div>
                  <form className="order-form" onSubmit={placeOrder}>
                    <label>
                      Name
                      <input
                        required
                        value={checkout.name}
                        onChange={(e) =>
                          setCheckout((v) => ({ ...v, name: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Phone
                      <input
                        required
                        value={checkout.phone}
                        onChange={(e) =>
                          setCheckout((v) => ({ ...v, phone: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Email
                      <input
                        required
                        type="email"
                        value={checkout.email}
                        onChange={(e) =>
                          setCheckout((v) => ({ ...v, email: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      Address
                      <input
                        required
                        value={checkout.address}
                        onChange={(e) =>
                          setCheckout((v) => ({
                            ...v,
                            address: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className="form-two">
                      <label>
                        City
                        <input
                          required
                          value={checkout.city}
                          onChange={(e) =>
                            setCheckout((v) => ({ ...v, city: e.target.value }))
                          }
                        />
                      </label>
                      <label>
                        PIN
                        <input
                          required
                          pattern="[0-9]{6}"
                          value={checkout.pincode}
                          onChange={(e) =>
                            setCheckout((v) => ({
                              ...v,
                              pincode: e.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                    <label>
                      Payment
                      <select
                        value={checkout.payment}
                        onChange={(e) =>
                          setCheckout((v) => ({
                            ...v,
                            payment: e.target.value,
                          }))
                        }
                      >
                        <option>Cash on delivery</option>
                        <option>UPI (demo)</option>
                        <option>Card (demo)</option>
                      </select>
                    </label>
                    <button className="hero-action">
                      Place demo order · {money(cartTotal)} ↗
                    </button>
                  </form>
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
                  Order ID: <strong>{placedOrder.id}</strong>. This browser
                  stores the demo order so the tracking UI can be tested.
                </p>
                <div className="custom-order-success">
                  <span>Total</span>
                  <strong>{money(placedOrder.total)}</strong>
                  <span>Current stage</span>
                  <strong>Crafting with the maker</strong>
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
              <>
                <button className="modal-close" onClick={() => setModal(null)}>
                  ×
                </button>
                <p className="eyebrow">Support</p>
                <h2>
                  How can we <em>help?</em>
                </h2>
                <div className="faq-list">
                  <button>
                    How does handmade variation work? <span>+</span>
                  </button>
                  <button>
                    Can I request a custom piece? <span>+</span>
                  </button>
                  <button>
                    Where can I track an order? <span>+</span>
                  </button>
                  <button>
                    How do maker profiles work? <span>+</span>
                  </button>
                </div>
              </>
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
        <ReviewForm
          product={reviewProduct}
          account={account}
          loginRequired={reviewLoginRequired}
          onRequireSignIn={requireReviewSignIn}
          onSubmit={submitProductReview}
          onClose={() => setReviewProduct(null)}
        />
      )}
    </>
  );
}
