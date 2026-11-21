import { useEffect, useMemo, useRef, useState } from "react";
import { apiUrl } from "../../utils/api.js";
import "./VendorDashboard.css";

const emptyProduct = {
  name: "",
  description: "",
  category: "",
  price: "",
  discountPercent: "0",
  offer: "",
};

const emptyLocation = {
  name: "",
  type: "Workshop & Studio",
  categories: [],
  address: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  timing: "Mon – Sat: 10:00 AM – 7:30 PM",
  mapLink: "",
  isPrimary: false,
};

const SUGGESTED_CATEGORIES = [
  "Ceramics",
  "Blue Pottery",
  "Terracotta",
  "Textiles",
  "Woodcraft",
  "Metalcraft",
  "Home Décor",
  "Jewellery",
];

const LOCATION_TYPES = [
  "Workshop & Studio",
  "Flagship Retail Outlet",
  "Studio Gallery",
  "Artisan Cooperative",
  "Factory Outlet",
  "Craft Village Atelier",
  "Exhibition Space",
];

const VENDOR_FULFILLMENT_STATUSES = [
  "Received",
  "Crafting",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

const formatPrice = (price) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);

const formatUploadDate = (date) =>
  Number.isNaN(new Date(date).getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date));

const formatPaymentLabel = (value) =>
  value ? value.replaceAll("_", " ") : "";

export default function VendorDashboard({ account, request }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyProduct);
  const [editingProduct, setEditingProduct] = useState(null);
  const [newImages, setNewImages] = useState([]);
  const [retainedImages, setRetainedImages] = useState([]);
  const [newVideo, setNewVideo] = useState(null);
  const [retainedVideo, setRetainedVideo] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [ordersError, setOrdersError] = useState("");
  const [ordersNotice, setOrdersNotice] = useState("");
  const [orderActionId, setOrderActionId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState("All");
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewReply, setReviewReply] = useState({});
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportLoading, setSupportLoading] = useState(true);
  const [supportCategory, setSupportCategory] = useState("Vendor");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportText, setSupportText] = useState("");
  const [supportReply, setSupportReply] = useState({});

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

  /* ── Locations Management State ── */
  const [locations, setLocations] = useState(() => {
    try {
      const cached = localStorage.getItem(`ozabay-vendor-locs-${account?._id || "default"}`);
      if (cached) return JSON.parse(cached);
      return account?.shopLocations || [];
    } catch {
      return account?.shopLocations || [];
    }
  });
  const [locationForm, setLocationForm] = useState(emptyLocation);
  const [editingLocation, setEditingLocation] = useState(null);
  const [showLocationForm, setShowLocationForm] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [locationNotice, setLocationNotice] = useState("");
  const [customCategoryInput, setCustomCategoryInput] = useState("");

  const previewUrls = useRef(new Set());

  const loadProducts = async () => {
    setLoading(true);
    setProductsError("");
    try {
      const result = await request("/products");
      if (!Array.isArray(result.products)) {
        throw new Error("The product list response was invalid. Please try again.");
      }
      setProducts(result.products.filter((product) => product && product._id));
    } catch (requestError) {
      setProductsError(requestError.message || "Unable to load your registered products.");
    } finally {
      setLoading(false);
    }
  };

  const loadOrders = async () => {
    setOrdersLoading(true);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request("/orders");
      setOrders(Array.isArray(result.orders) ? result.orders : []);
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to load orders.");
    } finally {
      setOrdersLoading(false);
    }
  };

  const loadReviews = async () => {
    setReviewsLoading(true);
    try {
      const result = await request("/reviews");
      setReviews(result.reviews || []);
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to load product reviews.");
    } finally {
      setReviewsLoading(false);
    }
  };

  const loadSupportMessages = async () => {
    setSupportLoading(true);
    try {
      const result = await request("/support");
      setSupportTickets(result.tickets || []);
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to load support messages.");
    } finally {
      setSupportLoading(false);
    }
  };

  const submitSupportMessage = async (event) => {
    event.preventDefault();
    setOrderActionId("support-create");
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request("/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: supportCategory,
          subject: supportSubject,
          message: supportText,
        }),
      });
      setSupportTickets((current) => [result.ticket, ...current]);
      setSupportSubject("");
      setSupportText("");
      setOrdersNotice("Message sent to OzaBay admin support.");
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to send support message.");
    } finally {
      setOrderActionId("");
    }
  };

  const submitSupportReply = async (ticket) => {
    const message = (supportReply[ticket._id] || "").trim();
    if (!message) return;
    setOrderActionId(`support:${ticket._id}`);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request(`/support/${ticket._id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      setSupportTickets((current) =>
        current.map((item) => item._id === ticket._id ? result.ticket : item),
      );
      setSupportReply((current) => ({ ...current, [ticket._id]: "" }));
      setOrdersNotice("Reply sent to OzaBay admin.");
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to send support reply.");
    } finally {
      setOrderActionId("");
    }
  };

  const replyToReview = async (review) => {
    const message = (reviewReply[review._id] || "").trim();
    if (!message) return;
    setOrderActionId(`review:${review._id}`);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request(`/reviews/${review._id}/replies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      setReviews((current) =>
        current.map((item) => item._id === review._id ? { ...item, ...result.review } : item),
      );
      setReviewReply((current) => ({ ...current, [review._id]: "" }));
      setOrdersNotice("Reply sent to the customer.");
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to send review reply.");
    } finally {
      setOrderActionId("");
    }
  };

  const updateOrderItemStatus = async (orderId, productId, status) => {
    const actionId = `${orderId}:${productId}`;
    setOrderActionId(actionId);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request(
        `/orders/${orderId}/items/${productId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (result?.order?._id) {
        setOrders((current) =>
          current.map((order) =>
            order._id === result.order._id ? result.order : order,
          ),
        );
      } else {
        await loadOrders();
      }
      setOrdersNotice(
        `Product marked as ${status}. The customer will see the updated status in their orders.`,
      );
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to update product status.");
    } finally {
      setOrderActionId("");
    }
  };

  const recordCashOnDelivery = async (orderId, productId) => {
    const actionId = `${orderId}:${productId}`;
    setOrderActionId(actionId);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request(
        `/orders/${orderId}/items/${productId}/cash-on-delivery`,
        { method: "PATCH" },
      );
      if (result?.order?._id) {
        setOrders((current) =>
          current.map((order) =>
            order._id === result.order._id ? result.order : order,
          ),
        );
      } else {
        await loadOrders();
      }
      setOrdersNotice(result.message || "COD payment recorded.");
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to record COD payment.");
    } finally {
      setOrderActionId("");
    }
  };

  const reviewReturnRequest = async (orderId, productId, status) => {
    const actionId = `${orderId}:${productId}`;
    setOrderActionId(actionId);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request(
        `/orders/${orderId}/items/${productId}/return`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (result?.order?._id) {
        setOrders((current) =>
          current.map((order) =>
            order._id === result.order._id ? result.order : order,
          ),
        );
      } else {
        await loadOrders();
      }
      setOrdersNotice(`Return request ${status}.`);
    } catch (requestError) {
      setOrdersError(requestError.message || "Unable to review this return request.");
    } finally {
      setOrderActionId("");
    }
  };

  const reviewItemCancellation = async (orderId, productId, status) => {
    const actionId = `${orderId}:${productId}`;
    setOrderActionId(actionId);
    setOrdersError("");
    setOrdersNotice("");
    try {
      const result = await request(
        `/orders/${orderId}/items/${productId}/cancel-request`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        },
      );
      if (result?.order?._id) {
        setOrders((current) =>
          current.map((order) =>
            order._id === result.order._id ? result.order : order,
          ),
        );
      } else {
        await loadOrders();
      }
      setOrdersNotice(result.message || `Cancellation request ${status}.`);
    } catch (requestError) {
      setOrdersError(
        requestError.message || "Unable to review this cancellation request.",
      );
    } finally {
      setOrderActionId("");
    }
  };

  const loadLocations = async () => {
    try {
      const result = await request("/locations");
      if (Array.isArray(result.locations)) {
        setLocations(result.locations);
        localStorage.setItem(
          `ozabay-vendor-locs-${account?._id || "default"}`,
          JSON.stringify(result.locations),
        );
      }
    } catch (err) {
      console.warn("Could not fetch locations from server:", err.message);
    }
  };

  useEffect(() => {
    loadProducts();
    loadLocations();
    loadOrders();
    loadReviews();
    loadSupportMessages();
  }, []);

  useEffect(() => () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  }, []);

  const createPreview = (file) => {
    const preview = URL.createObjectURL(file);
    previewUrls.current.add(preview);
    return Object.assign(file, { preview });
  };

  const revokePreview = (file) => {
    if (!file?.preview) return;
    URL.revokeObjectURL(file.preview);
    previewUrls.current.delete(file.preview);
  };

  const resetForm = () => {
    newImages.forEach(revokePreview);
    if (newVideo?.preview) revokePreview(newVideo);
    setForm(emptyProduct);
    setEditingProduct(null);
    setNewImages([]);
    setRetainedImages([]);
    setNewVideo(null);
    setRetainedVideo(null);
  };

  const startEditing = (product) => {
    newImages.forEach(revokePreview);
    if (newVideo?.preview) revokePreview(newVideo);
    setEditingProduct(product);
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      price: String(product.price),
      discountPercent: String(product.discountPercent || 0),
      offer: product.offer || "",
    });
    setRetainedImages(product.images || []);
    setRetainedVideo(product.video || null);
    setNewImages([]);
    setNewVideo(null);
    setError("");
    setNotice("");
    document.getElementById("vendor-product-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const chooseImages = (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";
    if (selectedFiles.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setError("Choose JPEG, PNG, or WebP images.");
      return;
    }
    if (selectedFiles.some((file) => file.size > 50 * 1024 * 1024)) {
      setError("Each product image must be 50 MB or smaller.");
      return;
    }
    const wouldExceedImageLimit =
      selectedFiles.length + newImages.length + retainedImages.length > 5;
    const canReplaceExistingImages =
      editingProduct
      && retainedImages.length > 0
      && selectedFiles.length + newImages.length <= 5;
    if (wouldExceedImageLimit && !canReplaceExistingImages) {
      setError("A product can have up to five images. Remove images or choose fewer files.");
      return;
    }
    if (wouldExceedImageLimit && canReplaceExistingImages) {
      setRetainedImages([]);
    }
    setError("");
    setNewImages((current) => [...current, ...selectedFiles.map(createPreview)]);
  };

  const chooseVideo = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!["video/mp4", "video/webm"].includes(file.type)) {
      setError("Choose MP4 or WebM video.");
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError("Video must be 50 MB or smaller.");
      return;
    }
    setError("");
    setNewVideo(createPreview(file));
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setError("");
    setNotice("");
    if (retainedImages.length + newImages.length === 0) {
      setError("Add at least one product image before registering this product.");
      return;
    }
    if (retainedImages.length + newImages.length > 5) {
      setError("A product can have up to five images.");
      return;
    }
    setSaving(true);
    setNotice("Uploading product media...");
    const pendingUploadIds = [];
    let productSaved = false;
    try {
      const uploadFile = async (file, field) => {
        const upload = await request("/products/media-uploads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            field,
            originalName: file.name,
            contentType: file.type,
            size: file.size,
          }),
        });
        pendingUploadIds.push(upload.uploadId);
        const chunkSize = Number(upload.chunkSize);
        if (!Number.isInteger(chunkSize) || chunkSize < 1) {
          throw new Error("The server returned an invalid media upload configuration.");
        }

        for (let start = 0, index = 0; start < file.size; start += chunkSize, index += 1) {
          await request(
            `/products/media-uploads/${upload.uploadId}/chunks/${index}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/octet-stream" },
              body: file.slice(start, Math.min(start + chunkSize, file.size)),
            },
          );
        }

        const completed = await request(
          `/products/media-uploads/${upload.uploadId}/complete`,
          { method: "POST" },
        );
        if (typeof completed.mediaPath !== "string") {
          throw new Error("The server did not return the saved product media.");
        }
        return completed.mediaPath;
      };

      const uploadedImages = [];
      for (const image of newImages) {
        uploadedImages.push(await uploadFile(image, "images"));
      }
      const uploadedVideo = newVideo ? await uploadFile(newVideo, "video") : "";
      const payload = editingProduct
        ? {
            ...form,
            retainedImages,
            retainedVideo: retainedVideo || "",
            uploadedImages,
            uploadedVideo,
          }
        : {
            ...form,
            images: uploadedImages,
            video: uploadedVideo,
          };
      const result = await request(
        editingProduct ? `/products/${editingProduct._id}` : "/products",
        {
          method: editingProduct ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      productSaved = true;
      setProducts((current) =>
        editingProduct
          ? current.map((product) => (product._id === result.product._id ? result.product : product))
          : [result.product, ...current],
      );
      setProductsError("");
      setNotice(editingProduct ? "Product successfully updated!" : "Product registered and live on marketplace!");
      resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      if (!productSaved) {
        for (const uploadId of pendingUploadIds) {
          try {
            await request(`/products/media-uploads/${uploadId}`, { method: "DELETE" });
          } catch (cleanupError) {
            console.error("Unable to clean up an incomplete product media upload:", cleanupError);
          }
        }
      }
      setSaving(false);
    }
  };

  const removeProduct = async (product) => {
    if (!window.confirm(`Delete "${product.name}"? This cannot be undone.`)) return;
    setError("");
    setNotice("");
    try {
      await request(`/products/${product._id}`, { method: "DELETE" });
      setProducts((current) => current.filter((item) => item._id !== product._id));
      if (editingProduct?._id === product._id) resetForm();
      setNotice("Product deleted from your catalogue.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  /* ── Location Handlers ── */
  const openNewLocationForm = () => {
    setLocationForm(emptyLocation);
    setEditingLocation(null);
    setLocationError("");
    setLocationNotice("");
    setShowLocationForm(true);
    document.getElementById("location-form-box")?.scrollIntoView({ behavior: "smooth" });
  };

  const startEditingLocation = (loc) => {
    setEditingLocation(loc);
    setLocationForm({
      name: loc.name || "",
      type: loc.type || "Workshop & Studio",
      categories: Array.isArray(loc.categories) ? [...loc.categories] : [],
      address: loc.address || "",
      city: loc.city || "",
      state: loc.state || "",
      pincode: loc.pincode || "",
      phone: loc.phone || "",
      timing: loc.timing || "",
      mapLink: loc.mapLink || "",
      isPrimary: Boolean(loc.isPrimary),
    });
    setLocationError("");
    setLocationNotice("");
    setShowLocationForm(true);
    document.getElementById("location-form-box")?.scrollIntoView({ behavior: "smooth" });
  };

  const toggleLocationCategory = (cat) => {
    setLocationForm((prev) => {
      const exists = prev.categories.includes(cat);
      return {
        ...prev,
        categories: exists
          ? prev.categories.filter((c) => c !== cat)
          : [...prev.categories, cat],
      };
    });
  };

  const addCustomLocationCategory = (e) => {
    e.preventDefault();
    const cat = customCategoryInput.trim();
    if (!cat) return;
    if (!locationForm.categories.includes(cat)) {
      setLocationForm((prev) => ({
        ...prev,
        categories: [...prev.categories, cat],
      }));
    }
    setCustomCategoryInput("");
  };

  const saveLocation = async (e) => {
    e.preventDefault();
    setLocationError("");
    setLocationNotice("");
    if (!locationForm.name.trim()) {
      setLocationError("Location name is required.");
      return;
    }
    if (locationForm.categories.length === 0) {
      setLocationError("Please select or add at least one product category available at this location.");
      return;
    }
    setLocationSaving(true);
    try {
      let updatedList = [];
      const locId = editingLocation?._id || editingLocation?.id;
      if (editingLocation && locId) {
        const result = await request(`/locations/${locId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locationForm),
        }).catch(() => null);

        if (result && Array.isArray(result.locations)) {
          updatedList = result.locations;
        } else {
          updatedList = locations.map((loc) => {
            const currentId = loc._id || loc.id;
            if (currentId === locId) {
              return { ...loc, ...locationForm, updatedAt: new Date().toISOString() };
            }
            return locationForm.isPrimary ? { ...loc, isPrimary: false } : loc;
          });
        }
        setLocationNotice(`Shop location "${locationForm.name}" updated successfully!`);
      } else {
        const result = await request("/locations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(locationForm),
        }).catch(() => null);

        if (result && Array.isArray(result.locations)) {
          updatedList = result.locations;
        } else {
          const newLoc = {
            ...locationForm,
            _id: `loc-${Date.now()}`,
            id: `loc-${Date.now()}`,
            createdAt: new Date().toISOString(),
          };
          updatedList = locationForm.isPrimary
            ? [newLoc, ...locations.map((l) => ({ ...l, isPrimary: false }))]
            : [...locations, newLoc];
        }
        setLocationNotice(`Shop location "${locationForm.name}" added to your studio profile!`);
      }

      setLocations(updatedList);
      localStorage.setItem(
        `ozabay-vendor-locs-${account?._id || "default"}`,
        JSON.stringify(updatedList),
      );
      setLocationForm(emptyLocation);
      setEditingLocation(null);
      setShowLocationForm(false);
    } catch (err) {
      setLocationError(err.message || "Failed to save shop location.");
    } finally {
      setLocationSaving(false);
    }
  };

  const removeLocation = async (loc) => {
    const locId = loc._id || loc.id;
    if (!window.confirm(`Delete shop location "${loc.name}"?`)) return;
    try {
      await request(`/locations/${locId}`, { method: "DELETE" }).catch(() => null);
      const nextList = locations.filter((l) => (l._id || l.id) !== locId);
      setLocations(nextList);
      localStorage.setItem(
        `ozabay-vendor-locs-${account?._id || "default"}`,
        JSON.stringify(nextList),
      );
      setLocationNotice(`Location "${loc.name}" removed.`);
    } catch (err) {
      setLocationError(err.message || "Unable to remove location");
    }
  };

  /* Calculated Metrics */
  const metrics = useMemo(() => {
    const totalPieces = products.length;
    const categoriesSet = new Set(products.map((p) => p.category?.trim()).filter(Boolean));
    const totalValuation = products.reduce((sum, p) => {
      const price = Number(p.price) || 0;
      const discountPercent = Number(p.discountPercent) || 0;
      const discounted = price * (1 - discountPercent / 100);
      return sum + discounted;
    }, 0);
    const activeOffers = products.filter((p) => (p.discountPercent && p.discountPercent > 0) || p.offer).length;

    return {
      totalPieces,
      totalCategories: categoriesSet.size,
      totalValuation,
      activeOffers,
      totalLocations: locations.length,
    };
  }, [products, locations]);

  /* Filtered Products */
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        String(p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(p.category || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat =
        selectedCategoryFilter === "All" || p.category === selectedCategoryFilter;
      return matchesSearch && matchesCat;
    });
  }, [products, searchQuery, selectedCategoryFilter]);

  /* Unique categories from existing listings */
  const vendorCategories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set)];
  }, [products]);

  /* Live Pricing calculation for the form */
  const calculatedFormPrice = useMemo(() => {
    const price = parseFloat(form.price) || 0;
    const disc = parseFloat(form.discountPercent) || 0;
    const finalPrice = Math.max(0, price * (1 - disc / 100));
    const savings = Math.max(0, price - finalPrice);
    return { finalPrice, savings };
  }, [form.price, form.discountPercent]);

  return (
    <section className="vendor-dashboard" id="vendor-dashboard">
      {/* ── Top Hero Banner ── */}
      <header className="vendor-dashboard__header">
        <div className="vendor-dashboard__header-text">
          <div className="vendor-dashboard__badge">
            <span className="vendor-dashboard__badge-dot" />
            ✦ Maker Studio · Verified Artisan Partner
          </div>
          <h1>
            Welcome back, <em>{account.name}</em>
          </h1>
          <p className="vendor-dashboard__intro">
            Publish your handcrafted pieces to the marketplace, manage workshop locations & retail outlets,
            and keep category inventories synchronized.
          </p>
        </div>

        <div className="vendor-dashboard__header-actions">
          <button
            type="button"
            className="v-action-btn v-action-btn--primary"
            onClick={() => {
              resetForm();
              document.getElementById("vendor-product-form")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            + Register New Piece
          </button>
          <button
            type="button"
            className="v-action-btn v-action-btn--ghost"
            onClick={() => {
              openNewLocationForm();
              document.getElementById("vendor-locations")?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            + Add Shop Location
          </button>
        </div>
      </header>

      {/* ── KPI Metric Cards ── */}
      <div className="vendor-kpi-grid">
        <div className="vendor-kpi-card">
          <div className="vendor-kpi-card__icon">🏺</div>
          <div className="vendor-kpi-card__content">
            <span className="vendor-kpi-card__label">Active Pieces</span>
            <strong className="vendor-kpi-card__value">{metrics.totalPieces}</strong>
            <small>Live in catalogue</small>
          </div>
        </div>

        <div className="vendor-kpi-card">
          <div className="vendor-kpi-card__icon">🏷️</div>
          <div className="vendor-kpi-card__content">
            <span className="vendor-kpi-card__label">Craft Categories</span>
            <strong className="vendor-kpi-card__value">{metrics.totalCategories}</strong>
            <small>Distinct collections</small>
          </div>
        </div>

        <div className="vendor-kpi-card">
          <div className="vendor-kpi-card__icon">📍</div>
          <div className="vendor-kpi-card__content">
            <span className="vendor-kpi-card__label">Shop Locations</span>
            <strong className="vendor-kpi-card__value">{metrics.totalLocations}</strong>
            <small>Studios & retail outlets</small>
          </div>
        </div>

        <div className="vendor-kpi-card">
          <div className="vendor-kpi-card__icon">💎</div>
          <div className="vendor-kpi-card__content">
            <span className="vendor-kpi-card__label">Catalogue Value</span>
            <strong className="vendor-kpi-card__value">{formatPrice(metrics.totalValuation)}</strong>
            <small>Total inventory valuation</small>
          </div>
        </div>

        <div className="vendor-kpi-card">
          <div className="vendor-kpi-card__icon">✨</div>
          <div className="vendor-kpi-card__content">
            <span className="vendor-kpi-card__label">Active Offers</span>
            <strong className="vendor-kpi-card__value">{metrics.activeOffers}</strong>
            <small>With discount or launch tags</small>
          </div>
        </div>
      </div>

      {/* ── Main Two-Column Studio Layout ── */}
      <div className="vendor-dashboard__layout">

        {/* ── LEFT: Product Registration / Edit Studio ── */}
        <form
          id="vendor-product-form"
          className="vendor-product-form"
          onSubmit={saveProduct}
        >
          <div className="vendor-form-header">
            <p className="eyebrow">{editingProduct ? "Studio Editor" : "Create Listing"}</p>
            <h2>{editingProduct ? "Update your masterpiece." : "Register a new creation."}</h2>
            <p className="vendor-form-header__desc">
              Fill in craft specifications and upload studio photography.
            </p>
          </div>

          {error && (
            <div className="vendor-alert vendor-alert--error" role="alert">
              <span>⚠️</span> {error}
            </div>
          )}
          {notice && (
            <div className="vendor-alert vendor-alert--success" role="status">
              <span>✓</span> {notice}
            </div>
          )}

          {/* Section: Essentials */}
          <div className="vendor-form-section">
            <span className="vendor-form-section__tag">01. Craft Details</span>

            <label className="v-label">
              <span>Piece Title *</span>
              <input
                required
                minLength={2}
                maxLength={100}
                placeholder="e.g. Hand-Thrown Indigo Terracotta Vase"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <label className="v-label">
              <span>Craft Category *</span>
              <input
                required
                minLength={2}
                maxLength={60}
                placeholder="e.g. Ceramics, Textiles, Metalcraft..."
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
              <div className="v-chips-row">
                <small className="v-chips-row__label">Suggested:</small>
                {SUGGESTED_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`v-chip ${form.category === cat ? "is-active" : ""}`}
                    onClick={() => setForm({ ...form, category: cat })}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </label>

            <label className="v-label">
              <span>Artisan Description & Story *</span>
              <textarea
                required
                minLength={10}
                maxLength={2000}
                rows={4}
                placeholder="Describe materials, firing/weaving technique, dimensions, and the artisan story behind this piece..."
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </label>
          </div>

          {/* Section: Pricing & Offers */}
          <div className="vendor-form-section">
            <span className="vendor-form-section__tag">02. Pricing & Promotion</span>

            <div className="vendor-product-form__row">
              <label className="v-label">
                <span>Base Price (INR ₹) *</span>
                <input
                  required
                  type="number"
                  min="0.01"
                  max="100000000"
                  step="0.01"
                  placeholder="3500"
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                />
              </label>

              <label className="v-label">
                <span>Discount (%)</span>
                <input
                  type="number"
                  min="0"
                  max="90"
                  step="1"
                  value={form.discountPercent}
                  onChange={(event) => setForm({ ...form, discountPercent: event.target.value })}
                />
              </label>
            </div>

            {/* Live price calculation pill */}
            {parseFloat(form.price) > 0 && (
              <div className="v-pricing-preview">
                <div className="v-pricing-preview__left">
                  <span>Customer pays</span>
                  <strong>{formatPrice(calculatedFormPrice.finalPrice)}</strong>
                </div>
                {calculatedFormPrice.savings > 0 && (
                  <div className="v-pricing-preview__badge">
                    You save customer {formatPrice(calculatedFormPrice.savings)} ({form.discountPercent}% OFF)
                  </div>
                )}
              </div>
            )}

            <label className="v-label">
              <span>Promotional Offer Tag (Optional)</span>
              <input
                maxLength="100"
                placeholder="e.g. Festive Edition · Only 5 Crafted · Fired Earth"
                value={form.offer}
                onChange={(event) => setForm({ ...form, offer: event.target.value })}
              />
            </label>
          </div>

          {/* Section: Visual Media */}
          <div className="vendor-form-section">
            <span className="vendor-form-section__tag">03. Studio Photography & Video</span>

            <input
              ref={imageInputRef}
              className="v-file-input-hidden"
              type="file"
              name="images"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={saving}
              aria-hidden="true"
              tabIndex={-1}
              onChange={chooseImages}
            />
            <button
              type="button"
              className="v-file-dropzone"
              disabled={saving}
              aria-label="Choose product images"
              onClick={() => imageInputRef.current?.click()}
            >
              <span className="v-file-dropzone__icon">📷</span>
              <strong>Click to upload product images</strong>
              <small>JPEG, PNG, WebP · Max 5 images · Up to 50 MB each</small>
            </button>

            <p className="vendor-product-form__hint">
              {retainedImages.length + newImages.length} of 5 images selected.
            </p>
            {editingProduct && retainedImages.length > 0 && (
              <button
                type="button"
                className="v-card-action-btn v-card-action-btn--edit"
                disabled={saving}
                onClick={() => setRetainedImages([])}
              >
                Replace current images
              </button>
            )}

            {/* Existing images preview */}
            {editingProduct && retainedImages.length > 0 && (
              <div className="vendor-media-preview">
                {retainedImages.map((image, idx) => (
                  <div key={image} className="v-preview-item">
                    <img src={apiUrl(image)} alt="Current product" />
                    {idx === 0 && <span className="v-preview-cover-tag">Cover</span>}
                    <button
                      type="button"
                      aria-label="Remove image"
                      onClick={() => setRetainedImages((current) => current.filter((item) => item !== image))}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* New images preview */}
            {newImages.length > 0 && (
              <div className="vendor-media-preview">
                {newImages.map((image) => (
                  <div key={image.preview} className="v-preview-item">
                    <img src={image.preview} alt={`Selected ${image.name}`} />
                    <button
                      type="button"
                      aria-label={`Remove ${image.name}`}
                      onClick={() => {
                        revokePreview(image);
                        setNewImages((current) => current.filter((item) => item !== image));
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              ref={videoInputRef}
              className="v-file-input-hidden"
              type="file"
              name="video"
              accept="video/mp4,video/webm"
              disabled={saving || Boolean(newVideo || retainedVideo)}
              aria-hidden="true"
              tabIndex={-1}
              onChange={chooseVideo}
            />
            <button
              type="button"
              className="v-file-dropzone v-file-dropzone--video"
              disabled={saving || Boolean(newVideo || retainedVideo)}
              aria-label="Choose a product video"
              onClick={() => videoInputRef.current?.click()}
            >
              <span className="v-file-dropzone__icon">🎬</span>
              <strong>Add Craft Process Video (Optional)</strong>
              <small>MP4, WebM · 1 process clip · Up to 50 MB</small>
            </button>

            {/* Video preview */}
            {(retainedVideo || newVideo) && (
              <div className="v-video-preview">
                <video
                  src={newVideo ? newVideo.preview : apiUrl(retainedVideo)}
                  controls
                  preload="metadata"
                />
                <button
                  type="button"
                  className="v-video-remove-btn"
                  onClick={() => {
                    if (newVideo) {
                      revokePreview(newVideo);
                      setNewVideo(null);
                    } else {
                      setRetainedVideo(null);
                    }
                  }}
                >
                  Remove video ✕
                </button>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="vendor-product-form__actions">
            <button className="v-action-btn v-action-btn--primary v-action-btn--large" type="submit" disabled={saving}>
              {saving ? "Saving Piece…" : editingProduct ? "Save Piece Changes ↗" : "Publish to Marketplace ↗"}
            </button>
            {editingProduct && (
              <button className="v-action-btn v-action-btn--ghost" type="button" onClick={resetForm}>
                Cancel Editing
              </button>
            )}
          </div>
        </form>

        {/* ── RIGHT: Product Catalogue & Management ── */}
        <section className="vendor-product-list" id="vendor-product-list">
          <div className="vendor-product-list__heading">
            <div>
              <p className="eyebrow">Your catalogue</p>
              <h2>Registered products</h2>
              <p className="vendor-product-list__intro">Manage product details, pricing and photos shown in your marketplace listings.</p>
            </div>
            <div className="vendor-product-list__heading-actions">
              <span className="v-count-pill">{products.length} {products.length === 1 ? "product" : "products"}</span>
              <button
                type="button"
                className="vendor-products-refresh"
                onClick={loadProducts}
                disabled={loading}
              >
                {loading ? "Refreshing…" : "↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Filter and Search Bar */}
          <div className="vendor-list-toolbar">
            <div className="v-search-box">
              <span aria-hidden="true">⌕</span>
              <input
                type="search"
                aria-label="Search registered products"
                placeholder="Search by product name or category"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery("")}>
                  ×
                </button>
              )}
            </div>

            <div className="v-category-chips">
              {vendorCategories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  className={`v-cat-chip ${selectedCategoryFilter === cat ? "is-active" : ""}`}
                  onClick={() => setSelectedCategoryFilter(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
            {!loading && !productsError && (
              <p className="vendor-products-result-count" aria-live="polite">
                Showing <strong>{filteredProducts.length}</strong> of <strong>{products.length}</strong> products
              </p>
            )}
          </div>

          {productsError ? (
            <div className="vendor-products-error" role="alert">
              <span className="vendor-products-error__icon" aria-hidden="true">!</span>
              <div>
                <strong>We couldn’t load your products</strong>
                <p>{productsError}</p>
                <button type="button" className="vendor-products-refresh" onClick={loadProducts} disabled={loading}>
                  Try again
                </button>
              </div>
            </div>
          ) : loading ? (
            <div className="vendor-loading-state">
              <div className="catalog-loading__spinner" />
              <strong>Loading your products</strong>
              <p>This may take a moment while we connect to the marketplace.</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="vendor-empty-card">
              <span className="vendor-empty-card__icon" aria-hidden="true">◇</span>
              <h3>{products.length === 0 ? "Your catalogue is ready" : "No matching products"}</h3>
              <p>
                {products.length === 0
                  ? "You haven’t registered a product yet. Use the product form to add your first listing."
                  : "Try another search or category, or clear the filters to see all your products."}
              </p>
              {products.length > 0 && (
                <button
                  type="button"
                  className="v-action-btn v-action-btn--ghost"
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedCategoryFilter("All");
                  }}
                >
                  Clear search and filters
                </button>
              )}
            </div>
          ) : (
            <div className="vendor-product-list__items">
              {filteredProducts.map((product) => {
                const productImages = Array.isArray(product.images) ? product.images.filter(Boolean) : [];
                const price = Number(product.price) || 0;
                const discountPercent = Number(product.discountPercent) || 0;
                const discountedPrice = price * (1 - discountPercent / 100);
                return (
                  <article className="vendor-product-card" key={product._id}>
                    <div className="vendor-product-card__media">
                      <div className="vendor-product-card__image-placeholder" aria-hidden="true">◇</div>
                      {productImages[0] && (
                        <img
                          src={apiUrl(productImages[0])}
                          alt={product.name || "Product"}
                          loading="lazy"
                          onError={(event) => { event.currentTarget.hidden = true; }}
                        />
                      )}
                      {discountPercent > 0 && (
                        <span className="v-badge-discount">{discountPercent}% OFF</span>
                      )}
                      {product.video && <span className="v-badge-video" title="Includes process video">🎬 Video</span>}
                    </div>

                    <div className="vendor-product-card__details">
                      <div className="vendor-product-card__top">
                        <span className="v-card-category">{product.category || "Uncategorized"}</span>
                        <time className="vendor-product-card__uploaded" dateTime={product.createdAt}>
                          {formatUploadDate(product.createdAt)}
                        </time>
                      </div>

                      <h3>{product.name || "Untitled product"}</h3>
                      <p className="v-card-desc">{product.description || "No product description has been added."}</p>

                      <div className="vendor-product-card__price-row">
                        <div className="vendor-product-card__price">
                          <strong>{formatPrice(discountedPrice)}</strong>
                          {discountPercent > 0 && <del>{formatPrice(price)}</del>}
                        </div>
                        {product.offer && <span className="v-offer-pill">Offer · {product.offer}</span>}
                      </div>

                      {productImages.length > 1 && (
                        <div className="vendor-product-card__gallery">
                          {productImages.slice(1).map((image, index) => (
                            <img
                              key={image}
                              src={apiUrl(image)}
                              alt={`${product.name || "Product"} photo ${index + 2}`}
                              loading="lazy"
                              onError={(event) => { event.currentTarget.hidden = true; }}
                            />
                          ))}
                          <span>{productImages.length} photos</span>
                        </div>
                      )}

                      <div className="vendor-product-card__actions">
                        <button
                          type="button"
                          className="v-card-action-btn v-card-action-btn--edit"
                          onClick={() => startEditing(product)}
                        >
                          Edit product
                        </button>
                        <button
                          type="button"
                          className="v-card-action-btn v-card-action-btn--delete"
                          onClick={() => removeProduct(product)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── VENDOR SHOP LOCATIONS SECTION ── */}
      <section className="vendor-locations-section" id="vendor-locations">
        <div className="vendor-locations-header">
          <div>
            <p className="eyebrow">Artisan Footprint</p>
            <h2>Studio & Shop Locations</h2>
            <p className="vendor-locations-header__desc">
              Add multiple workshops, ateliers, and retail outlets where customers can experience your craft collections in person.
            </p>
          </div>
          <button
            type="button"
            className="v-action-btn v-action-btn--primary"
            onClick={openNewLocationForm}
          >
            + Add New Location
          </button>
        </div>

        {locationError && (
          <div className="vendor-alert vendor-alert--error" role="alert">
            <span>⚠️</span> {locationError}
          </div>
        )}
        {locationNotice && (
          <div className="vendor-alert vendor-alert--success" role="status">
            <span>✓</span> {locationNotice}
          </div>
        )}

        {/* ── Location Form (Shown when Adding or Editing) ── */}
        {showLocationForm && (
          <div className="vendor-location-form-box" id="location-form-box">
            <div className="vendor-form-header">
              <p className="eyebrow">{editingLocation ? "Edit Location" : "New Workshop / Outlet"}</p>
              <h3>{editingLocation ? "Update shop location details" : "Register a physical location"}</h3>
              <p className="vendor-form-header__desc">
                Specify available product categories, address, and visiting hours for this location.
              </p>
            </div>

            <form onSubmit={saveLocation} className="v-location-form">
              <div className="v-location-form-grid">
                <label className="v-label">
                  <span>Shop / Studio Name *</span>
                  <input
                    required
                    placeholder="e.g. Amber Fort Heritage Studio & Workshop"
                    value={locationForm.name}
                    onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>Location Type</span>
                  <select
                    className="v-select"
                    value={locationForm.type}
                    onChange={(e) => setLocationForm({ ...locationForm, type: e.target.value })}
                  >
                    {LOCATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Categories available at this location */}
                <div className="v-label v-label--full">
                  <span>Product Categories Available at this Location *</span>
                  <div className="v-loc-cat-picker">
                    {SUGGESTED_CATEGORIES.map((cat) => {
                      const isSelected = locationForm.categories.includes(cat);
                      return (
                        <button
                          key={cat}
                          type="button"
                          className={`v-loc-cat-btn ${isSelected ? "is-selected" : ""}`}
                          onClick={() => toggleLocationCategory(cat)}
                        >
                          <span>{isSelected ? "✓" : "+"}</span>
                          {cat}
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom category input */}
                  <div className="v-custom-cat-row">
                    <input
                      type="text"
                      placeholder="Add another craft category..."
                      value={customCategoryInput}
                      onChange={(e) => setCustomCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") addCustomLocationCategory(e);
                      }}
                    />
                    <button
                      type="button"
                      className="v-action-btn v-action-btn--ghost"
                      onClick={addCustomLocationCategory}
                    >
                      + Add
                    </button>
                  </div>

                  {/* Active selected categories summary */}
                  {locationForm.categories.length > 0 && (
                    <div className="v-selected-cats-list">
                      <small>Selected Categories:</small>
                      {locationForm.categories.map((c) => (
                        <span key={c} className="v-selected-cat-tag">
                          {c}
                          <button
                            type="button"
                            aria-label={`Remove ${c}`}
                            onClick={() => toggleLocationCategory(c)}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <label className="v-label v-label--full">
                  <span>Street Address & Area *</span>
                  <input
                    required
                    placeholder="e.g. 14, Craftsmen Lane, Near Hawa Mahal Bazar"
                    value={locationForm.address}
                    onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>City *</span>
                  <input
                    required
                    placeholder="e.g. Jaipur"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>State</span>
                  <input
                    placeholder="e.g. Rajasthan"
                    value={locationForm.state}
                    onChange={(e) => setLocationForm({ ...locationForm, state: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>PIN Code</span>
                  <input
                    placeholder="302002"
                    value={locationForm.pincode}
                    onChange={(e) => setLocationForm({ ...locationForm, pincode: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>Contact Phone / WhatsApp</span>
                  <input
                    placeholder="+91 98290 12345"
                    value={locationForm.phone}
                    onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>Visiting Hours / Timings</span>
                  <input
                    placeholder="e.g. Mon – Sat: 10:00 AM – 7:30 PM"
                    value={locationForm.timing}
                    onChange={(e) => setLocationForm({ ...locationForm, timing: e.target.value })}
                  />
                </label>

                <label className="v-label">
                  <span>Google Maps Link (Optional)</span>
                  <input
                    placeholder="https://maps.google.com/?q=..."
                    value={locationForm.mapLink}
                    onChange={(e) => setLocationForm({ ...locationForm, mapLink: e.target.value })}
                  />
                </label>

                <div className="v-primary-check-row v-label--full">
                  <label className="v-checkbox-label">
                    <input
                      type="checkbox"
                      checked={locationForm.isPrimary}
                      onChange={(e) => setLocationForm({ ...locationForm, isPrimary: e.target.checked })}
                    />
                    <span>Mark as Primary Studio / Head Atelier</span>
                  </label>
                </div>
              </div>

              <div className="v-location-actions">
                <button
                  type="submit"
                  className="v-action-btn v-action-btn--primary"
                  disabled={locationSaving}
                >
                  {locationSaving ? "Saving..." : editingLocation ? "Update Location ↗" : "Save Shop Location ↗"}
                </button>
                <button
                  type="button"
                  className="v-action-btn v-action-btn--ghost"
                  onClick={() => setShowLocationForm(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Locations Cards Grid ── */}
        {locations.length === 0 ? (
          <div className="vendor-empty-card">
            <span className="vendor-empty-card__icon">📍</span>
            <h3>No physical shop locations added</h3>
            <p>
              Add your workshop, atelier, or retail outlets so customers can discover which product categories
              are crafted and displayed at your locations.
            </p>
            <button
              type="button"
              className="v-action-btn v-action-btn--primary"
              onClick={openNewLocationForm}
            >
              + Add First Shop Location
            </button>
          </div>
        ) : (
          <div className="vendor-locations-grid">
            {locations.map((loc, idx) => (
              <article key={loc._id || loc.id || idx} className="vendor-location-card">
                <div className="v-loc-card-header">
                  <div className="v-loc-type-tag">
                    {loc.type || "Studio / Workshop"}
                    {loc.isPrimary && <span className="v-primary-star">★ Primary Atelier</span>}
                  </div>
                  <div className="v-loc-card-actions">
                    <button
                      type="button"
                      aria-label="Edit location"
                      onClick={() => startEditingLocation(loc)}
                      className="v-icon-text-btn"
                    >
                      ✎ Edit
                    </button>
                    <button
                      type="button"
                      aria-label="Delete location"
                      onClick={() => removeLocation(loc)}
                      className="v-icon-text-btn v-icon-text-btn--delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <h3 className="v-loc-title">{loc.name}</h3>

                <div className="v-loc-address">
                  <span className="v-loc-icon">📍</span>
                  <p>
                    {loc.address}
                    {loc.city ? `, ${loc.city}` : ""}
                    {loc.state ? `, ${loc.state}` : ""}
                    {loc.pincode ? ` – ${loc.pincode}` : ""}
                  </p>
                </div>

                {/* Categories available here */}
                {Array.isArray(loc.categories) && loc.categories.length > 0 && (
                  <div className="v-loc-categories-wrap">
                    <small className="v-loc-cat-title">Craft Categories Available:</small>
                    <div className="v-loc-pills">
                      {loc.categories.map((c) => (
                        <span key={c} className="v-loc-cat-pill">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="v-loc-meta-grid">
                  {loc.phone && (
                    <div className="v-loc-meta-item">
                      <span className="v-loc-icon">📞</span>
                      <span>{loc.phone}</span>
                    </div>
                  )}
                  {loc.timing && (
                    <div className="v-loc-meta-item">
                      <span className="v-loc-icon">🕒</span>
                      <span>{loc.timing}</span>
                    </div>
                  )}
                </div>

                {loc.mapLink && (
                  <a
                    href={loc.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="v-loc-map-btn"
                  >
                    Open on Google Maps ↗
                  </a>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Vendor Support & Admin Contact ── */}
      <section className="vendor-support-section" id="vendor-support">
        <div className="vendor-orders-header">
          <div>
            <p className="eyebrow">Maker Concierge</p>
            <h2>Vendor Support & Admin Help</h2>
          </div>
          <button
            type="button"
            className="v-action-btn v-action-btn--ghost"
            onClick={loadSupportMessages}
            disabled={supportLoading}
          >
            {supportLoading ? "Refreshing…" : "Refresh messages"}
          </button>
        </div>

        <div className="vendor-support-direct">
          <a href="mailto:ankush@infinitivecloud.com">
            <span>✉</span><div><strong>Email OzaBay</strong><small>ankush@infinitivecloud.com</small></div>
          </a>
          <a href="tel:+918690393087">
            <span>📞</span><div><strong>Call support</strong><small>+91 8690393087</small></div>
          </a>
          <a href="https://wa.me/918690393087?text=Hi%20OzaBay%2C%20I%20need%20vendor%20support." target="_blank" rel="noopener noreferrer">
            <span>💬</span><div><strong>WhatsApp vendor desk</strong><small>Chat with OzaBay support</small></div>
          </a>
        </div>

        <form className="vendor-support-form" onSubmit={submitSupportMessage}>
          <label>
            <span>Topic</span>
            <select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value)}>
              <option value="Vendor">Vendor help</option>
              <option value="Support">Support</option>
              <option value="Feedback">Feedback</option>
              <option value="Order">Order issue</option>
              <option value="Return">Return issue</option>
              <option value="Review">Review issue</option>
            </select>
          </label>
          <label>
            <span>Subject</span>
            <input value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} minLength={3} maxLength={120} required placeholder="How can the admin help?" />
          </label>
          <label>
            <span>Message</span>
            <textarea value={supportText} onChange={(event) => setSupportText(event.target.value)} minLength={5} maxLength={2000} rows={4} required placeholder="Describe the issue or share feedback…" />
          </label>
          <button type="submit" className="v-action-btn v-action-btn--primary" disabled={orderActionId === "support-create"}>
            {orderActionId === "support-create" ? "Sending…" : "Send message to admin"}
          </button>
        </form>

        <div className="vendor-support-list">
          {supportLoading ? (
            <p className="vendor-orders-message">Loading your support conversations…</p>
          ) : supportTickets.map((ticket) => (
            <article className="vendor-support-card" key={ticket._id}>
              <div className="vendor-support-card-head">
                <div><strong>{ticket.subject}</strong><small>{ticket.category} · {ticket.status}</small></div>
                <time>{new Date(ticket.createdAt).toLocaleDateString("en-IN")}</time>
              </div>
              <p className="vendor-support-original">{ticket.message}</p>
              <div className="vendor-support-replies">
                {(ticket.replies || []).map((reply, index) => (
                  <div className={`vendor-support-reply is-${reply.sender}`} key={`${ticket._id}-${index}`}>
                    <strong>{reply.sender === "admin" ? "OzaBay admin" : "You"}</strong>
                    <p>{reply.message}</p>
                  </div>
                ))}
              </div>
              <div className="vendor-support-reply-form">
                <input
                  value={supportReply[ticket._id] || ""}
                  onChange={(event) => setSupportReply((current) => ({ ...current, [ticket._id]: event.target.value }))}
                  maxLength={2000}
                  aria-label={`Reply to ${ticket.subject}`}
                  placeholder="Reply to OzaBay admin…"
                />
                <button type="button" disabled={orderActionId === `support:${ticket._id}`} onClick={() => submitSupportReply(ticket)}>
                  Reply
                </button>
              </div>
            </article>
          ))}
          {!supportLoading && !supportTickets.length && (
            <div className="vendor-empty-card"><h3>No support messages yet</h3><p>Send a message above or use email, phone or WhatsApp for direct contact.</p></div>
          )}
        </div>
      </section>

      {/* ── Customer Reviews & Feedback ── */}
      <section className="vendor-reviews-section" id="vendor-reviews">
        <div className="vendor-orders-header">
          <div>
            <p className="eyebrow">Customer Voice</p>
            <h2>Product Reviews & Feedback</h2>
          </div>
          <button
            type="button"
            className="v-action-btn v-action-btn--ghost"
            onClick={loadReviews}
            disabled={reviewsLoading}
          >
            {reviewsLoading ? "Refreshing…" : "Refresh reviews"}
          </button>
        </div>
        {reviewsLoading ? (
          <p className="vendor-orders-message">Loading product reviews…</p>
        ) : reviews.length === 0 ? (
          <div className="vendor-empty-card"><h3>No reviews yet</h3><p>Customer ratings and feedback for your products will appear here.</p></div>
        ) : (
          <div className="vendor-review-list">
            {reviews.map((review) => (
              <article className="vendor-review-card" key={review._id}>
                <div className="vendor-review-head">
                  <div>
                    <strong>{review.productName}</strong>
                    <small>{review.userName} · {new Date(review.createdAt).toLocaleDateString("en-IN")}</small>
                  </div>
                  <span className="vendor-review-rating">{review.rating} / 5 ★</span>
                </div>
                <p className="vendor-review-feedback">{review.feedback}</p>
                {review.vendorReply?.message && (
                  <div className="vendor-review-reply is-vendor">
                    <strong>Your reply</strong>
                    <p>{review.vendorReply.message}</p>
                  </div>
                )}
                {review.adminReply?.message && (
                  <div className="vendor-review-reply is-admin">
                    <strong>OzaBay support</strong>
                    <p>{review.adminReply.message}</p>
                  </div>
                )}
                <div className="vendor-review-reply-form">
                  <input
                    value={reviewReply[review._id] || ""}
                    onChange={(event) => setReviewReply((current) => ({ ...current, [review._id]: event.target.value }))}
                    maxLength={2000}
                    placeholder={review.vendorReply?.message ? "Update your response…" : "Write a response to this feedback…"}
                    aria-label={`Reply to review for ${review.productName}`}
                  />
                  <button type="button" disabled={orderActionId === `review:${review._id}`} onClick={() => replyToReview(review)}>
                    {orderActionId === `review:${review._id}` ? "Sending…" : "Send reply"}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ── Vendor Studio Orders ── */}
      <section className="vendor-orders-section" id="vendor-orders">
        <div className="vendor-orders-header" id="vendor-analytics">
          <div>
            <p className="eyebrow">Studio Dispatch & Performance</p>
            <h2>Orders & Sales</h2>
          </div>
          <button
            type="button"
            className="v-action-btn v-action-btn--ghost vendor-orders-refresh"
            onClick={loadOrders}
            disabled={ordersLoading}
          >
            {ordersLoading ? "Refreshing…" : "Refresh orders"}
          </button>
        </div>

        {ordersError && (
          <div className="vendor-alert vendor-alert--error" role="alert">
            {ordersError}
          </div>
        )}
        {ordersNotice && (
          <div className="vendor-alert vendor-alert--success" role="status">
            {ordersNotice}
          </div>
        )}
        {ordersLoading ? (
          <p className="vendor-orders-message">Loading your orders…</p>
        ) : orders.length === 0 ? (
          <p className="vendor-orders-message">
            New orders for your products will appear here.
          </p>
        ) : (
          <div className="vendor-sales-summary">
            <div className="vendor-order-stat-card">
              <span className="v-stat-num">ORDERS</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="vendor-order-stat-card">
              <span className="v-stat-num">ORDER VALUE</span>
              <strong>
                {formatPrice(
                  orders.reduce((total, order) => total + order.total, 0),
                )}
              </strong>
            </div>
          </div>
        )}

        <div className="vendor-sales-list">
          {orders.map((order) => (
            <article className="vendor-sale-card" key={order._id}>
              <header className="vendor-sale-card__header">
                <div>
                  <strong>Order #{order._id.slice(-8).toUpperCase()}</strong>
                  <span>{formatUploadDate(order.createdAt)}</span>
                </div>
                <span className="vendor-sale-card__status">
                  {order.orderStatus}
                </span>
              </header>
              <div className="vendor-sale-card__items">
                {order.items.map((item) => (
                  <div className="vendor-sale-card__item" key={item.productId}>
                    <div className="vendor-sale-card__item-info">
                      {item.name} × {item.quantity}
                      <small className="vendor-sale-card__item-status">
                        Current status: {item.fulfillmentStatus}
                        {item.deliveredAt && ` · Delivered ${formatUploadDate(item.deliveredAt)}`}
                      </small>
                      {item.fulfillmentStatus !== "Cancelled" && (
                        <div className="vendor-item-status-controls">
                          <small>Update fulfillment:</small>
                          <div
                            className="vendor-item-status-actions"
                            aria-label={`Update status for ${item.name}`}
                          >
                            {VENDOR_FULFILLMENT_STATUSES.map((status) => {
                              const actionId = `${order._id}:${item.productId}`;
                              const isUpdating = orderActionId === actionId;
                              return (
                                <button
                                  key={status}
                                  type="button"
                                  className={`v-action-btn v-action-btn--ghost${item.fulfillmentStatus === status ? " is-active" : ""}`}
                                  aria-pressed={item.fulfillmentStatus === status}
                                  disabled={
                                    isUpdating
                                    || item.fulfillmentStatus === status
                                    || item.cancellationRequest?.status === "requested"
                                  }
                                  onClick={() =>
                                    updateOrderItemStatus(order._id, item.productId, status)
                                  }
                                >
                                  {isUpdating && item.fulfillmentStatus !== status
                                    ? "Updating…"
                                    : status}
                                </button>
                              );
                            })}
                          </div>
                          {item.cancellationRequest?.status === "requested" && (
                            <small className="vendor-cancellation-status">
                              Fulfillment updates paused until the cancellation request is reviewed.
                            </small>
                          )}
                        </div>
                      )}
                      {order.paymentMethod === "Cash on delivery" && (
                        <div className="vendor-cod-payment">
                          <small className={`vendor-cod-payment__status${item.cashOnDelivery?.status === "paid" ? " is-paid" : ""}`}>
                            COD {item.cashOnDelivery?.status === "paid" ? "collected" : "payment due"}
                            {item.cashOnDelivery?.collectedAt
                              && ` · ${formatUploadDate(item.cashOnDelivery.collectedAt)}`}
                          </small>
                          {["Received", "Crafting", "Shipped", "Out for delivery", "Delivered"].includes(item.fulfillmentStatus)
                            && item.cashOnDelivery?.status !== "paid" && (
                              <button
                                type="button"
                                className="v-action-btn v-action-btn--ghost"
                                disabled={orderActionId === `${order._id}:${item.productId}`}
                                onClick={() =>
                                  recordCashOnDelivery(order._id, item.productId)
                                }
                              >
                                {orderActionId === `${order._id}:${item.productId}`
                                  ? "Recording…"
                                  : "Mark COD collected"}
                              </button>
                            )}
                        </div>
                      )}
                      {item.returnRequest?.status
                        && item.returnRequest.status !== "none" && (
                          <small className={`vendor-return-status vendor-return-status--${item.returnRequest.status}`}>
                            Return {item.returnRequest.status}
                          </small>
                        )}
                      {item.returnRequest?.status === "requested" && (
                        <small className="vendor-return-detail">
                          Requested {item.returnRequest.requestedAt
                            ? formatUploadDate(item.returnRequest.requestedAt)
                            : ""}
                          {item.returnRequest.reason && ` · ${item.returnRequest.reason}`}
                        </small>
                      )}
                      {["approved", "rejected"].includes(item.returnRequest?.status) && (
                        <small className="vendor-return-detail">
                          {item.returnRequest.reviewedAt
                            ? `Reviewed ${formatUploadDate(item.returnRequest.reviewedAt)}`
                            : "Request reviewed"}
                          {item.returnRequest.reason && ` · ${item.returnRequest.reason}`}
                        </small>
                      )}
                      {item.cancellationRequest?.status
                        && item.cancellationRequest.status !== "none" && (
                          <small className={`vendor-cancellation-status vendor-cancellation-status--${item.cancellationRequest.status}`}>
                            Cancellation {item.cancellationRequest.status}
                          </small>
                        )}
                      {item.cancellationRequest?.status === "requested" && (
                        <small className="vendor-return-detail">
                          Requested {item.cancellationRequest.requestedAt
                            ? formatUploadDate(item.cancellationRequest.requestedAt)
                            : ""}
                          {item.cancellationRequest.reason
                            && ` · ${item.cancellationRequest.reason}`}
                        </small>
                      )}
                      {["approved", "rejected"].includes(item.cancellationRequest?.status)
                        && item.cancellationRequest.reviewedAt && (
                          <small className="vendor-return-detail">
                            Reviewed {formatUploadDate(item.cancellationRequest.reviewedAt)}
                          </small>
                        )}
                    </div>
                    <strong>{formatPrice(item.lineTotal)}</strong>
                    {item.returnRequest?.status === "requested" && (
                      <div className="vendor-return-actions">
                        <button
                          type="button"
                          className="v-action-btn v-action-btn--ghost"
                          disabled={orderActionId === `${order._id}:${item.productId}`}
                          onClick={() =>
                            reviewReturnRequest(order._id, item.productId, "approved")
                          }
                        >
                          {orderActionId === `${order._id}:${item.productId}`
                            ? "Reviewing…"
                            : "Approve return"}
                        </button>
                        <button
                          type="button"
                          className="v-action-btn v-action-btn--ghost"
                          disabled={orderActionId === `${order._id}:${item.productId}`}
                          onClick={() =>
                            reviewReturnRequest(order._id, item.productId, "rejected")
                          }
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    {item.cancellationRequest?.status === "requested" && (
                      <div className="vendor-return-actions">
                        <button
                          type="button"
                          className="v-action-btn v-action-btn--ghost"
                          disabled={orderActionId === `${order._id}:${item.productId}`}
                          onClick={() =>
                            reviewItemCancellation(order._id, item.productId, "approved")
                          }
                        >
                          {orderActionId === `${order._id}:${item.productId}`
                            ? "Reviewing…"
                            : "Approve cancellation"}
                        </button>
                        <button
                          type="button"
                          className="v-action-btn v-action-btn--ghost"
                          disabled={orderActionId === `${order._id}:${item.productId}`}
                          onClick={() =>
                            reviewItemCancellation(order._id, item.productId, "rejected")
                          }
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="vendor-sale-card__details">
                <strong>{order.customer.name}</strong>
                <span>{order.customer.phone} · {order.customer.email}</span>
                <span>
                  {[order.customer.address, order.customer.city, order.customer.pincode]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
              <footer className="vendor-sale-card__footer">
                <div className="vendor-payment-details">
                  <strong>Payment details</strong>
                  <span>
                    {order.paymentDetails?.method || order.paymentMethod}
                    {" · "}
                    {formatPaymentLabel(order.paymentDetails?.status || order.paymentStatus)}
                  </span>
                  {order.paymentDetails?.provider && (
                    <span>Provider: {order.paymentDetails.provider}</span>
                  )}
                  {(order.paymentDetails?.transactionId || order.razorpayPaymentId) && (
                    <span>
                      Transaction: {order.paymentDetails?.transactionId || order.razorpayPaymentId}
                    </span>
                  )}
                  {order.paymentDetails?.paidAt && (
                    <span>Paid: {formatUploadDate(order.paymentDetails.paidAt)}</span>
                  )}
                  {order.paymentDetails?.refundStatus
                    && order.paymentDetails.refundStatus !== "not_required" && (
                      <span>
                        Refund: {formatPaymentLabel(order.paymentDetails.refundStatus)}
                        {order.paymentDetails.refundNote
                          && ` · ${order.paymentDetails.refundNote}`}
                      </span>
                    )}
                </div>
                <div className="vendor-sale-card__total">
                  <span>Your item total</span>
                  <strong>{formatPrice(order.total)}</strong>
                </div>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
