export function money(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN")}`;
}
