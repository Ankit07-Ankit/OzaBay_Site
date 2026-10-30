import { useEffect, useState } from "react";
import { NAV_LINKS } from "./navLinks";
import "./Navbar.css";

const VENDOR_NAV_EXCLUDED = ["shop", "collections", "create-your-own"];

const iconProps = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
const SearchIcon = () => <svg {...iconProps}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>;
const AccountIcon = () => <svg {...iconProps}><circle cx="12" cy="8.5" r="4" /><path d="M4.5 20c.9-3.6 3.9-5.5 7.5-5.5s6.6 1.9 7.5 5.5" /></svg>;
const CartIcon = () => <svg {...iconProps}><path d="M3 4h2.4l2.1 11h9.6l2-8H6.3" /><circle cx="9.5" cy="19.2" r="1.2" /><circle cx="16.5" cy="19.2" r="1.2" /></svg>;
const COLLECTION_MENU = [
  ["Ceramics","Quiet forms & stoneware"],["Blue Pottery","Jaipur colour"],["Terracotta","Fired earth"],["Textiles","Loom-made texture"],
  ["Woodcraft","Carved grain"],["Metalcraft","Brass & Kansa"],["Home Décor","Objects for the room"]
];

export default function Navbar({ activeId = "shop", cartCount = 0, isVendor = false, logoHref = "#home", onSearchClick, onAccountClick, onCartClick, onNavClick }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Vendors manage a panel, not a storefront — drop shopping links from the menu.
  const navLinks = isVendor
    ? NAV_LINKS.filter((link) => !VENDOR_NAV_EXCLUDED.includes(link.id))
    : NAV_LINKS;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", onKey); };
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
  };

  return (
    <header className={`ozb-nav ${isVendor ? "is-vendor" : ""} ${scrolled ? "is-scrolled" : ""}`}>
      <div className="ozb-nav__inner">
        <a className="ozb-nav__logo" href={logoHref} aria-label="OzaBay home">OzaBay{isVendor && <span className="ozb-nav__vendor-tag">Vendor</span>}</a>
        <nav id="ozb-primary-nav" className={`ozb-nav__menu ${menuOpen ? "is-open" : ""}`} aria-label="Primary">
          <ul className="ozb-nav__links">
            {navLinks.map((link) => <li key={link.id} className={link.id==="collections"?"ozb-nav__has-mega":""}><a href={`#${link.id}`} className={`ozb-nav__link ${activeId === link.id ? "is-active" : ""}`} aria-current={activeId === link.id ? "page" : undefined} onClick={(e) => handleNav(e, link)}>{link.label}</a>{link.id==="collections"&&<div className="ozb-mega" aria-label="Collection shortcuts"><div className="ozb-mega__intro"><span>OZABAY / COLLECTIONS</span><strong>Find your craft.</strong><small>Explore the image-backed collections already in your catalogue.</small></div><div className="ozb-mega__grid">{COLLECTION_MENU.map(([name,copy])=><button key={name} onClick={(e)=>{e.preventDefault();onNavClick?.("collections");setMenuOpen(false);}}><b>{name}</b><small>{copy}</small><i>↗</i></button>)}</div></div>}</li>)}
          </ul>
        </nav>
        <div className="ozb-nav__actions">
          <button type="button" className="ozb-nav__icon-btn" aria-label="Search" onClick={onSearchClick}><SearchIcon /></button>
          <button type="button" className="ozb-nav__icon-btn" aria-label="Account" onClick={onAccountClick}><AccountIcon /></button>
          {!isVendor && (
            <button type="button" className="ozb-nav__icon-btn ozb-nav__cart" aria-label={`Cart, ${cartCount} items`} onClick={onCartClick}><CartIcon /><span className="ozb-nav__badge">{cartCount}</span></button>
          )}
          <button type="button" className={`ozb-nav__toggle ${menuOpen ? "is-open" : ""}`} aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} aria-controls="ozb-primary-nav" onClick={() => setMenuOpen((v) => !v)}><span /><span /></button>
        </div>
      </div>
    </header>
  );
}
