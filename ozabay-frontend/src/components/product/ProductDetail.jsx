import { useEffect, useState } from "react";
import { VIDEOS } from "../../data/assets.js";

export default function ProductDetail({
  product,
  onClose,
  onAdd,
  onView3D,
  onSpace,
  onReview,
  reviewRefreshToken,
}) {
  const [tab, setTab] = useState("story");
  const [selectedMedia, setSelectedMedia] = useState("image:0");
  const [zoom, setZoom] = useState(1);
  const [reviews, setReviews] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ averageRating: 0, reviewCount: 0 });
  const [reviewError, setReviewError] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const images = Array.isArray(product.images) ? product.images : [];
  const uploadedMedia = product.vendorProduct
    && (images.length > 0 || Boolean(product.video));
  const gallery = images.length > 1 ? images.slice(1) : null;

  useEffect(() => {
    setSelectedMedia("image:0");
    setZoom(1);
  }, [product.id]);

  useEffect(() => {
    let active = true;
    setReviewsLoading(true);
    setReviewError("");
    fetch(`/api/products/${encodeURIComponent(product.id)}/reviews`)
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.message || "Unable to load product reviews.");
        return result;
      })
      .then((result) => {
        if (!active) return;
        setReviews(result.reviews);
        setReviewSummary(result.summary);
      })
      .catch((error) => {
        if (!active) return;
        setReviewError(error.message);
      })
      .finally(() => {
        if (active) setReviewsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [product.id, reviewRefreshToken]);

  const selectMedia = (media) => {
    setSelectedMedia(media);
    setZoom(1);
  };

  const isVideoSelected = uploadedMedia
    && selectedMedia === "video"
    && Boolean(product.video);

  return (
    <div>
      <button className="modal-close" onClick={onClose}>×</button>
      <div className="pdp-grid">
        <div className="pdp-media">
          <div className="pdp-main-image">
            {isVideoSelected ? (
              <video
                key={product.video}
                src={product.video}
                controls
                playsInline
                preload="metadata"
                aria-label={`${product.name} product video`}
              />
            ) : (
              <img
                src={uploadedMedia ? images[Number(selectedMedia.split(":")[1])] || product.image : product.image}
                alt={product.name}
                style={{ transform: `scale(${zoom})` }}
              />
            )}
            {!isVideoSelected && (
              <div className="pdp-image-zoom" aria-label="Image zoom controls">
                <button
                  type="button"
                  aria-label="Zoom out"
                  title="Zoom out"
                  disabled={zoom <= 1}
                  onClick={() => setZoom((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
                >
                  −
                </button>
                <span aria-live="polite">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  aria-label="Zoom in"
                  title="Zoom in"
                  disabled={zoom >= 3}
                  onClick={() => setZoom((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}
                >
                  +
                </button>
              </div>
            )}
            <span className="media-badge">
              Handmade{reviewSummary.reviewCount > 0
                ? ` · ${reviewSummary.averageRating.toFixed(1)} ★`
                : product.rating ? ` · ${product.rating} ★` : ""}
            </span>
          </div>
          {uploadedMedia ? (
            <div className="pdp-media-row pdp-media-row--uploaded" aria-label="Product media">
              {images.map((src, index) => (
                <button
                  key={`${src}-${index}`}
                  type="button"
                  className={`pdp-media-thumbnail ${selectedMedia === `image:${index}` ? "is-active" : ""}`}
                  aria-label={`Show product image ${index + 1}`}
                  aria-pressed={selectedMedia === `image:${index}`}
                  onClick={() => selectMedia(`image:${index}`)}
                >
                  <img src={src} alt="" loading="lazy" />
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </button>
              ))}
              {product.video && (
                <button
                  type="button"
                  className={`pdp-media-thumbnail pdp-media-thumbnail--video ${selectedMedia === "video" ? "is-active" : ""}`}
                  aria-label={`Play ${product.name} product video`}
                  aria-pressed={selectedMedia === "video"}
                  onClick={() => selectMedia("video")}
                >
                  {images[0] && <img src={images[0]} alt="" loading="lazy" />}
                  <span>▶ Video</span>
                </button>
              )}
            </div>
          ) : gallery ? (
            <div className="pdp-media-row pdp-media-row--uploaded">
              {gallery.map((src, index) => (
                <img key={src} src={src} alt={`${product.name} view ${index + 2}`} />
              ))}
            </div>
          ) : (
            <div className="pdp-media-row">
              <img src={product.image} alt="Product detail" />
              {["Bangles", "Blades", "Pendants"].includes(product.category) ? (
                <img
                  src={product.galleryImage || product.image}
                  alt={`${product.name} second view`}
                />
              ) : (
                <video
                  src={VIDEOS.detail}
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster={product.image}
                />
              )}
            </div>
          )}
          <div className="pdp-media-actions">
            <button onClick={() => onView3D(product)}>3D view ↗</button>
            <button onClick={() => onSpace(product)}>View in your space ↗</button>
          </div>
        </div>
        <div className="pdp-copy">
          <p className="eyebrow">
            {product.category}{product.city ? ` · ${product.city}` : ""}
          </p>
          <h2>{product.name}</h2>
          <div className="pdp-price-row">
            <strong>{product.price}</strong>
            {product.regularPrice && <del>{product.regularPrice}</del>}
            {(reviewSummary.reviewCount > 0 || product.rating) && (
              <span>
                ★ {reviewSummary.reviewCount > 0
                  ? reviewSummary.averageRating.toFixed(1)
                  : product.rating}
                {reviewSummary.reviewCount > 0 && ` (${reviewSummary.reviewCount})`}
              </span>
            )}
          </div>
          <p>{product.description}</p>
          <div className="pdp-maker">
            <span>Made by</span>
            <strong>{product.artisan}</strong>
            <small>{product.story}</small>
          </div>
          <div className="pdp-tabs">
            <button className={tab === "story" ? "is-active" : ""} onClick={() => setTab("story")}>Story</button>
            <button className={tab === "details" ? "is-active" : ""} onClick={() => setTab("details")}>Details</button>
            <button className={tab === "reviews" ? "is-active" : ""} onClick={() => setTab("reviews")}>Reviews</button>
          </div>
          {tab === "story" && (
            <div className="tab-panel">
              <p>{product.story}</p>
              <div className="craft-note">
                <span>Craft passport</span>
                <strong>{product.city ? `Handmade in ${product.city}` : "Independent maker listing"}</strong>
                <small>Small-batch edition · maker details supplied with the listing</small>
              </div>
            </div>
          )}
          {tab === "details" && (
            <div className="tab-panel product-facts">
              {product.material && <span>Material <b>{product.material}</b></span>}
              {product.dimensions && <span>Dimensions <b>{product.dimensions}</b></span>}
              {product.care && <span>Care <b>{product.care}</b></span>}
              <span>Maker <b>{product.artisan}</b></span>
              {product.sku && <span>SKU <b>{product.sku}</b></span>}
              {product.regularPrice && <span>Regular price <b>{product.regularPrice}</b></span>}
              {product.offer && <span>Offer <b>{product.offer}</b></span>}
            </div>
          )}
          {tab === "reviews" && (
            <div className="tab-panel review-list">
              {reviewSummary.reviewCount > 0 && (
                <p className="review-summary">
                  <strong>★ {reviewSummary.averageRating.toFixed(1)}</strong>
                  {" "}from {reviewSummary.reviewCount} {reviewSummary.reviewCount === 1 ? "review" : "reviews"}
                </p>
              )}
              {reviewsLoading && <p>Loading customer reviews…</p>}
              {reviewError && <p role="alert">{reviewError}</p>}
              {!reviewsLoading && !reviewError && reviews.length === 0 && (
                <p>Be the first to share your experience with this piece.</p>
              )}
              {reviews.map((review) => (
                <div key={review._id}>
                  <strong>{review.userName} <span>{"★".repeat(review.rating)}</span></strong>
                  <p>{review.feedback}</p>
                </div>
              ))}
              <button className="text-link" onClick={() => onReview(product)}>
                Rate this product & share feedback ↗
              </button>
            </div>
          )}
          <button className="hero-action" onClick={() => onAdd(product)}>
            Add to bag · {product.price} ↗
          </button>
        </div>
      </div>
    </div>
  );
}
