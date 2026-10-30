import { PRODUCT_IMAGES } from "../assets.js";

export const BASE_PRODUCTS = [
  ["Mitti Sculptural Vase", "Ceramics", 3800, PRODUCT_IMAGES.ceramics[0], "Jaipur", "Meera Kumari"],
  ["Jaipur Blue Pottery Vase", "Blue Pottery", 6900, PRODUCT_IMAGES.bluePottery[0], "Jaipur", "Aarav Khan"],
  ["Neel Indigo Bowl Set", "Ceramics", 4200, PRODUCT_IMAGES.ceramics[1], "Khurja", "Farida Ansari"],
  ["Mitti Hand-Finished Bowl", "Ceramics", 3250, PRODUCT_IMAGES.ceramics[2], "Jaipur", "Meera Kumari"],
  ["Rekh Artisan Bowl", "Ceramics", 1650, PRODUCT_IMAGES.ceramics[3], "Khurja", "Raghav Sharma"],
  ["Aaroh Sculptural Vessel", "Terracotta", 2950, PRODUCT_IMAGES.terracotta[0], "Molela", "Devendra Prajapat"],
  ["Surya Blue Serving Platter", "Blue Pottery", 4800, PRODUCT_IMAGES.bluePottery[1], "Jaipur", "Aarav Khan"],
  ["Neel Lotus Dessert Plate", "Blue Pottery", 2200, PRODUCT_IMAGES.bluePottery[2], "Jaipur", "Aarav Khan"],
  ["Gulabi Hand-Painted Jar", "Blue Pottery", 3600, PRODUCT_IMAGES.bluePottery[3], "Jaipur", "Meera Kumari"],
  ["Chandni Indigo Carafe", "Ceramics", 3900, PRODUCT_IMAGES.ceramics[4], "Khurja", "Farida Ansari"],
  ["Dhoop Terracotta Planter", "Terracotta", 2400, PRODUCT_IMAGES.terracotta[1], "Molela", "Devendra Prajapat"],
  ["Mitti Ripple Planter", "Terracotta", 2800, PRODUCT_IMAGES.terracotta[2], "Molela", "Devendra Prajapat"],
  ["Kansa Dawn Tumbler Set", "Metalcraft", 5200, PRODUCT_IMAGES.metalcraft[0], "Moradabad", "Raghav Sharma"],
  ["Rekh Hammered Brass Bowl", "Metalcraft", 4400, PRODUCT_IMAGES.metalcraft[1], "Moradabad", "Raghav Sharma"],
  ["Suraj Brass Candle Holder", "Metalcraft", 3100, PRODUCT_IMAGES.metalcraft[2], "Moradabad", "Raghav Sharma"],
  ["Noor Kansa Thali", "Metalcraft", 7600, PRODUCT_IMAGES.metalcraft[3], "Moradabad", "Raghav Sharma"],
  ["Ganga Handloom Runner", "Textiles", 2850, PRODUCT_IMAGES.textiles[0], "Varanasi", "Farida Ansari"],
  ["Mogra Block-Print Cushion", "Textiles", 1450, PRODUCT_IMAGES.textiles[1], "Jaipur", "Sana Sheikh"],
  ["Neel Indigo Table Runner", "Textiles", 2350, PRODUCT_IMAGES.textiles[2], "Bagru", "Sana Sheikh"],
  ["Kashvi Handwoven Throw", "Textiles", 4900, PRODUCT_IMAGES.textiles[3], "Kutch", "Farida Ansari"],
  ["Rangrez Cotton Napkin Set", "Textiles", 1250, PRODUCT_IMAGES.textiles[4], "Bagru", "Sana Sheikh"],
  ["Gulnaar Loom Cushion Pair", "Textiles", 2100, PRODUCT_IMAGES.textiles[5], "Varanasi", "Farida Ansari"],
  ["Neem Carved Serving Board", "Woodcraft", 3300, PRODUCT_IMAGES.woodcraft[0], "Saharanpur", "Imran Qureshi"],
  ["Aranya Teak Tray", "Woodcraft", 4200, PRODUCT_IMAGES.woodcraft[1], "Saharanpur", "Imran Qureshi"],
  ["Koyal Carved Candle Stand", "Woodcraft", 1950, PRODUCT_IMAGES.woodcraft[2], "Saharanpur", "Imran Qureshi"],
  ["Vanam Wooden Bowl", "Woodcraft", 2700, PRODUCT_IMAGES.woodcraft[3], "Kerala", "Anil Menon"],
  ["Sandalwood Keepsake Box", "Woodcraft", 3650, PRODUCT_IMAGES.woodcraft[4], "Mysuru", "Anil Menon"],
  ["Kashish Carved Mirror Frame", "Woodcraft", 5800, PRODUCT_IMAGES.woodcraft[5], "Saharanpur", "Imran Qureshi"],
  ["Aangan Stoneware Lamp", "Home Décor", 6200, PRODUCT_IMAGES.homeDecor[0], "Khurja", "Farida Ansari"],
  ["Chaand Ceramic Incense Holder", "Home Décor", 1350, PRODUCT_IMAGES.homeDecor[1], "Jaipur", "Meera Kumari"],
  ["Raat Indigo Table Lamp", "Home Décor", 5400, PRODUCT_IMAGES.homeDecor[2], "Khurja", "Farida Ansari"],
  ["Mitti Sculptural Candle Trio", "Home Décor", 2400, PRODUCT_IMAGES.homeDecor[3], "Molela", "Devendra Prajapat"],
  ["Gulab Stoneware Vase", "Home Décor", 4550, PRODUCT_IMAGES.homeDecor[4], "Khurja", "Meera Kumari"],
  ["Aaranya Reed Basket", "Home Décor", 3150, PRODUCT_IMAGES.homeDecor[5], "Assam", "Sana Sheikh"],
  ["Neel Hand-Painted Urn", "Home Décor", 5900, PRODUCT_IMAGES.homeDecor[6], "Jaipur", "Aarav Khan"],
  ["Dastkaar Wall Plate", "Home Décor", 2750, PRODUCT_IMAGES.homeDecor[7], "Jaipur", "Meera Kumari"],
  ["Mitti Hand-Thrown Urn", "Ceramics", 4100, PRODUCT_IMAGES.ceramics[5], "Jaipur", "Meera Kumari"],
  ["Jal Neel Lotus Bowl", "Blue Pottery", 2950, PRODUCT_IMAGES.bluePottery[4], "Jaipur", "Aarav Khan"],
  ["Moradabad Hammered Lota", "Metalcraft", 3950, PRODUCT_IMAGES.metalcraft[4], "Moradabad", "Raghav Sharma"],
  ["Molela Earth Planter", "Terracotta", 2600, PRODUCT_IMAGES.terracotta[3], "Molela", "Devendra Prajapat"],
  ["Molela Sun Vessel", "Terracotta", 3450, PRODUCT_IMAGES.terracotta[4], "Molela", "Devendra Prajapat"],
  ["Blue Pottery Accent Plate", "Blue Pottery", 3200, PRODUCT_IMAGES.bluePottery[5], "Jaipur", "Aarav Khan"],
].map(([name, category, price, image, city, artisan], i) => ({
  id: i + 1,
  name,
  category,
  priceValue: price,
  price: `₹${price.toLocaleString("en-IN")}`,
  image,
  city,
  artisan,
  material:
    category === "Metalcraft"
      ? "Brass / Kansa"
      : category === "Textiles"
      ? "Handwoven cotton"
      : category === "Woodcraft"
      ? "Indian hardwood"
      : category === "Terracotta"
      ? "Fired earth"
      : category === "Home Décor"
      ? "Mixed natural materials"
      : "Ceramic clay",
  description:
    "A small-batch handmade piece from an independent Indian maker. Natural variation is part of its character.",
  rating: (4.6 + (i % 4) * 0.1).toFixed(1),
  dimensions: ["12 × 8 in", "10 × 10 in", "16 × 16 in"][i % 3],
  care: category === "Textiles" ? "Gentle dry clean" : "Wipe with a soft dry cloth",
  story: `Shaped in ${city} and finished by ${artisan}. The piece carries small marks of the hand, making every edition subtly different.`,
}));


// Product data supplied in the Gninee Gems Web Upload workbook.
