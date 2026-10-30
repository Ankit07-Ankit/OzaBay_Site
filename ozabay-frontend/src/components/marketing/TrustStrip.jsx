
export default function TrustStrip(){
  const items=[["AUTHENTIC","Handmade pieces"],["MAKER FIRST","Stories behind every object"],["SECURE BAG","Frontend checkout flow"],["INDIA","Crafted across regions"]];
  return <section className="trust-strip"><div className="oz-container trust-strip__grid">{items.map(([a,b])=><div key={a}><span>{a}</span><strong>{b}</strong></div>)}</div></section>
}
