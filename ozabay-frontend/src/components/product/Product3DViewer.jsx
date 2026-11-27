import { useRef, useState } from "react";
import { money } from "../../utils/formatCurrency.js";

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

export default function Product3DViewer({product,onClose,onAdd,onSpace}){
  const [rotation,setRotation]=useState(-18);
  const [pitch,setPitch]=useState(3);
  const [zoom,setZoom]=useState(1);
  const [autoSpin,setAutoSpin]=useState(()=>!prefersReducedMotion());
  const viewerSrc=product.viewerImage||product.image;
  const orbitRef=useRef(null);
  const dragging=useRef(false);
  const last=useRef({x:0,y:0});
  const pauseRotation=()=>{
    const transform=orbitRef.current&&window.getComputedStyle(orbitRef.current).transform;
    if(transform&&transform!=='none'&&window.DOMMatrixReadOnly){
      const matrix=new DOMMatrixReadOnly(transform);
      setRotation(Math.atan2(matrix.m31,matrix.m11)*180/Math.PI);
    }
    setAutoSpin(false);
  };
  const reset=()=>{setRotation(-18);setPitch(3);setZoom(1);setAutoSpin(!prefersReducedMotion());};
  const down=e=>{if(e.button!==undefined&&e.button!==0)return;dragging.current=true;last.current={x:e.clientX,y:e.clientY};pauseRotation();e.currentTarget.setPointerCapture?.(e.pointerId)};
  const move=e=>{const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--viewer-light-x',`${Math.max(8,Math.min(92,((e.clientX-r.left)/r.width)*100))}%`);e.currentTarget.style.setProperty('--viewer-light-y',`${Math.max(8,Math.min(88,((e.clientY-r.top)/r.height)*100))}%`);if(!dragging.current)return;const dx=e.clientX-last.current.x;const dy=e.clientY-last.current.y;last.current={x:e.clientX,y:e.clientY};setRotation(v=>v+dx*.62);setPitch(v=>Math.max(-16,Math.min(18,v-dy*.34)))};
  const stop=()=>{dragging.current=false};
  const zoomIn=()=>setZoom(v=>Math.min(1.55,Number((v+.1).toFixed(2))));
  const zoomOut=()=>setZoom(v=>Math.max(.72,Number((v-.1).toFixed(2))));
  return <div className="viewer-shell">
    <button className="modal-close" onClick={onClose} aria-label="Close 3D viewer">×</button>
    <div className="viewer-copy">
      <p className="eyebrow">Interactive product studio</p>
      <h2>See it from <em>every angle.</em></h2>
      <p>Explore the piece like you are holding it in your hands. Drag in any direction, zoom into the silhouette and switch to the room preview when you are ready.</p>
      <div className="viewer-status"><span className={autoSpin?"is-live":""}><i/> {autoSpin?"Auto orbiting":"Manual inspection"}</span><span>Drag · Pinch / scroll · Arrow keys</span></div>
      <div className="viewer-actions"><button className="hero-action" onClick={()=>autoSpin?pauseRotation():setAutoSpin(true)}>{autoSpin?"Pause rotation":"Auto rotate"} ↻</button><button className="text-link" onClick={()=>onSpace(product)}>View in your space ↗</button><button className="text-link" onClick={()=>onAdd(product)}>Add to bag ↗</button></div>
    </div>
      <div className="viewer-stage" onPointerDown={down} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} onDoubleClick={reset} onWheel={e=>e.deltaY<0?zoomIn():zoomOut()} tabIndex="0" onKeyDown={e=>{if(e.key==="ArrowLeft"){pauseRotation();setRotation(v=>v-10)}if(e.key==="ArrowRight"){pauseRotation();setRotation(v=>v+10)}if(e.key==="ArrowUp")setPitch(v=>Math.max(-16,v-7));if(e.key==="ArrowDown")setPitch(v=>Math.min(18,v+7));if(e.key==="+")zoomIn();if(e.key==="-")zoomOut();if(e.key==="0")reset();}} aria-label={`Interactive 3D presentation of ${product.name}`}>
      <div className="viewer-halo"/><div className="viewer-floor"/><div className="viewer-grid"/>
      <div ref={orbitRef} className={`viewer-orbit${autoSpin?" is-spinning":""}`} style={{"--viewer-rotation":`${rotation}deg`}}>
      <div className="viewer-object" style={{transform:`translateZ(0) scale(${zoom}) rotateX(${pitch}deg)`}}>
        <span className="viewer-layer viewer-layer--back"><img loading="lazy" decoding="async" src={viewerSrc} alt="" draggable="false"/></span>
        <span className="viewer-layer viewer-layer--mid"><img loading="lazy" decoding="async" src={viewerSrc} alt="" draggable="false"/></span>
        <span className="viewer-layer viewer-layer--front"><img loading="lazy" decoding="async" src={viewerSrc} alt={product.name} draggable="false"/></span>
        <span className="viewer-specular"/>
      </div>
      </div>
      <div className="viewer-controls" onPointerDown={e=>e.stopPropagation()}><button onClick={zoomIn} aria-label="Zoom in">+</button><button onClick={reset} aria-label="Reset 3D view">Reset</button><button onClick={zoomOut} aria-label="Zoom out">−</button></div>
      <span className="viewer-hint">Drag to orbit · Double click to reset</span>
    </div>
    <div className="viewer-meta"><strong>{product.name}</strong><span>{product.category} · {money(product.priceValue)} · {product.city}</span></div>
  </div>
}
