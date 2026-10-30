import { useEffect, useRef, useState } from "react";
import "./Hero.css";

const SLIDES = [
  { id: 1, image: "/images/hero-vase.jpg", video: "/videos/ozabay-3d-hero.mp4", label: "Blue pottery · Jaipur", kicker: "The OzaBay Edit", title: <>Timeless Crafts,<em>Modern Homes.</em></>, text: <>Discover authentic handcrafted pieces<br />from India's finest artisans.</> },
  { id: 2, image: "/images/handmade-sculptural-vase.jpg", label: "Sculptural terracotta", kicker: "Made by Hand", title: <>Objects with a <em>Story.</em></>, text: <>Slow-made forms shaped by hand,<br />made to live with you for years.</> },
  { id: 3, image: "/images/handmade-indigo-bowls.jpg", label: "Indigo stoneware", kicker: "Indian Craft, Reimagined", title: <>Keep the craft.<em>Change the space.</em></>, text: <>Heritage techniques, contemporary silhouettes,<br />and pieces worth keeping.</> },
];

const Arrow = ({ dir = "right" }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {dir === "right" ? <path d="M4 12h16M14 6l6 6-6 6" /> : <path d="M20 12H4M10 6l-6 6 6 6" />}
  </svg>
);

export default function Hero({ onExploreClick, onCreateClick }) {
  const [index, setIndex] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [pointer, setPointer] = useState({ x: 50, y: 50 });
  const frame = useRef(null);
  const slide = SLIDES[index];

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), 6500);
    return () => clearInterval(id);
  }, []);

  const move = (e) => {
    if (!frame.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = frame.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * 100;
    const py = ((e.clientY - r.top) / r.height) * 100;
    setPointer({ x: px, y: py });
    setTilt({ x: ((px / 100) - 0.5) * 5.5, y: ((py / 100) - 0.5) * -4 });
  };

  const reset = () => {
    setTilt({ x: 0, y: 0 });
    setPointer({ x: 50, y: 50 });
  };

  return (
    <section id="home" ref={frame} className="ozb-hero" onMouseMove={move} onMouseLeave={reset} style={{ "--mx": `${pointer.x}%`, "--my": `${pointer.y}%` }} aria-label="Featured OzaBay handmade pieces">
      <div className="ozb-hero__media" aria-hidden="true">
        {SLIDES.map((s, i) => (
          <div key={s.id} className={`ozb-hero__slide ${i === index ? "is-active" : ""}`} style={{ backgroundImage: `url(${s.image})`, transform: `scale(1.045) perspective(1500px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) translate3d(${tilt.x * -1.1}px, ${tilt.y * 1.1}px, 0)` }}>
            {s.video && <video className="ozb-hero__video" src={s.video} autoPlay muted loop playsInline preload="auto" poster={s.image} aria-hidden="true" />}
          </div>
        ))}
        <div className="ozb-hero__media-glow" />
        <div className="ozb-hero__shine" />
        <div className="ozb-hero__grain" />
      </div>


      <div className="ozb-hero__inner">
        <div className="ozb-hero__content" key={slide.id}>
          <p className="ozb-hero__eyebrow">{slide.kicker} <span className="ozb-hero__eyebrow-line" /></p>
          <h1 className="ozb-hero__title">{slide.title}</h1>
          <p className="ozb-hero__text">{slide.text}</p>
          <div className="ozb-hero__cta">
            <button className="ozb-hero__btn ozb-hero__btn--gold" onClick={onExploreClick}>Explore Collections <Arrow /></button>
            <button className="ozb-hero__btn ozb-hero__btn--outline" onClick={onCreateClick}>Create Your Own</button>
          </div>
        </div>
        <aside className="ozb-hero__tag">
          <p className="ozb-hero__tag-label">Artisan Crafted<br />in India</p>
          <span className="ozb-hero__tag-line" />
          <p className="ozb-hero__tag-text">Heritage.<br />Handed down.<br />Reimagined.</p>
        </aside>
      </div>

      <div className="ozb-hero__slide-meta"><span>0{index + 1}</span><i />{slide.label}</div>
      <div className="ozb-hero__scroll"><span>Scroll<br />to explore</span><i /></div>
      <div className="ozb-hero__controls">
        <button type="button" onClick={() => setIndex((i) => (i - 1 + SLIDES.length) % SLIDES.length)} aria-label="Previous slide"><Arrow dir="left" /></button>
        <span className="ozb-hero__counter">{String(index + 1).padStart(2, "0")} <em>/ {String(SLIDES.length).padStart(2, "0")}</em></span>
        <button type="button" onClick={() => setIndex((i) => (i + 1) % SLIDES.length)} aria-label="Next slide"><Arrow /></button>
      </div>
    </section>
  );
}
