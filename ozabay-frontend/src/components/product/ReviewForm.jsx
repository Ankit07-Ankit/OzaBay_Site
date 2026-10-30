import { useState } from "react";

export default function ReviewForm({
  product,
  account,
  loginRequired,
  onRequireSignIn,
  onSubmit,
  onClose,
}) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await onSubmit(product, { rating, feedback });
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop review-modal-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="modal review-modal">
        <button className="modal-close" onClick={onClose}>×</button>
        <p className="eyebrow">Your product experience</p>
        <h2>Review <em>{product.name}.</em></h2>
        {account ? (
          <form className="order-form" onSubmit={handleSubmit}>
            <label>
              Your rating
              <select
                value={rating}
                onChange={(event) => setRating(Number(event.target.value))}
              >
                <option value={5}>5 — Loved it</option>
                <option value={4}>4 — Great</option>
                <option value={3}>3 — Good</option>
                <option value={2}>2 — Could be better</option>
                <option value={1}>1 — Disappointed</option>
              </select>
            </label>
            <label>
              Your feedback
              <textarea
                required
                minLength={5}
                maxLength={1000}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Share your personal experience with this product…"
              />
            </label>
            <small className="review-form__identity">Reviewing as {account.name}</small>
            {error && <p role="alert">{error}</p>}
            <button className="hero-action" type="submit" disabled={submitting}>
              {submitting ? "Saving review…" : "Share your review ↗"}
            </button>
          </form>
        ) : (
          <div className="review-signin-prompt">
            <p>Sign in with a verified account to rate this product and share feedback.</p>
            {loginRequired && <p role="status">Sign in, then your review form will be ready.</p>}
            <button className="hero-action" onClick={onRequireSignIn}>
              Sign in to review ↗
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
