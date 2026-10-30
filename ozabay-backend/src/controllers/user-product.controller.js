import UserProduct from "../models/user-product.model.js";

const normalizeProductEntry = (entry) => {
  if (typeof entry === "string" || typeof entry === "number") {
    return { productId: String(entry), qty: 1, data: null };
  }

  const qty =
    Number.isFinite(entry?.qty) && entry.qty > 0 ? Math.floor(entry.qty) : 1;
  return {
    productId: String(entry.id ?? entry.productId ?? ""),
    qty,
    data: entry,
  };
};

const listUserProducts = async (req, res, next) => {
  try {
    const productType = req.query.type === "favorites" ? "favorites" : "cart";
    const rows = await UserProduct.find({
      userId: req.authUserId,
      productType,
    }).lean();

    return res
      .status(200)
      .json({
        ids: rows.map((row) => row.productId),
        products: rows.map((row) =>
          row.data ?? {
            id: row.productId,
            qty: row.qty,
          },
        ),
      });
  } catch (error) {
    return next(error);
  }
};

const saveUserProducts = async (req, res, next) => {
  try {
    const productType =
      req.body.type === "favorites" ? "favorites" : "cart";
    const entries = Array.isArray(req.body.products) ? req.body.products : [];
    const normalized = entries
      .map((entry) => normalizeProductEntry(entry))
      .filter((entry) => /^\S{1,120}$/.test(entry.productId));

    // Keep only the last occurrence of each product in the payload.
    const deduped = [...new Map(normalized.map((entry) => [entry.productId, entry])).values()];

    if (deduped.length) {
      await UserProduct.bulkWrite(
        deduped.map(({ productId, qty, data }) => ({
          updateOne: {
            filter: {
              userId: req.authUserId,
              productType,
              productId,
            },
            update: { $set: { qty, data } },
            upsert: true,
          },
        })),
      );
    }

    await UserProduct.deleteMany({
      userId: req.authUserId,
      productType,
      ...(deduped.length
        ? { productId: { $nin: deduped.map((entry) => entry.productId) } }
        : {}),
    });

    return res.status(200).json({ saved: deduped.length });
  } catch (error) {
    return next(error);
  }
};

export { listUserProducts, saveUserProducts };
