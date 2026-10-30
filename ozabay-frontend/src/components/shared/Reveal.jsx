import { useEffect, useRef } from "react";

export default function Reveal({children,className="",id}){const ref=useRef(null);useEffect(()=>{const el=ref.current;if(!el)return;const obs=new IntersectionObserver(([e])=>{if(e.isIntersecting){el.classList.add("is-visible");obs.disconnect();}}, {threshold:.06});obs.observe(el);return()=>obs.disconnect();},[]);return <div ref={ref} id={id} className={`reveal ${className}`}>{children}</div>}
