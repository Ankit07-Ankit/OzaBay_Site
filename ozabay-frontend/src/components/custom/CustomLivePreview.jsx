import { money } from "../../utils/formatCurrency.js";

export default function CustomLivePreview({custom,price,image,onPrice}){
  const sizeLabel={Small:"Compact",Medium:"Balanced",Large:"Statement"}[custom.size];
  return <div className="custom-live-preview">
    <div className="custom-preview-topline"><span><i/> LIVE CRAFT FILM</span><small>Watch the making, in real time</small></div>
    <div className="custom-preview-stage custom-preview-stage--video">
      <video className="custom-preview-video" src="/videos/OZABAY.mp4" autoPlay muted loop playsInline preload="metadata"/>
      <div className="custom-preview-video-veil"/>
      <div className="custom-preview-spec"><span>{custom.form}</span><b>{custom.material}</b><em>{custom.finish}</em></div>
    </div>
    <div className="custom-preview-summary">
      <div><span>YOUR CONFIGURATION</span><strong>{custom.form} · {sizeLabel}</strong></div>
      <div className="custom-preview-price"><small>Estimated from</small><strong>{money(price)}</strong></div>
    </div>
    <div className="custom-preview-note"><span>Visual concept preview</span><p>This film shows our artisans at work. Colours, finish and proportions of your own piece are confirmed with you after design review.</p></div>
  </div>
}
