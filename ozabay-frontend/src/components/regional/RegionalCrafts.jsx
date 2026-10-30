import { useState } from "react";
import { INDIA_CRAFTS, INDIA_UTS, INDIA_MAP_POSITIONS } from "../../data/regionalCrafts.js";
import { REGIONAL_CRAFT_PRODUCTS } from "../../data/regionalCraftProducts.js";
import Reveal from "../shared/Reveal.jsx";

export default function RegionalCrafts({onRegion,onProduct}){
  const [selected,setSelected]=useState(INDIA_CRAFTS.find(s=>s.name==="Rajasthan")||INDIA_CRAFTS[0]);
  const [hovered,setHovered]=useState(null);
  const choose=state=>setSelected(state);
  const selectedProducts=REGIONAL_CRAFT_PRODUCTS.filter(p=>p.state===selected.name);
  return <section className="oz-section regional-crafts" id="crafts-india">
    <div className="oz-container">
      <Reveal><div className="section-head"><div><p className="eyebrow">Craft across India</p><h2>Every state. <em>Its craft.</em></h2></div><p>Hover or click a state to reveal its signature crafts. Every craft is connected to an OzaBay product edit so the map becomes a simple way to discover and shop India, state by state.</p></div></Reveal>
      <div className="india-craft-explorer">
        <div className="india-map-panel">
          <div className="india-map-top"><span>INDIA · CRAFT ATLAS</span><small>{INDIA_CRAFTS.length} states · {INDIA_UTS.length} union territories</small></div>
          <div className="india-map-stage">
            <div className="india-map-aura"/>
            <div className="india-map-sheen"/>
            <img className="india-map-image" src="https://commons.wikimedia.org/wiki/Special:Redirect/file/India_states_and_union_territories_map.svg" alt="Map of India showing states and union territories" loading="lazy"/>
            <div className="india-map-overlay">
              {INDIA_CRAFTS.map(state=>{
                const [left,top]=INDIA_MAP_POSITIONS[state.name]||[50,50];
                const active=selected.code===state.code;
                const visible=hovered===state.code||active;
                return <button key={state.code} className={`india-state-pin ${active?"is-active":""} ${hovered===state.code?"is-hovered":""}`} style={{left:`${left}%`,top:`${top}%`}} onMouseEnter={()=>setHovered(state.code)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(state.code)} onBlur={()=>setHovered(null)} onClick={()=>choose(state)} aria-label={`Explore crafts of ${state.name}`}>
                  <i/>{visible&&<span>{state.name}<small>{state.crafts.length} craft edits</small></span>}
                </button>;
              })}
            </div>
            <div className="india-map-legend"><span><i/>Craft state</span><span><b>01</b> Hover</span><span><b>02</b> Click</span></div>
          </div>
          <div className="india-map-help"><span>● Hover a state</span><span>↗ Click to explore</span><span>⌁ Product edits open on the right</span></div>
        </div>
        <aside className="india-craft-detail">
          <div className="india-craft-detail__image"><img src={selected.image} alt=""/><div className="india-craft-detail__image-wash"/><span>{selected.name.toUpperCase()}</span></div>
          <div className="india-craft-detail__body">
            <div className="india-craft-detail__meta"><span>{selected.code}</span><small>{selected.capital}</small></div>
            <p className="eyebrow">Selected state</p>
            <h3>{selected.name}</h3>
            <p className="india-craft-cities">Craft centres · {selected.cities}</p>
            <div className="india-craft-list">{selected.crafts.map((craft,i)=><button key={craft} onClick={()=>onRegion?.({name:selected.name,filters:[],query:craft})}><span>0{i+1}</span><strong>{craft}</strong><i>↗</i></button>)}</div>
            <div className="india-product-rail-head"><span>AVAILABLE ON OZABAY</span><small>{selectedProducts.length} regional edits</small></div>
            <div className="india-product-rail">{selectedProducts.map(product=><button key={product.id} onClick={()=>onProduct?.(product)}><img src={product.image} alt=""/><span>{product.craft}</span><strong>{product.price}</strong></button>)}</div>
            <button className="hero-action india-shop-state" onClick={()=>onRegion?.({name:selected.name,filters:[],query:null})}>Shop {selected.name} craft ↗</button>
          </div>
        </aside>
      </div>
    </div>
  </section>
}
