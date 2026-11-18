import { useEffect, useMemo, useState } from "react";
import { NAV_LINKS, VENDOR_NAV_LINKS } from "./navLinks";
import "./Navbar.css";

/* ── Icons ─────────────────────────────────────────────────────── */
const I = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const SearchIcon  = () => <svg {...I}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;
const AccountIcon = () => <svg {...I}><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" /></svg>;
const CartIcon    = () => <svg {...I}><path d="M3 4h2.4l2.1 11h9.6l2-8H6.3" /><circle cx="9.5" cy="19.2" r="1.2" /><circle cx="16.5" cy="19.2" r="1.2" /></svg>;
const ChevronIcon = () => <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><path d="M2 3.5l3 3 3-3"/></svg>;

/* Fallback categories if no vendor product registered yet */
const FALLBACK_CATEGORIES = [
  ["Ceramics",     "Quiet forms & stoneware"],
  ["Blue Pottery", "Jaipur colour"],
  ["Terracotta",   "Fired earth"],
  ["Textiles",     "Loom-made texture"],
  ["Woodcraft",    "Carved grain"],
  ["Metalcraft",   "Brass & Kansa"],
  ["Home Décor",   "Objects for the room"],
];

/* ── Component ──────────────────────────────────────────────────── */
export default function Navbar({
  activeId = "shop",
  cartCount = 0,
  isVendor = false,
  logoHref = "#home",
  registeredProducts = [],
  onSearchClick,
  onAccountClick,
  onCartClick,
  onNavClick,
  onSelectCategory,
}) {
  const [menuOpen, setMenuOpen]   = useState(false);
  const [scrolled, setScrolled]   = useState(false);
  const [megaOpen, setMegaOpen]   = useState(false);

  /* Build link list:
     - Vendors get ONLY VENDOR_NAV_LINKS (no Shop, no user shopping options)
     - Normal customers get NAV_LINKS
  */
  const navLinks = isVendor ? VENDOR_NAV_LINKS : NAV_LINKS;

  /* Derive dynamic collections by category from registered vendor products */
  const collectionItems = useMemo(() => {
    if (!registeredProducts || registeredProducts.length === 0) {
      return FALLBACK_CATEGORIES.map(([name, copy]) => ({
        name,
        copy,
        count: 0,
      }));
    }
    const catMap = new Map();
    registeredProducts.forEach((p) => {
      const cat = p.category?.trim();
      if (!cat) return;
      if (!catMap.has(cat)) {
        catMap.set(cat, {
          name: cat,
          copy: `${p.material || "Handcrafted"} · Maker pieces`,
          count: 0,
        });
      }
      catMap.get(cat).count += 1;
    });

    return Array.from(catMap.values());
  }, [registeredProducts]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [menuOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1025px)");
    const onChange = (e) => e.matches && setMenuOpen(false);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const handleNav = (e, link) => {
    if (onNavClick) {
      e.preventDefault();
      onNavClick(link.id);
    }
    setMenuOpen(false);
    setMegaOpen(false);
  };

  const handleCategoryClick = (e, catName) => {
    e.preventDefault();
    if (onSelectCategory) {
      onSelectCategory(catName);
    } else if (onNavClick) {
      onNavClick("collections", catName);
    }
    setMenuOpen(false);
    setMegaOpen(false);
  };

  return (
    <header className={`ozb-nav ${isVendor ? "is-vendor" : ""} ${scrolled ? "is-scrolled" : ""}`}>
      <div className="ozb-nav__inner">

        {/* ── Logo ── */}
        <a
          className="ozb-nav__logo"
          href={isVendor ? "/vendor" : logoHref}
          aria-label={isVendor ? "OzaBay Maker Studio" : "OzaBay home"}
          onClick={(e) => {
            if (isVendor) {
              e.preventDefault();
              window.scrollTo({ top: 0, behavior: "smooth" });
            }
          }}
        >
          <span className="ozb-nav__logo-mark">✦</span>
          OzaBay
          {isVendor && <span className="ozb-nav__vendor-tag">Maker Studio</span>}
        </a>

        {/* ── Desktop nav ── */}
        <nav
          id="ozb-primary-nav"
          className={`ozb-nav__menu ${menuOpen ? "is-open" : ""}`}
          aria-label="Primary"
        >
          <ul className="ozb-nav__links">
            {navLinks.map((link) => {
              const isMega = !isVendor && link.id === "collections";
              return (
                <li
                  key={link.id}
                  className={`ozb-nav__item${isMega ? " ozb-nav__has-mega" : ""}`}
                  onMouseEnter={() => isMega && setMegaOpen(true)}
                  onMouseLeave={() => isMega && setMegaOpen(false)}
                >
                  <a
                    href={link.href || `#${link.id}`}
                    className={`ozb-nav__link ${activeId === link.id ? "is-active" : ""}`}
                    aria-current={activeId === link.id ? "page" : undefined}
                    onClick={(e) => handleNav(e, link)}
                  >
                    {link.label}
                    {isMega && <span className="ozb-nav__chevron"><ChevronIcon /></span>}
                  </a>

                  {/* Collections mega-menu: lists registered products by category */}
                  {isMega && (
                    <div
                      className={`ozb-mega ${megaOpen ? "is-open" : ""}`}
                      aria-label="Collection shortcuts"
                    >
                      <div className="ozb-mega__intro">
                        <span>MAKER COLLECTIONS</span>
                        <strong>Crafted by category.</strong>
                        <small>Explore registered artisan creations grouped by craft category.</small>
                      </div>
                      <div className="ozb-mega__grid">
                        {collectionItems.map((item) => (
                          <button
                            key={item.name}
                            onClick={(e) => handleCategoryClick(e, item.name)}
                          >
                            <b>{item.name}</b>
                            <small>
                              {item.count > 0 ? `${item.count} ${item.count === 1 ? "piece" : "pieces"}` : item.copy}
                            </small>
                            <i>↗</i>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* ── Right-side actions ── */}
        <div className="ozb-nav__actions">
          {/* VENDOR FACILITIES: Account */}
          {isVendor ? (
            <button
              type="button"
              className="ozb-nav__icon-btn"
              aria-label="Vendor Account"
              title="Vendor Studio Account"
              onClick={onAccountClick}
            >
              <AccountIcon />
            </button>
          ) : (
            /* USER FACILITIES: Search, Account, Cart */
            <>
              <button
                type="button"
                className="ozb-nav__icon-btn"
                aria-label="Search"
                onClick={onSearchClick}
              >
                <SearchIcon />
              </button>

              <button
                type="button"
                className="ozb-nav__icon-btn"
                aria-label="Account"
                onClick={onAccountClick}
              >
                <AccountIcon />
              </button>

              <button
                type="button"
                className="ozb-nav__icon-btn ozb-nav__cart"
                aria-label={`Cart, ${cartCount} items`}
                onClick={onCartClick}
              >
                <CartIcon />
                {cartCount > 0 && (
                  <span className="ozb-nav__badge" aria-hidden="true">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>
            </>
          )}

          {/* Hamburger toggle */}
          <button
            type="button"
            className={`ozb-nav__toggle ${menuOpen ? "is-open" : ""}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="ozb-primary-nav"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>
    </header>
  );
}
