export const NAV_LINKS = [
  { id: "shop",            label: "Shop",            href: "/shop" },
  { id: "collections",    label: "Collections",     href: "/collections" },
  { id: "artisans",       label: "Artisans",        href: "/artisans" },
  { id: "create-your-own",label: "Create Your Own", href: "/create-your-own" },
  { id: "journal",        label: "Journal",         href: "/journal" },
  { id: "about",          label: "About",           href: "/about" },
  { id: "corporate",      label: "Corporate Gifts", href: "/corporate" },
  { id: "support",        label: "Support",         href: "/support" },
];

// Shown ONLY when in Vendor Mode — contains strictly vendor studio facilities, NO customer shop links
export const VENDOR_NAV_LINKS = [
  { id: "dashboard",   label: "Studio",         href: "#vendor-dashboard" },
  { id: "listings",    label: "My Listings",    href: "#vendor-product-list" },
  { id: "add-product", label: "+ Add Piece",    href: "#vendor-product-form" },
  { id: "locations",   label: "Shop Locations", href: "#vendor-locations" },
  { id: "analytics",   label: "Analytics",      href: "#vendor-analytics" },
  { id: "orders",      label: "Orders & Sales", href: "#vendor-orders" },
];
