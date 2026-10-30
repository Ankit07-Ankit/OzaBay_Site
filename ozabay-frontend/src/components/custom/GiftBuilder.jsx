import { PRODUCTS } from "../../data/products.js";

export default function GiftBuilder({gift,setGift,onCreate}){
  const budgetMax={"₹5,000":5000,"₹10,000":10000,"₹20,000+":20000}[gift.budget]||5000;
  const styleCategories={
    Earthy:["Terracotta","Ceramics","Woodcraft"],
    Indigo:["Blue Pottery","Textiles","Ceramics"],
    "Warm metal":["Metalcraft","Woodcraft","Home Décor"],
    Textured:["Textiles","Woodcraft","Home Décor"],
  };
  const pool=PRODUCTS.filter(p=>styleCategories[gift.style]?.includes(p.category));
  const ranked=pool.slice().sort((a,b)=>{
    const da=Math.abs(budgetMax/Math.max(1,3)-a.priceValue);
    const db=Math.abs(budgetMax/Math.max(1,3)-b.priceValue);
    return da-db;
  });
  const selected=[];
  let total=0;
  for(const item of ranked){
    if(selected.length>=3) break;
    if(total+item.priceValue<=budgetMax || selected.length===0){selected.push(item);total+=item.priceValue;}
  }
  const display=selected.length?selected:ranked.slice(0,3);
  const displayTotal=display.reduce((n,p)=>n+p.priceValue,0);
  const remaining=Math.max(0,budgetMax-displayTotal);
  const setGiftValue=(key,value)=>setGift(g=>({...g,[key]:value}));
  return 
}
