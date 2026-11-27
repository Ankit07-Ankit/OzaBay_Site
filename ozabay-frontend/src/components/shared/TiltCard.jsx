import { useRef } from "react";

export default function TiltCard({ children, className = "" }) {
  const ref = useRef(null);
  const frame = useRef(0);
  const pointer = useRef({ x: 50, y: 50, clientX: 0, clientY: 0 });

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
      pointer.current.x = x * 100;
      pointer.current.y = y * 100;
      element.style.setProperty("--pointer-x", `${pointer.current.x}%`);
      element.style.setProperty("--pointer-y", `${pointer.current.y}%`);
      element.style.transition = "none";
      element.style.transform = `perspective(1400px) translate3d(0, -2px, 0) rotateX(${(y - 0.5) * -5.2}deg) rotateY(${(x - 0.5) * 5.2}deg)`;
    });
  };

  const reset = () => {
    if (frame.current) window.cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (!ref.current) return;
    ref.current.style.transform = "";
    ref.current.style.removeProperty("transition");
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
