import { useEffect, useRef, useState } from "react";
import "./VendorDashboard.css";

const emptyProduct = {
  name: "",
  description: "",
  category: "",
  price: "",
  discountPercent: "0",
  offer: "",
};

const formatPrice = (price) => new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
}).format(price);

const formatUploadDate = (date) => new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(date));

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
  const [saving, setSaving] = useState(false);
  const previewUrls = useRef(new Set());

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await request("/products");
      setProducts(result.products);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
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
      discountPercent: String(product.discountPercent),
      offer: product.offer,
    });
    setRetainedImages(product.images);
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
    if (selectedFiles.length + newImages.length + retainedImages.length > 5) {
      setError("A product can have up to five images. Remove an existing image first.");
      return;
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

    const payload = new FormData();
    Object.entries(form).forEach(([key, value]) => payload.append(key, value));
    newImages.forEach((file) => payload.append("images", file));
    if (newVideo) payload.append("video", newVideo);
    if (editingProduct) {
      payload.append("images", JSON.stringify(retainedImages));
      payload.append("video", JSON.stringify(retainedVideo ?? ""));
    }

    try {
      const result = await request(
        editingProduct ? `/products/${editingProduct._id}` : "/products",
        { method: editingProduct ? "PATCH" : "POST", body: payload },
      );
      setProducts((current) => editingProduct
        ? current.map((product) => product._id === result.product._id ? result.product : product)
        : [result.product, ...current]);
      setNotice(editingProduct ? "Product updated." : "Product registered.");
      resetForm();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
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
      setNotice("Product deleted.");
    } catch (requestError) {
      setError(requestError.message);
    }
  };

  return (
    <section className="vendor-dashboard">
      <header className="vendor-dashboard__header">
        <div>
          <p className="eyebrow">OzaBay maker studio</p>
          <h1>Welcome, <em>{account.name}</em></h1>
          <p className="vendor-dashboard__intro">
            Register your handmade products and keep prices and offers up to date. Only the products registered from your own account appear here.
          </p>
        </div>
      </header>

      <div className="vendor-dashboard__summary">
        <span>Your registered products</span>
        <strong>{products.length}</strong>
      </div>

      <div className="vendor-dashboard__layout">
        <form id="vendor-product-form" className="vendor-product-form" onSubmit={saveProduct}>
          <div>
            <p className="eyebrow">{editingProduct ? "Edit listing" : "New listing"}</p>
            <h2>{editingProduct ? "Update your piece." : "Register a product."}</h2>
          </div>

          {error && <p className="vendor-dashboard__message is-error" role="alert">{error}</p>}
          {notice && <p className="vendor-dashboard__message" role="status">{notice}</p>}

          <label>
            Product name
            <input
              required
              minLength={2}
              maxLength={100}
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </label>
          <label>
            Description
            <textarea
              required
              minLength={10}
              maxLength={2000}
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>
          <div className="vendor-product-form__row">
            <label>
              Category
              <input
                required
                minLength={2}
                maxLength={60}
                placeholder="e.g. Ceramics"
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
              />
            </label>
            <label>
              Price (INR)
              <input
                required
                type="number"
                min="0.01"
                max="100000000"
                step="0.01"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </label>
          </div>
          <div className="vendor-product-form__row">
            <label>
              Discount (%)
              <input
                type="number"
                min="0"
                max="90"
                step="1"
                value={form.discountPercent}
                onChange={(event) => setForm({ ...form, discountPercent: event.target.value })}
              />
            </label>
            <label>
              Offer label
              <input
                maxLength="100"
                placeholder="e.g. Festive launch offer"
                value={form.offer}
                onChange={(event) => setForm({ ...form, offer: event.target.value })}
              />
            </label>
          </div>

          <label>
            Product images (JPEG, PNG, WebP; up to five, 50 MB each)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={saving || retainedImages.length + newImages.length >= 5}
              onChange={chooseImages}
            />
          </label>
          <p className="vendor-product-form__hint">
            {retainedImages.length + newImages.length} of 5 images selected.
          </p>
          {editingProduct && retainedImages.length > 0 && (
            <div className="vendor-media-preview">
              {retainedImages.map((image) => (
                <div key={image}>
                  <img src={image} alt="Current product" />
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
          {newImages.length > 0 && (
            <div className="vendor-media-preview">
              {newImages.map((image) => (
                <div key={image.preview}>
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

          <label>
            Product video (MP4 or WebM; one video, 50 MB max)
            <input
              type="file"
              accept="video/mp4,video/webm"
              disabled={saving || Boolean(newVideo || retainedVideo)}
              onChange={chooseVideo}
            />
          </label>
          <p className="vendor-product-form__hint">
            {Boolean(newVideo || retainedVideo) ? "Video selected." : "No video selected."}
          </p>
          {editingProduct && retainedVideo && (
            <div className="vendor-media-preview">
              <div>
                <video
                  src={retainedVideo}
                  alt="Current product video"
                  controls
                  preload="none"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
                <button
                  type="button"
                  aria-label="Remove video"
                  onClick={() => setRetainedVideo(null)}
                >
                  ×
                </button>
              </div>
            </div>
          )}
          {newVideo && (
            <div className="vendor-media-preview">
              <div>
                <video
                  src={newVideo.preview}
                  alt="Selected product video"
                  controls
                  preload="none"
                  style={{ maxWidth: "100%", height: "auto" }}
                />
                <button
                  type="button"
                  aria-label="Remove video"
                  onClick={() => {
                    revokePreview(newVideo);
                    setNewVideo(null);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          )}

          <div className="vendor-product-form__actions">
            <button className="hero-action" type="submit" disabled={saving}>
              {saving ? "Saving…" : editingProduct ? "Save product changes ↗" : "Register product ↗"}
            </button>
            {editingProduct && (
              <button className="text-link" type="button" onClick={resetForm}>Cancel editing</button>
            )}
          </div>
        </form>

        <section className="vendor-product-list">
          <div className="vendor-product-list__heading">
            <div>
              <p className="eyebrow">Your catalogue</p>
              <h2>Registered pieces.</h2>
            </div>
            <span>{products.length} items</span>
          </div>
          {loading ? (
            <p className="vendor-dashboard__empty">Loading your products…</p>
          ) : products.length === 0 ? (
            <p className="vendor-dashboard__empty">Your catalogue is empty. Add your first product using the form.</p>
          ) : (
            <div className="vendor-product-list__items">
              {products.map((product) => (
                <article className="vendor-product-card" key={product._id}>
                  <div className="vendor-product-card__media">
                    <img src={product.images[0]} alt={product.name} />
                    {product.discountPercent > 0 && <span>{product.discountPercent}% off</span>}
                  </div>
                  {product.images.length > 1 && (
                    <div className="vendor-product-card__gallery" aria-label={`${product.images.length} product images`}>
                      {product.images.map((image, index) => (
                        <img key={image} src={image} alt={`${product.name} view ${index + 1}`} />
                      ))}
                    </div>
                  )}
                  <div className="vendor-product-card__details">
                    <span>{product.category}</span>
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <time className="vendor-product-card__uploaded" dateTime={product.createdAt}>
                      Uploaded {formatUploadDate(product.createdAt)}
                    </time>
                    <div className="vendor-product-card__price">
                      {product.discountPercent > 0 && <del>{formatPrice(product.price)}</del>}
                      <strong>{formatPrice(product.price * (1 - product.discountPercent / 100))}</strong>
                    </div>
                    {product.offer && <small>{product.offer}</small>}
                    <div className="vendor-product-card__actions">
                      <button type="button" onClick={() => startEditing(product)}>Edit</button>
                      <button type="button" onClick={() => removeProduct(product)}>Delete</button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
