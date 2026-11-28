export const normalizeAccount = (account) => {
  if (!account) return null;
  const { _id, ...rest } = account;
  return { ...rest, id: account.id || _id };
};

export const readAccount = () => {
  try {
    return normalizeAccount(JSON.parse(localStorage.getItem("ozabay-account")));
  } catch {
    return null;
  }
};

export function checkoutFor(account) {
  const customer = account?.accountType === "user" ? account : {};
  const location = customer.deliveryLocation || {};
  return {
    name: location.fullName || customer.name || "",
    email: customer.email || "",
    phone: location.mobile || "",
    address: [...new Set([location.building, location.area, location.address].filter(Boolean))].join(", "),
    city: location.city || "",
    pincode: location.pincode || "",
    payment: "Cash on delivery",
  };
}

export async function checkoutAttempt(accountId, payload, storage = sessionStorage) {
  const key = `ozabay-checkout-${accountId}`;
  const items = [...payload.items].sort((first, second) => first.productId.localeCompare(second.productId));
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ ...payload, items })));
  const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const previous = storage.getItem(key);
  if (previous?.startsWith(fingerprint + ":")) return previous.slice(fingerprint.length + 1);
  const id = crypto.randomUUID();
  storage.setItem(key, fingerprint + ":" + id);
  return id;
}
