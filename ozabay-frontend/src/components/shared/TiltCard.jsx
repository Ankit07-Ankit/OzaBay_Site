import { useEffect, useRef } from "react";

export default function TiltCard({children,className=""}){
  const ref=useRef(null);
  const target=useRef({x:0,y:0,lift:0,mx:50,my:50});
  const current=useRef({x:0,y:0,lift:0});
  useEffect(()=>{
    let frame;
    const tick=()=>{
      const el=ref.current;
      if(el){
        current.current.x+=(target.current.x-current.current.x)*.075;
        current.current.y+=(target.current.y-current.current.y)*.075;
        current.current.lift+=(target.current.lift-current.current.lift)*.08;
        el.style.transform=`perspective(1400px) translate3d(0,${-current.current.lift}px,0) rotateX(${current.current.y}deg) rotateY(${current.current.x}deg)`;
      }
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[]);
  const move=e=>{const el=ref.current;if(!el)return;const r=el.getBoundingClientRect();const px=(e.clientX-r.left)/r.width;const py=(e.clientY-r.top)/r.height;target.current={x:(px-.5)*2.6,y:(py-.5)*-2.6,lift:2,mx:px*100,my:py*100};el.style.setProperty("--pointer-x",`${px*100}%`);el.style.setProperty("--pointer-y",`${py*100}%`)};
  const leave=()=>{const el=ref.current;target.current={x:0,y:0,lift:0,mx:50,my:50};if(el){el.style.setProperty("--pointer-x","50%");el.style.setProperty("--pointer-y","50%")}};
  return <div ref={ref} className={`tilt-card ${className}`} onMouseMove={move} onMouseLeave={leave}>{children}</div>
}
