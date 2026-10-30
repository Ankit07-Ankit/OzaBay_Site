import { INDIA_CRAFTS, regionalImageFor } from "./regionalCrafts.js";

export const REGIONAL_CRAFT_PRODUCTS = INDIA_CRAFTS.flatMap((state, stateIndex) => state.crafts.map((craft, craftIndex) => {
  const {category,image}=regionalImageFor(craft, stateIndex + craftIndex);
  const price = 1650 + ((stateIndex * 577 + craftIndex * 911) % 5600);
  return {
    id:1000 + stateIndex * 10 + craftIndex,
    name:`${craft} · ${state.name}`,
    category,
    priceValue:price,
    price:`₹${price.toLocaleString("en-IN")}`,
    image,
    city:state.cities.split(" · ")[craftIndex % state.cities.split(" · ").length],
    artisan:`OzaBay ${state.name} Craft Edit`,
    material: category === "Textiles" ? "Handcrafted textile" : category === "Metalcraft" ? "Hand-finished metal" : category === "Woodcraft" ? "Carved Indian wood" : category === "Ceramics" ? "Hand-shaped clay" : "Natural craft materials",
    description:`A regional OzaBay craft edit inspired by ${craft} from ${state.name}. Each piece celebrates the material, technique and visual language of the region.`,
    rating:(4.7 + ((stateIndex + craftIndex) % 3) * 0.1).toFixed(1),
    dimensions:["12 × 8 in","10 × 10 in","16 × 16 in"][craftIndex % 3],
    care: category === "Textiles" ? "Gentle dry clean" : "Wipe with a soft dry cloth",
    story:`Regional craft edit · ${craft} · ${state.name}. This listing is part of OzaBay's state-wise craft discovery catalogue.`,
    regional:true,
    state:state.name,
    craft,
  };
}));
