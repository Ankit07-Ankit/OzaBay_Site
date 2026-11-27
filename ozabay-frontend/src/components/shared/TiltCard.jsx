import { useRef } from "react";

export default function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const frame = useRef(0);
  const pointer = useRef({ clientX: 0, clientY: 0 });

  const move = (event) => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    pointer.current.clientX = event.clientX;
    pointer.current.clientY = event.clientY;
    if (frame.current) return;

    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      const bounds = element.getBoundingClientRect();
      const x =
        (pointer.current.clientX - (bounds.left + bounds.width / 2)) /
          element.offsetWidth +
        0.5;
      const y =
        (pointer.current.clientY - (bounds.top + bounds.height / 2)) /
          element.offsetHeight +
        0.5;
      element.style.setProperty("--pointer-x", `${x * 100}%`);
      element.style.setProperty("--pointer-y", `${y * 100}%`);
    });
  };

  const reset = () => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (!ref.current) return;
    ref.current.style.setProperty("--pointer-x", "50%");
    ref.current.style.setProperty("--pointer-y", "50%");
  };

  return (
    <div
      ref={ref}
      className={`tilt-card ${className}`}
      onMouseMove={move}
      onMouseLeave={reset}
    >
      {children}
    </div>
  );
}
