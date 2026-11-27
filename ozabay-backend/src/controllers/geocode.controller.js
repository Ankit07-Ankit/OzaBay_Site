import Joi from "joi";
import config from "../config/config.js";

const nominatimUrl = "https://nominatim.openstreetmap.org/reverse";
const requestTimeoutMs = 10000;
const cacheTtlMs = 24 * 60 * 60 * 1000;
const maxCacheEntries = 500;
const geocodeCache = new Map();
let nominatimQueue = Promise.resolve();
let lastNominatimRequestAt = 0;

const coordinatesSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const readCachedAddress = (key) => {
  const cached = geocodeCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    geocodeCache.delete(key);
    return null;
  }
  return cached.value;
};

const cacheAddress = (key, value) => {
  if (geocodeCache.size >= maxCacheEntries) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey !== undefined) geocodeCache.delete(oldestKey);
  }
  geocodeCache.set(key, { value, expiresAt: Date.now() + cacheTtlMs });
};

const requestNominatim = (url) => {
  const request = nominatimQueue.then(async () => {
    const delayMs = Math.max(0, 1000 - (Date.now() - lastNominatimRequestAt));
    if (delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    lastNominatimRequestAt = Date.now();
    return fetch(url, {
      headers: {
        "User-Agent": `OzaBay/1.0 (+https://ozabay.com; contact: ${config.EMAIL_REPLY_TO || config.GOOGLE_USER})`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
  });
  nominatimQueue = request.then(() => undefined, () => undefined);
  return request;
};

const geocodeLocation = async (req, res) => {
  const { error, value } = coordinatesSchema.validate(req.body, {
    abortEarly: true,
    convert: true,
  });
  if (error) {
    return res.status(400).json({
      message: "Valid latitude and longitude are required.",
    });
  }

  const { lat, lng } = value;
  const cacheKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  const cached = readCachedAddress(cacheKey);
  if (cached) {
    return res.status(200).json({ ...cached, lat, lng });
  }

  const url = new URL(nominatimUrl);
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("zoom", "18");

  try {
    const response = await requestNominatim(url);
    if (!response.ok) {
      console.error("Nominatim reverse geocoding failed:", response.status);
      return res.status(503).json({
        message: "Location lookup is temporarily unavailable. Enter the address manually.",
      });
    }

    const result = await response.json();
    if (result.error || !result.address) {
      return res.status(422).json({
        message: "No street address was found for this location. Enter it manually.",
      });
    }

    const {
      house_number,
      road,
      suburb,
      village,
      town,
      city,
      county,
      state,
      postcode,
      country,
    } = result.address;
    const address = {
      fullAddress:
        `${house_number ? `${house_number} ` : ""}${road || ""}${suburb ? `, ${suburb}` : ""}${town ? `, ${town}` : ""}${city ? `, ${city}` : ""}${state ? `, ${state}` : ""}${postcode ? `, ${postcode}` : ""}${country ? `, ${country}` : ""}`.trim(),
      building: house_number
        ? `${house_number} ${road || ""}`.trim()
        : road || suburb || town || city || country || "",
      area: suburb || village || "",
      locality: suburb || village || "",
      city: city || town || "",
      state: state || county || "",
      pincode: postcode || "",
      country: country || "",
    };

    cacheAddress(cacheKey, address);
    return res.status(200).json({ lat, lng, ...address });
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return res.status(503).json({
      message: "Location lookup is temporarily unavailable. Enter the address manually.",
    });
  }
};

export { geocodeLocation };
