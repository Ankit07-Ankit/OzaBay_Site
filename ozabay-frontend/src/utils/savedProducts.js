import { readAccount } from "./customerSession.js";

const serializeProductForSync = (product) =>
  typeof product === "string"
    ? product
    : {
        id: product?.id,
        qty: Number.isInteger(product?.qty) ? product.qty : 1,
        data: product,
      };

const normalizeRemoteProduct = (entry) => {
  if (!entry || typeof entry === "string") return null;
  const item = entry.data ?? entry;
  if (!item?.id) return null;
  return { ...item, qty: entry.qty ?? item.qty ?? 1 };
};

const remoteProductList = (entries) =>
  (Array.isArray(entries) ? entries : [])
    .map(normalizeRemoteProduct)
    .filter(Boolean);

// Local items win on duplicate ids; server-only items are appended.
const mergeSavedProducts = (local, remote) => {
  const localIds = new Set(local.map((item) => String(item?.id ?? item)));
  return [
    ...local,
    ...remoteProductList(remote).filter(
      (item) => !localIds.has(String(item.id)),
    ),
  ];
};

const savedProductsStorageKey = (type, accountId) =>
  `ozabay-${type === "cart" ? "cart" : "wishlist"}-${accountId}`;

const guestSavedProductsStorageKey = (type) =>
  `ozabay-guest-${type === "cart" ? "cart" : "wishlist"}`;

const getCachedSavedProducts = (type, accountId = readAccount()?.id) => {
  try {
    const storageKey = accountId
      ? savedProductsStorageKey(type, accountId)
      : guestSavedProductsStorageKey(type);
    const products = JSON.parse(localStorage.getItem(storageKey) || "[]");
    if (!Array.isArray(products)) return [];
    return type === "favorites" ? products.map(String) : products.filter((item) => item?.id);
  } catch {
    return [];
  }
};

// Keep writes from one browser in order and bound to the account that initiated them.
const pendingSaves = new Map();
const syncSavedProductsToServer = (request, owner, cart, favorites) => {
  const previous = pendingSaves.get(owner) || Promise.resolve();
  const save = previous.then(async () => {
    if (readAccount()?.id !== owner) return;
    await Promise.all(Object.entries({ cart, favorites }).map(async ([type, products]) => {
      await request("/me/products", {
        method: "POST",
        body: JSON.stringify({ type, products: products.map(serializeProductForSync) }),
      });
      rememberServerList(type, owner, products);
    }));
  }).catch((error) => console.warn("Failed to sync saved products:", error.message));
  pendingSaves.set(owner, save);
  save.finally(() => {
    if (pendingSaves.get(owner) === save) pendingSaves.delete(owner);
  });
  return save;
};

// Loads the server-side snapshot for a type. Returns `{ ids, products }`
// (ids are plain product-id strings, products are the full stored objects),
// or null when there is no signed-in account or the request fails.
const fetchUserProducts = async (type, requestAuthenticatedApi) => {
  const account = readAccount();
  if (!account?.id) return null;

  try {
    const result = await requestAuthenticatedApi(`/me/products?type=${type}`);
    return {
      ids: Array.isArray(result.ids) ? result.ids : [],
      products: remoteProductList(result.products),
    };
  } catch (error) {
    console.warn(`Failed to load saved ${type}:`, error.message);
    return null;
  }
};


const itemId = (item) => String(item?.id ?? item);
const itemQuantity = (item) => item?.qty ?? 1;
const baselineKey = (type, owner) => savedProductsStorageKey(type, owner) + "-synced";

function rememberServerList(type, owner, products) {
  localStorage.setItem(baselineKey(type, owner), JSON.stringify(products.map((item) => [itemId(item), itemQuantity(item)])));
}

// Apply only this browser's unsynced edits over the latest server list.
// This also imports legacy and guest items the first time an account syncs.
function reconcileSavedProducts(local, remote, baseline) {
  const result = new Map(remote.map((item) => [itemId(item), item]));
  const localIds = new Set(local.map(itemId));
  for (const key of baseline.keys()) {
    if (!localIds.has(key)) result.delete(key);
  }
  for (const item of local) {
    if (baseline.get(itemId(item)) !== itemQuantity(item)) result.set(itemId(item), item);
  }
  return [...result.values()];
}

function readBaseline(type, owner) {
  try { return new Map(JSON.parse(localStorage.getItem(baselineKey(type, owner))) || []); }
  catch { return new Map(); }
}

export {
  fetchUserProducts, getCachedSavedProducts, guestSavedProductsStorageKey, mergeSavedProducts,
  readBaseline, reconcileSavedProducts, rememberServerList, savedProductsStorageKey, syncSavedProductsToServer,
};
