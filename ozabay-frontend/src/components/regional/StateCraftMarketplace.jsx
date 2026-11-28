import { useState } from "react";

export default function StateCraftMarketplace({ state, products, onBack, onProduct, onBrowse, onToggleWish, wish }) {
  const [craftFilter, setCraftFilter] = useState(new URLSearchParams(window.location.search).get("craft") || "All");
  const shown = products.filter((product) => craftFilter === "All" || product.craft === craftFilter);

  return <section className="state-market-page"><div className="oz-container">
    <button className="state-market-back" onClick={onBack}>Back to India Craft Atlas</button>
    <div className="state-market-hero">
      <div><p className="eyebrow">Regional craft edit</p><h1>{state.name}<em> craft.</em></h1>
        <p>Explore the traditions of {state.name} and browse related pieces from OzaBay makers.</p>
        <div className="state-market-meta"><span>Craft centres</span><strong>{state.cities}</strong></div>
      </div>
      <div className="state-market-hero-art"><img src={state.image} alt={`Craft inspiration from ${state.name}`} /></div>
    </div>
    <div className="state-market-filters">
      {["All", ...state.crafts].map((craft) => <button key={craft} aria-pressed={craft === craftFilter}
        className={craft === craftFilter ? "active" : ""} onClick={() => setCraftFilter(craft)}>{craft}</button>)}
    </div>
    <div className="state-market-grid">
      {shown.map((product) => {
        const saved = wish.includes(String(product.id));
        return <article className="state-market-card" key={product.id}>
          <button className="state-market-image" onClick={() => onProduct(product)}>
            <img loading="lazy" src={product.image} alt={product.craft} />
          </button>
          <div className="state-market-card-copy"><small>{product.city}</small>
            <button className="state-market-name" onClick={() => onProduct(product)}>{product.craft}</button>
            <button className="state-market-wish" aria-pressed={saved} aria-label={`Save ${product.craft}`}
              onClick={() => onToggleWish(product)}>{saved ? "♥" : "♡"}</button>
            <button className="state-market-add" onClick={() => onBrowse(product)}>Browse maker listings</button>
          </div>
        </article>;
      })}
    </div>
    {!shown.length && <p>No craft edits match this filter.</p>}
  </div></section>;
}
