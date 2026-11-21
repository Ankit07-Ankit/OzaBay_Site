import { useEffect, useRef, useState } from "react";
import { IMG, VIDEOS } from "../../data/assets.js";
import LazyVideo from "../shared/LazyVideo.jsx";

const STAGES = [
  {
    eyebrow: "01 · MATERIAL",
    title: "It begins with earth.",
    copy: "Raw clay meets the hands that know exactly how it should move.",
    image: IMG.terracotta,
    video: "a",
  },
  {
    eyebrow: "02 · HANDS",
    title: "Made by hand.",
    copy: "Pressure, rhythm and patience shape every curve of the piece.",
    image: IMG.sculptural,
    video: "a",
  },
  {
    eyebrow: "03 · DETAIL",
    title: "Finished slowly.",
    copy: "Every turn of the wheel leaves behind a detail no machine can repeat.",
    image: IMG.blue,
    video: "b",
  },
  {
    eyebrow: "04 · OBJECT",
    title: "From hands to home.",
    copy: "A workshop gesture becomes an object made to live with you.",
    image: IMG.indigo,
    video: "b",
  },
];

export default function CraftFilm() {
  const sectionRef = useRef(null);
  const frameRef = useRef(0);
  const [stage, setStage] = useState(0);
  const [videoFailed, setVideoFailed] = useState({ a: false, b: false });

  useEffect(() => {
    const element = sectionRef.current;
    if (!element) return;

    const update = () => {
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        const rect = element.getBoundingClientRect();
        const total = Math.max(1, rect.height - window.innerHeight);
        const progress = Math.min(1, Math.max(0, -rect.top / total));
        setStage(Math.min(STAGES.length - 1, Math.floor(progress * STAGES.length)));
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const jumpStage = (index) => {
    setStage(index);
    const element = sectionRef.current;
    if (!element) return;
    const maxScroll = Math.max(0, element.offsetHeight - window.innerHeight);
    const target = element.getBoundingClientRect().top + window.scrollY + maxScroll * (index / (STAGES.length - 1));
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  const active = STAGES[stage];
  const srcA = videoFailed.a ? VIDEOS.craft : VIDEOS.artisanA;
  const srcB = videoFailed.b ? VIDEOS.detail : VIDEOS.artisanB;

  return (
    <section ref={sectionRef} className="oz-section craft-film craft-film--story">
      <div className="craft-story-pin">
        <div className="craft-story-frame">
          <LazyVideo
            className={`craft-story-video craft-story-video--a${active.video === "a" ? " is-active" : ""}`}
            src={srcA}
            active={active.video === "a"}
            poster={IMG.terracotta}
            onError={() => setVideoFailed((current) => ({ ...current, a: true }))}
            aria-label="Artisan shaping clay by hand on a pottery wheel"
          />
          <LazyVideo
            className={`craft-story-video craft-story-video--b${active.video === "b" ? " is-active" : ""}`}
            src={srcB}
            active={active.video === "b"}
            poster={IMG.sculptural}
            onError={() => setVideoFailed((current) => ({ ...current, b: true }))}
            aria-label="Close-up of an artisan molding clay on a pottery wheel"
          />
          <div className="craft-story-wash" />
          <div className="craft-story-filmgrain" aria-hidden="true" />
          <div className="craft-story-product">
            <img src={active.image} alt="" loading="lazy" decoding="async" />
            <span>HANDMADE / INDIA</span>
          </div>
          <div className="craft-story-copy" key={stage}>
            <p className="eyebrow">{active.eyebrow}</p>
            <h2>{active.title}</h2>
            <p>{active.copy}</p>
            <button
              className="hero-action"
              onClick={() => document.getElementById("artisans")?.scrollIntoView({ behavior: "smooth" })}
            >
              Meet the makers ↗
            </button>
          </div>
          <div className="craft-story-steps" aria-label="Craft story progress">
            {STAGES.map((item, index) => (
              <button
                key={item.eyebrow}
                className={index === stage ? "is-active" : ""}
                onClick={() => jumpStage(index)}
                aria-label={`Go to ${item.eyebrow}`}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="craft-story-caption">
            <span>OZABAY / CRAFT FILM · REAL MAKER FOOTAGE</span>
            <strong>FROM HANDS <i>→</i> HOME</strong>
          </div>
          <div className="craft-story-live"><i /> LIVE CRAFT FILM</div>
        </div>
      </div>
    </section>
  );
}
