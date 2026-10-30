import { IMG, PRODUCT_IMAGES } from "./assets.js";

export const INDIA_CRAFTS = [
  {name:"Andhra Pradesh", code:"IN-AP", capital:"Amaravati", crafts:["Kalamkari", "Kondapalli Toys", "Uppada Jamdani"], image:IMG.indigo, cities:"Srikalahasti · Kondapalli · Uppada"},
  {name:"Arunachal Pradesh", code:"IN-AR", capital:"Itanagar", crafts:["Cane & Bamboo", "Monpa Carpets", "Handwoven Textiles"], image:IMG.sculptural, cities:"Tawang · Bomdila · Itanagar"},
  {name:"Assam", code:"IN-AS", capital:"Dispur", crafts:["Muga Silk", "Cane & Bamboo", "Traditional Weaving"], image:"/images/hd6.jpg", cities:"Sualkuchi · Guwahati · Majuli"},
  {name:"Bihar", code:"IN-BR", capital:"Patna", crafts:["Madhubani Painting", "Sikki Grass Craft", "Sujuni Embroidery"], image:IMG.indigo, cities:"Madhubani · Darbhanga · Patna"},
  {name:"Chhattisgarh", code:"IN-CT", capital:"Raipur", crafts:["Dhokra", "Bell Metal", "Terracotta"], image:IMG.terracotta, cities:"Bastar · Kondagaon · Raipur"},
  {name:"Goa", code:"IN-GA", capital:"Panaji", crafts:["Coconut Shell Craft", "Bamboo Craft", "Pottery"], image:IMG.bowls, cities:"Panaji · Bicholim · Margao"},
  {name:"Gujarat", code:"IN-GJ", capital:"Gandhinagar", crafts:["Kutch Embroidery", "Bandhani", "Rogan Art"], image:"/images/textile4.jpg", cities:"Kutch · Patan · Ahmedabad"},
  {name:"Haryana", code:"IN-HR", capital:"Chandigarh", crafts:["Durrie Weaving", "Hand Embroidery", "Terracotta"], image:"/images/textile5.jpg", cities:"Panipat · Ambala · Panchkula"},
  {name:"Himachal Pradesh", code:"IN-HP", capital:"Shimla", crafts:["Chamba Rumal", "Kullu Shawls", "Wood Carving"], image:"/images/wc4.jpg", cities:"Chamba · Kullu · Shimla"},
  {name:"Jharkhand", code:"IN-JH", capital:"Ranchi", crafts:["Sohrai Painting", "Dhokra", "Bamboo Craft"], image:IMG.terracotta, cities:"Hazaribagh · Ranchi · Khunti"},
  {name:"Karnataka", code:"IN-KA", capital:"Bengaluru", crafts:["Mysore Painting", "Sandalwood Carving", "Kasuti Embroidery"], image:"/images/wc5.jpg", cities:"Mysuru · Channapatna · Bengaluru"},
  {name:"Kerala", code:"IN-KL", capital:"Thiruvananthapuram", crafts:["Coir Craft", "Aranmula Metal Mirror", "Wood Carving"], image:"/images/wc4.jpg", cities:"Alappuzha · Aranmula · Thrissur"},
  {name:"Madhya Pradesh", code:"IN-MP", capital:"Bhopal", crafts:["Gond Painting", "Chanderi Weaving", "Bagh Print"], image:"/images/textile3.jpg", cities:"Bhopal · Chanderi · Dhar"},
  {name:"Maharashtra", code:"IN-MH", capital:"Mumbai", crafts:["Warli Painting", "Paithani", "Sawantwadi Craft"], image:"/images/textile6.jpg", cities:"Palghar · Paithan · Sawantwadi"},
  {name:"Manipur", code:"IN-MN", capital:"Imphal", crafts:["Wangkhei Phee", "Cane & Bamboo", "Handloom Weaving"], image:"/images/textile2.jpg", cities:"Imphal · Andro · Bishnupur"},
  {name:"Meghalaya", code:"IN-ML", capital:"Shillong", crafts:["Cane & Bamboo", "Eri Silk", "Khasi Weaving"], image:"/images/hd6.jpg", cities:"Shillong · Jaintia Hills · Tura"},
  {name:"Mizoram", code:"IN-MZ", capital:"Aizawl", crafts:["Bamboo Craft", "Puan Textiles", "Cane Weaving"], image:"/images/textile4.jpg", cities:"Aizawl · Lunglei · Serchhip"},
  {name:"Nagaland", code:"IN-NL", capital:"Kohima", crafts:["Naga Shawls", "Cane & Bamboo", "Wood Carving"], image:"/images/textile5.jpg", cities:"Kohima · Dimapur · Mon"},
  {name:"Odisha", code:"IN-OR", capital:"Bhubaneswar", crafts:["Pattachitra", "Appliqué", "Silver Filigree"], image:IMG.bowls, cities:"Raghurajpur · Pipili · Cuttack"},
  {name:"Punjab", code:"IN-PB", capital:"Chandigarh", crafts:["Phulkari", "Punjabi Jutti", "Durrie Weaving"], image:"/images/textile1.jpg", cities:"Patiala · Amritsar · Ludhiana"},
  {name:"Rajasthan", code:"IN-RJ", capital:"Jaipur", crafts:["Blue Pottery", "Hand Block Printing", "Lac Craft", "Miniature Painting"], image:IMG.blue, cities:"Jaipur · Jodhpur · Udaipur"},
  {name:"Sikkim", code:"IN-SK", capital:"Gangtok", crafts:["Carpet Weaving", "Thangka Painting", "Cane & Bamboo"], image:"/images/textile6.jpg", cities:"Gangtok · Namchi · Pelling"},
  {name:"Tamil Nadu", code:"IN-TN", capital:"Chennai", crafts:["Tanjore Painting", "Bronze Icons", "Kanchipuram Silk"], image:"/images/metalcraft1.jpg", cities:"Thanjavur · Kanchipuram · Swamimalai"},
  {name:"Telangana", code:"IN-TG", capital:"Hyderabad", crafts:["Pochampally Ikat", "Cheriyal Painting", "Bidri Craft"], image:"/images/textile3.jpg", cities:"Pochampally · Hyderabad · Nirmal"},
  {name:"Tripura", code:"IN-TR", capital:"Agartala", crafts:["Bamboo Craft", "Cane Weaving", "Handloom Textiles"], image:"/images/hd6.jpg", cities:"Agartala · Kailashahar · Udaipur"},
  {name:"Uttar Pradesh", code:"IN-UP", capital:"Lucknow", crafts:["Chikankari", "Moradabad Metalcraft", "Saharanpur Woodcraft", "Khurja Pottery"], image:"/images/wc1.jpg", cities:"Lucknow · Moradabad · Saharanpur · Khurja"},
  {name:"Uttarakhand", code:"IN-UT", capital:"Dehradun", crafts:["Ringaal Bamboo Craft", "Aipan Art", "Wool Weaving"], image:"/images/wc2.jpg", cities:"Almora · Nainital · Dehradun"},
  {name:"West Bengal", code:"IN-WB", capital:"Kolkata", crafts:["Kantha", "Bankura Terracotta", "Dokra", "Patachitra"], image:IMG.terracotta, cities:"Bishnupur · Bankura · Kolkata"},
];

export const INDIA_UTS = [
  {name:"Andaman & Nicobar Islands", code:"IN-AN", crafts:["Cane & Bamboo", "Shell Craft"]},
  {name:"Chandigarh", code:"IN-CH", crafts:["Phulkari", "Durrie Weaving"]},
  {name:"Dadra & Nagar Haveli and Daman & Diu", code:"IN-DN", crafts:["Warli-inspired Art", "Bamboo Craft"]},
  {name:"Delhi", code:"IN-DL", crafts:["Zari Zardozi", "Hand Embroidery"]},
  {name:"Jammu & Kashmir", code:"IN-JK", crafts:["Kashmiri Embroidery", "Sozni", "Papier-mâché"]},
  {name:"Ladakh", code:"IN-LA", crafts:["Wool Weaving", "Thangka", "Carpet Weaving"]},
  {name:"Lakshadweep", code:"IN-LD", crafts:["Coir Craft", "Coconut Craft"]},
  {name:"Puducherry", code:"IN-PY", crafts:["Papier-mâché", "Terracotta", "Handmade Textiles"]},
];

export const INDIA_MAP_POSITIONS = {
  "Jammu & Kashmir":[31,12], "Himachal Pradesh":[36,20], "Punjab":[30,24], "Uttarakhand":[42,28], "Haryana":[30,29], "Rajasthan":[23,36], "Uttar Pradesh":[43,35], "Sikkim":[69,32], "Arunachal Pradesh":[87,32], "Assam":[84,38], "Nagaland":[91,38], "Meghalaya":[80,42], "Bihar":[62,40], "West Bengal":[67,47], "Gujarat":[17,48], "Madhya Pradesh":[41,46], "Jharkhand":[60,47], "Tripura":[77,49], "Mizoram":[87,49], "Chhattisgarh":[49,52], "Maharashtra":[27,58], "Odisha":[50,55], "Telangana":[46,66], "Goa":[19,70], "Karnataka":[26,75], "Andhra Pradesh":[38,70], "Tamil Nadu":[34,83], "Kerala":[23,87]
};



export const REGIONAL_CRAFT_IMAGE_RULES = [
  { keys:["pottery","ceramic","terracotta","clay","toy"], category:"Ceramics", images:PRODUCT_IMAGES.ceramics },
  { keys:["metal","brass","bronze","bidri","dhokra","filigree","mirror"], category:"Metalcraft", images:PRODUCT_IMAGES.metalcraft },
  { keys:["wood","carving","sandalwood","lacquer","furniture","toy"], category:"Woodcraft", images:PRODUCT_IMAGES.woodcraft },
  { keys:["textile","silk","weaving","weave","embroidery","ikat","kantha","phulkari","shawl","rumal","jamdani","bandhani","print","jutti","leather"], category:"Textiles", images:PRODUCT_IMAGES.textiles },
  { keys:["painting","art","pattachitra","kalamkari","thangka","madhubani","warli","gond","sohrai","aipan","rogan"], category:"Home Décor", images:PRODUCT_IMAGES.homeDecor },
  { keys:["bamboo","cane","coir","grass","basket","shell","fiber","fibre"], category:"Home Décor", images:PRODUCT_IMAGES.homeDecor },
];

export const regionalImageFor = (craft, index) => {
  const normalized = craft.toLowerCase();
  const rule = REGIONAL_CRAFT_IMAGE_RULES.find(r=>r.keys.some(k=>normalized.includes(k))) || REGIONAL_CRAFT_IMAGE_RULES[4];
  return { category:rule.category, image:rule.images[index % rule.images.length] };
};
