import https from "https";

const nominatimUrl = "https://nominatim.openstreetmap.org/reverse";

const geocodeLocation = async (req, res) => {
  const { lat, lng } = req.body;

  if (lat === undefined || lat === null || lng === undefined || lng === null) {
    return res.status(400).json({ message: "Latitude and longitude are required" });
  }

  const url = new URL(nominatimUrl);
  url.searchParams.append("lat", lat);
  url.searchParams.append("lon", lng);
  url.searchParams.append("format", "json");
  url.searchParams.append("addressdetails", "1");
  url.searchParams.append("zoom", "16");

  try {
    const nominatimResponse = await new Promise((resolve, reject) => {
      let data = "";
      const request = https.get(url.toString(), {
        headers: {
          "User-Agent": "OzaBay/1.0 (https://ozabay.com; support@ozabay.com)",
          "Accept": "application/json",
        },
      }, (response) => {
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            const result = JSON.parse(data);
            if (result.error || !result.address) {
              return reject(new Error(result.error || "Unable to geocode this location"));
            }
            resolve(result);
          } catch (error) {
            reject(error);
          }
        });
      });
      request.on("error", (error) => {
        reject(error);
      });
      request.setTimeout(10000, () => {
        request.destroy(new Error("Geocoding request timed out"));
      });
    });

    const {
      address: {
        house_number, road, suburb, village, town, city, county, state, postcode, country,
      } = {},
    } = nominatimResponse;

    return res.json({
      lat,
      lng,
      fullAddress: `${house_number ? house_number + " " : ""}${road || ""}${suburb ? ", " + suburb : ""}${town ? ", " + town : ""}${city ? ", " + city : ""}${state ? ", " + state : ""}${postcode ? ", " + postcode : ""}${country ? ", " + country : ""}`.trim(),
      building: house_number ? `${house_number} ${road || ""}` : road || suburb || town || city || country,
      area: suburb || village,
      locality: suburb || village,
      city: city || town,
      state: state || county,
      pincode: postcode,
      country: country || "",
    });
  } catch (error) {
    console.error("Geocoding error:", error.message);
    return res.status(500).json({ message: "Geocoding service unavailable" });
  }
};

export { geocodeLocation };