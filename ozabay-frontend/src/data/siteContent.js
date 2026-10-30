import { IMG, VIDEOS } from "./assets.js";

export const COLLECTIONS = [
  {id:"ceramics",name:"Ceramics",filter:"Ceramics",image:IMG.bowls,copy:"Quiet forms, hand-finished in small studios."},
  {id:"blue-pottery",name:"Blue Pottery",filter:"Blue Pottery",image:IMG.blue,copy:"Jaipur colour, contemporary silhouettes."},
  {id:"metalcraft",name:"Metalcraft",filter:"Metalcraft",image:IMG.terracotta,copy:"Hammer marks, warm brass and Kansa."},
  {id:"terracotta",name:"Terracotta",filter:"Terracotta",image:IMG.terracotta,copy:"Fired earth, sculpted and left honest."},
  {id:"textiles",name:"Textiles",filter:"Textiles",image:IMG.indigo,copy:"Loom-made textures for slower rooms."},
  {id:"woodcraft",name:"Woodcraft",filter:"Woodcraft",image:IMG.sculptural,copy:"Carved grain and useful forms."},
  {id:"home-decor",name:"Home Décor",filter:"Home Décor",image:IMG.terracotta,copy:"Small objects that change the atmosphere."},
];


export const POPULAR_THEMES = [
  { id:"earthy", name:"Earthy", copy:"Terracotta, raw clay and carved grain.", query:"earth" },
  { id:"indigo", name:"Indigo", copy:"Deep blue pottery and loom-made texture.", query:"indigo" },
  { id:"quiet-home", name:"Quiet Home", copy:"Objects with a softer, slower presence.", query:"home" },
  { id:"tabletop", name:"Tabletop", copy:"Bowls, trays, runners and everyday rituals.", query:"bowl" },
  { id:"statement", name:"Statement Pieces", copy:"Sculptural forms made to anchor a room.", query:"vase" },
  { id:"gifting", name:"Thoughtful Gifting", copy:"Handmade pieces chosen to be remembered.", query:"" },
];

export const PRICE_BANDS = [
  { label:"Under ₹2,000", max:2000 },
  { label:"₹2,000 – ₹3,500", min:2000, max:3500 },
  { label:"₹3,500 – ₹5,000", min:3500, max:5000 },
  { label:"₹5,000+", min:5000 },
];

export const CRAFT_REGIONS = [
  { name:"Jaipur", state:"Rajasthan", image:IMG.blue, filters:["Blue Pottery","Ceramics","Home Décor","Textiles"] },
  { name:"Molela", state:"Rajasthan", image:IMG.terracotta, filters:["Terracotta"] },
  { name:"Saharanpur", state:"Uttar Pradesh", image:IMG.sculptural, filters:["Woodcraft"] },
  { name:"Moradabad", state:"Uttar Pradesh", image:IMG.terracotta, filters:["Metalcraft"] },
  { name:"Khurja", state:"Uttar Pradesh", image:IMG.bowls, filters:["Ceramics","Home Décor"] },
  { name:"Kutch", state:"Gujarat", image:IMG.indigo, filters:["Textiles"] },
];

export const CURATED_EDITS = [
  { title:"The Indigo Table", copy:"Blue pottery, indigo cloth and tactile forms for an evening table.", image:IMG.indigo, filters:["Blue Pottery","Textiles","Ceramics"] },
  { title:"A Quiet Home", copy:"Small handmade objects that bring texture without visual noise.", image:IMG.sculptural, filters:["Home Décor","Ceramics","Woodcraft"] },
  { title:"Made for Gifting", copy:"Considered pieces for housewarmings, celebrations and thank-yous.", image:IMG.terracotta, filters:["Terracotta","Home Décor","Textiles"] },
];

export const ARTISANS = [
  {id:"meera",name:"Meera Kumari",craft:"Blue Pottery · Jaipur",city:"Jaipur, Rajasthan",story:"A contemporary blue-pottery maker building on a family studio practice, with each motif painted by hand.",image:"https://images.pexels.com/photos/19179113/pexels-photo-19179113.jpeg?auto=compress&cs=tinysrgb&w=1200",products:"Blue Pottery",portraitNote:"Representative artisan workshop portrait"},
  {id:"raghav",name:"Raghav Sharma",craft:"Brass & Kansa · Moradabad",city:"Moradabad, Uttar Pradesh",story:"A metalworker who keeps the rhythm of hand-hammering visible in every small-batch vessel.",image:"https://images.pexels.com/photos/25945094/pexels-photo-25945094.jpeg?auto=compress&cs=tinysrgb&w=1200",products:"Metalcraft",portraitNote:"Representative artisan workshop portrait"},
  {id:"sana",name:"Sana Sheikh",craft:"Block Print · Jaipur",city:"Jaipur, Rajasthan",story:"A textile artist working with carved blocks, layered dyes and naturally inspired palettes.",image:"https://images.pexels.com/photos/7037689/pexels-photo-7037689.jpeg?auto=compress&cs=tinysrgb&w=1200",products:"Textiles",portraitNote:"Representative artisan workshop portrait"},
  {id:"devendra",name:"Devendra Prajapat",craft:"Terracotta · Molela",city:"Molela, Rajasthan",story:"A terracotta sculptor working with local earth and traditional firing methods to create contemporary vessels.",image:"https://images.pexels.com/photos/20887995/pexels-photo-20887995.jpeg?auto=compress&cs=tinysrgb&w=1200",products:"Terracotta",portraitNote:"Representative artisan workshop portrait"},
  {id:"imran",name:"Imran Qureshi",craft:"Woodcraft · Saharanpur",city:"Saharanpur, Uttar Pradesh",story:"A wood carver balancing useful everyday forms with detailed hand-carved surfaces.",image:"https://images.pexels.com/photos/37011185/pexels-photo-37011185.jpeg?auto=compress&cs=tinysrgb&w=1200",products:"Woodcraft",portraitNote:"Representative artisan workshop portrait"},
  {id:"farida",name:"Farida Ansari",craft:"Stoneware & Loom · Khurja",city:"Khurja, Uttar Pradesh",story:"A maker combining tactile stoneware with textile traditions for quiet, contemporary homes.",image:"https://images.pexels.com/photos/31019536/pexels-photo-31019536.jpeg?auto=compress&cs=tinysrgb&w=1200",products:"Ceramics",portraitNote:"Representative artisan workshop portrait"},
];

export const MAKER_STORIES = [
  {id:"meera-film",maker:"Meera Kumari",craft:"Pottery / Ceramics",place:"Jaipur · Rajasthan",chapter:"01 · EARTH → FORM",story:"A quiet study of clay becoming form — pressure, water, wheel and the patience behind a finished vessel.",video:"https://videos.pexels.com/video-files/37185415/15752935_1920_1080_60fps.mp4",fallback:VIDEOS.artisanA,source:"Representative pottery workshop footage"},
  {id:"raghav-film",maker:"Raghav Sharma",craft:"Metalcraft",place:"Moradabad · Uttar Pradesh",chapter:"02 · HEAT → HAMMER",story:"Metal changes character through rhythm: heat, hand tools and hundreds of small decisions shape the final surface.",video:"https://videos.pexels.com/video-files/35755402/15157536_1440_3364_24fps.mp4",fallback:VIDEOS.detail,source:"Representative Indian jewelry / metalcraft footage"},
  {id:"sana-film",maker:"Sana Sheikh",craft:"Textiles",place:"Jaipur · Rajasthan",chapter:"03 · PATTERN → CLOTH",story:"From workshop table to finished textile, the craft is built from repetition, touch and carefully placed pattern.",video:"https://videos.pexels.com/video-files/18883016/18883016-uhd_3840_2160_30fps.mp4",fallback:VIDEOS.detail,source:"Representative Indian tailoring workshop footage"},
  {id:"imran-film",maker:"Imran Qureshi",craft:"Woodcraft",place:"Saharanpur · Uttar Pradesh",chapter:"04 · GRAIN → OBJECT",story:"The grain decides the first move. The maker follows it, cuts slowly and lets the surface keep evidence of the hand.",video:"https://videos.pexels.com/video-files/35323776/14966671_1920_1080_50fps.mp4",fallback:VIDEOS.detail,source:"Representative woodcraft workshop footage"},
];

export const REVIEWS =[
  ["Aarohi S.","The blue pottery piece feels genuinely handmade and the finish is even better in person.",5],
  ["Kabir M.","The 3D view made it much easier to understand the scale before adding it to my bag.",5],
  ["Naina P.","Beautiful packaging concept and a very thoughtful maker story.",4],
];

export const CUSTOM_PRICES ={form:{Vessel:3200,Bowl:2400,Lamp:4800,Planter:2800},material:{Clay:0,Stoneware:700,Brass:1900,Wood:900},finish:{Natural:0,Speckled:350,Indigo:500,"Hand-painted":900},size:{Small:0,Medium:700,Large:1500},tone:{Earth:0,Indigo:150,Sand:100,Forest:200}};
