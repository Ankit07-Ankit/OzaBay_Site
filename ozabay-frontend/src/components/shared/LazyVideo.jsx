import { useEffect, useRef, useState } from "react";

/** Load and play a muted loop only while it is close to the viewport. */
export default function LazyVideo({
  src,
  poster,
  active = true,
  autoPlay = true,
  onError,
  ...props
}) {
  const videoRef = useRef(null);
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setNearViewport(entry.isIntersecting),
      { rootMargin: "180px 0px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const connection = navigator.connection;
    const saveData = Boolean(connection?.saveData);
    const slowConnection = ["slow-2g", "2g", "3g"].includes(connection?.effectiveType);
    if (!active || !nearViewport || !src || reduceMotion || saveData || slowConnection) {
      video.pause();
      if ((reduceMotion || saveData || slowConnection) && video.hasAttribute("src")) {
        video.removeAttribute("src");
        video.load();
      }
      return;
    }

    if (video.getAttribute("src") !== src) {
      video.src = src;
      video.load();
    }

    if (autoPlay) video.play()?.catch(() => {});
    return () => video.pause();
  }, [active, autoPlay, nearViewport, src]);

  return (
    <video
      {...props}
      ref={videoRef}
      poster={active && nearViewport ? poster : undefined}
      muted
      loop
      playsInline
      preload="none"
      onError={onError}
    />
  );
}
