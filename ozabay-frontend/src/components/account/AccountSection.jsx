import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { money } from "../../utils/formatCurrency.js";
import "./AccountSection.css";

function passwordScore(value) {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value) || /[^A-Za-z0-9]/.test(value)) score += 1;
  return score;
}

const strengthLabels = ["", "Fragile", "Fair", "Strong", "Masterpiece-grade"];
const customerTabs = ["Profile", "Favorites", "Bag", "Delivery Location", "Orders"];
const vendorTabs = ["Profile", "My Products"];

const emptyLocation = (name = "") => ({
  building: "",
  area: "",
  locality: "",
  city: "",
  state: "",
  pincode: "",
  fullName: name,
  mobile: "",
  alternateMobile: "",
  latitude: "",
  longitude: "",
  mapLink: "",
});

const locationToForm = (savedLocation, name = "") => ({
  ...emptyLocation(name),
  ...savedLocation,
  latitude: savedLocation?.latitude ?? "",
  longitude: savedLocation?.longitude ?? "",
});

export default function AccountSection({
  account,
  favorites = [],
  bag = [],
  bagTotal = 0,
  isVendor = false,
  vendorProducts = [],
  vendorProductsLoaded = false,
  onSaveProfile,
  onSaveLocation,
  onRemoveFavorite,
  onRemoveBag,
  onUpdateQuantity,
  onAddToBag,
  onBuyNow,
  onOpenVendorPanel,
  onLogout,
  orders = [],
}) {
  // Vendors do not shop — favorites, bag and delivery are hidden from their panel.
  const tabs = isVendor ? vendorTabs : customerTabs;
  const [activeTab, setActiveTab] = useState("Profile");
  const [profile, setProfile] = useState({
    name: account.name || "",
    email: account.email || "",
    currentPassword: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const tabsRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicator, setIndicator] = useState({ translateX: 0, width: 0 });
  const passwordScoreValue = passwordScore(profile.password);
  const dirty =
    profile.name !== (account.name || "") ||
    profile.email.trim().toLowerCase() !== (account.email || "").toLowerCase() ||
    Boolean(profile.currentPassword || profile.password);

  useEffect(() => {
    if (!confirmLogout) return undefined;
    const onKey = (event) => {
      if (event.key === "Escape") setConfirmLogout(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmLogout]);

  useEffect(() => {
    // Clear stale refs when tab list changes (vendor <-> user)
    tabRefs.current = tabRefs.current.slice(0, tabs.length);
  }, [tabs]);

  useLayoutEffect(() => {
    const buttons = tabRefs.current;
    const activeIndex = tabs.indexOf(activeTab);
    const activeButton = buttons[activeIndex];
    if (!activeButton) return;
    const nav = tabsRef.current;
    const navLeft = nav ? nav.getBoundingClientRect().left : 0;
    setIndicator({
      translateX: activeButton.getBoundingClientRect().left - navLeft,
      width: activeButton.offsetWidth,
    });

    const onResize = () => {
      const activeButton = tabRefs.current[tabs.indexOf(activeTab)];
      if (!activeButton) return;
      const nav = tabsRef.current;
      const navLeft = nav ? nav.getBoundingClientRect().left : 0;
      setIndicator({
        translateX: activeButton.getBoundingClientRect().left - navLeft,
        width: activeButton.offsetWidth,
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [activeTab, tabs]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setError("");
    setMessage("");
    setConfirmLogout(false);
  };

  const onTabsKeyDown = (event) => {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const index = tabs.indexOf(activeTab);
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % tabs.length
        : (index - 1 + tabs.length) % tabs.length;
    const buttons = tabRefs.current;
    if (buttons?.[next]) {
      buttons[next].focus();
      selectTab(tabs[next]);
    }
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    if (
      profile.email.trim().toLowerCase() !== (account.email || "").toLowerCase()
      && !profile.currentPassword
    ) {
      setError("Enter your current password to change your email address.");
      return;
    }
    setBusy(true);
    try {
      const payload = { name: profile.name.trim(), email: profile.email.trim() };
      if (profile.currentPassword) payload.currentPassword = profile.currentPassword;
      if (profile.password) {
        payload.password = profile.password;
      }
      await onSaveProfile(payload);
      setProfile((current) => ({ ...current, currentPassword: "", password: "" }));
      setMessage("Your account details have been updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await onLogout();
    } catch (logoutRequestError) {
      setLogoutError(logoutRequestError.message);
    } finally {
      setConfirmLogout(false);
    }
  };

  const initials = (account.name || "O")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  const savedLocations = account.deliveryLocations?.length
    ? account.deliveryLocations
    : account.deliveryLocation
      ? [account.deliveryLocation]
      : [];
  const selectedLocationIndex = Math.max(
    0,
    savedLocations.findIndex(
      (savedLocation) =>
        savedLocation?._id &&
        String(savedLocation._id) === String(account.deliveryLocation?._id),
    ),
  );
  const [location, setLocation] = useState(() =>
    locationToForm(account.deliveryLocation || savedLocations[0], account.name),
  );
  const [mapLink, setMapLink] = useState(account.deliveryLocation?.mapLink || "");
  const [locating, setLocating] = useState(false);
  const [hasCoordinates, setHasCoordinates] = useState(
    account.deliveryLocation?.latitude !== undefined &&
      account.deliveryLocation?.latitude !== null &&
      account.deliveryLocation?.longitude !== undefined &&
      account.deliveryLocation?.longitude !== null,
  );
  const [hasSavedLocation, setHasSavedLocation] = useState(Boolean(account.deliveryLocation));
  const [editingLocationIndex, setEditingLocationIndex] = useState(
    savedLocations.length ? null : -1,
  );
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(16);

  useEffect(() => {
    const savedLocation = account.deliveryLocation || account.deliveryLocations?.[0];
    setLocation(locationToForm(savedLocation, account.name));
    setMapLink(savedLocation?.mapLink || "");
    setHasCoordinates(Boolean(
      savedLocation?.latitude !== undefined && savedLocation?.latitude !== null &&
        savedLocation?.longitude !== undefined && savedLocation?.longitude !== null,
    ));
    setHasSavedLocation(Boolean(savedLocation));
  }, [account.deliveryLocation, account.deliveryLocations, account.name]);

  const handleCurrentLocation = async () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      setLocating(false);
      return;
    }
    setLocating(true);
    setError("");
    setMapCenter(null);
    setMapZoom(16);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      });

      const { latitude, longitude } = position.coords;

      const response = await fetch("/api/geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat: latitude, lng: longitude }),
      });

      const geocodeData = await response.json();

      if (!response.ok) {
        throw new Error(geocodeData.message || "Geocoding failed");
      }

      const { building, area, locality, city, state, pincode } = geocodeData;

      setLocation((current) => ({
        ...current,
        latitude: String(latitude),
        longitude: String(longitude),
        building: building || "",
        area: area || "",
        locality: locality || "",
        city: city || "",
        state: state || "",
        pincode: pincode || "",
      }));

      setMapCenter({ lat: latitude, lng: longitude });
      setHasCoordinates(true);
      setIsSelectingLocation(true);
      setError("");
      setMessage("Map preview opened with your current location. Confirm the address and save it below.");
    } catch (error) {
      setError(error.message || "Geocoding failed. Please enter the address manually.");
      setIsSelectingLocation(false);
    } finally {
      setLocating(false);
    }
  };

  const handleMapLinkLocation = () => {
    const coordinateMatch = mapLink.match(
      /@([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)|!3d([-+]?\d+(?:\.\d+)?)!4d([-+]?\d+(?:\.\d+)?)|[?&](?:q|query|ll)=([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/i,
    );
    if (!coordinateMatch) {
      setError("Could not find coordinates in that link. Paste a Google Maps link containing a location pin.");
      return;
    }
    const latitude = Number(coordinateMatch[1] ?? coordinateMatch[3] ?? coordinateMatch[5]);
    const longitude = Number(coordinateMatch[2] ?? coordinateMatch[4] ?? coordinateMatch[6]);
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      setError("That map link contains invalid coordinates.");
      return;
    }
    setLocation((current) => ({
      ...current,
      latitude: String(latitude),
      longitude: String(longitude),
      mapLink,
    }));
    setHasCoordinates(true);
    setError("");
    setMessage("Map pin detected from your link.");
  };

  const openGoogleMaps = () => {
    const lat = location.latitude;
    const lng = location.longitude;
    if (lat && lng) {
      window.open(`https://maps.google.com/maps?q=${lat},${lng}`, "_blank");
    } else if (location.address || location.area) {
      const query = encodeURIComponent(
        [location.building, location.area, location.city, location.state, location.pincode]
          .filter(Boolean)
          .join(", "),
      );
      window.open(`https://maps.google.com/maps?q=${query}`, "_blank");
    }
  };

  const editLocation = (index) => {
    const savedLocation = savedLocations[index];
    setEditingLocationIndex(index);
    setLocation(locationToForm(savedLocation, account.name));
    setMapLink(savedLocation?.mapLink || "");
    setHasSavedLocation(true);
    setHasCoordinates(
      savedLocation?.latitude !== undefined &&
        savedLocation?.latitude !== null &&
        savedLocation?.longitude !== undefined &&
        savedLocation?.longitude !== null,
    );
    setIsSelectingLocation(false);
    setMapCenter(null);
    setError("");
    setMessage("");
  };

  const addLocation = () => {
    setEditingLocationIndex(-1);
    setLocation(emptyLocation(account.name));
    setMapLink("");
    setHasSavedLocation(false);
    setHasCoordinates(false);
    setIsSelectingLocation(false);
    setMapCenter(null);
    setError("");
    setMessage("");
  };

  const setDefaultLocation = async (index) => {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSaveLocation?.(savedLocations, index);
      setMessage("Default delivery location updated.");
    } catch (requestError) {
      setError(requestError.message || "Unable to update your default location.");
    } finally {
      setBusy(false);
    }
  };

  const deleteLocation = async (index) => {
    const label = savedLocations[index]?.building || "this delivery location";
    if (!window.confirm(`Are you sure you want to delete ${label}?`)) {
      return;
    }
    const nextLocations = savedLocations.filter((_, locationIndex) => locationIndex !== index);
    const nextSelectedIndex =
      nextLocations.length === 0
        ? null
        : index === selectedLocationIndex
          ? Math.min(index, nextLocations.length - 1)
          : selectedLocationIndex > index
            ? selectedLocationIndex - 1
            : selectedLocationIndex;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await onSaveLocation?.(nextLocations, nextSelectedIndex);
      setEditingLocationIndex(null);
      setIsSelectingLocation(false);
      setMapCenter(null);
      setMessage("Delivery location deleted successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to delete delivery location.");
    } finally {
      setBusy(false);
    }
  };

  const saveLocation = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    setBusy(true);
    try {
      const hasLatitude = location.latitude !== "" && location.latitude !== null;
      const hasLongitude = location.longitude !== "" && location.longitude !== null;
      if (hasLatitude !== hasLongitude) {
        throw new Error("Both location coordinates are required. Select a map pin or clear the location.");
      }

      const payload = {
        ...location,
        mapLink,
        fullName: location.fullName || account.name,
        mobile: location.mobile,
        alternateMobile: location.alternateMobile || "",
      };
      if (hasLatitude && hasLongitude) {
        payload.latitude = Number(location.latitude);
        payload.longitude = Number(location.longitude);
      } else {
        delete payload.latitude;
        delete payload.longitude;
      }
      if (editingLocationIndex < 0 && savedLocations.length >= 20) {
        throw new Error("You can save up to 20 delivery locations.");
      }
      const nextLocations =
        editingLocationIndex < 0
          ? [...savedLocations, payload]
          : savedLocations.map((savedLocation, index) =>
              index === editingLocationIndex ? { ...savedLocation, ...payload } : savedLocation,
            );
      const nextActiveIndex =
        editingLocationIndex < 0
          ? savedLocations.length === 0
            ? 0
            : selectedLocationIndex
          : selectedLocationIndex;
      await onSaveLocation?.(nextLocations, nextActiveIndex);
      setHasSavedLocation(true);
      setHasCoordinates(hasLatitude && hasLongitude);
      setEditingLocationIndex(null);
      setMessage("Delivery location saved successfully.");
    } catch (requestError) {
      setError(requestError.message || "Unable to save delivery location.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="account-section" aria-label="Account">
      <div className="account-section__inner">
        <div className="account-section__header">
          <div className="account-section__head-copy">
            <p className="eyebrow">Your OzaBay</p>
            <h2>Hello, <em>{account.name}.</em></h2>
            <p className="account-section__intro">{isVendor ? "Your details, registered products and studio settings." : "Your details, saved pieces and bag."}</p>
            <div className="account-section__chips">
            {!isVendor && (
              <>
                <span className="account-section__chip">
                  <i>{bag.length}</i>{bag.length === 1 ? "piece in bag" : "pieces in bag"}
                </span>
                <span className="account-section__chip">
                  <i>{favorites.length}</i>{favorites.length === 1 ? "saved favorite" : "saved favorites"}
                </span>
              </>
            )}
            {isVendor && (
              <span className="account-section__chip">
                <i>{vendorProducts.length}</i>{vendorProducts.length === 1 ? "registered product" : "registered products"}
              </span>
            )}
          </div>
        </div>
        <div className="account-section__avatar-wrap account-section__member-meta">
          <div className="account-section__avatar" aria-hidden="true">{initials}</div>
          <span className="account-section__member-badge">OzaBay member</span>
        </div>
      </div>

      <nav
        ref={tabsRef}
        className="account-section__tabs"
        aria-label="Account sections"
        role="tablist"
        onKeyDown={onTabsKeyDown}
      >
        <span
          className="account-section__tab-indicator"
          style={{ transform: `translateX(${indicator.translateX}px)`, width: `${indicator.width}px` }}
          aria-hidden="true"
        />
        {tabs.map((tab, index) => (
          <button
            ref={(el) => {
              tabRefs.current[index] = el;
            }}
            key={tab}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={`account-section__tab ${activeTab === tab ? "is-active" : ""}`}
            onClick={() => selectTab(tab)}
          >
            <span>{tab}</span>
            {tab === "Favorites" && <em className="account-section__tab-count">{favorites.length}</em>}
            {tab === "Bag" && <em className="account-section__tab-count">{bag.length}</em>}
            {tab === "My Products" && <em className="account-section__tab-count">{vendorProducts.length}</em>}
            {tab === "Delivery Location" && <em className="account-section__tab-count">{savedLocations.length}</em>}
            {tab === "Orders" && <em className="account-section__tab-count">{orders.length}</em>}
          </button>
        ))}
      </nav>
      <hr className="account-section__divider" aria-hidden="true" />

      {(message || error || logoutError) && (
        <p className={`account-section__notice ${error || logoutError ? "is-error" : ""}`} role={error || logoutError ? "alert" : "status"}>
          {error || logoutError || message}
        </p>
      )}

      {activeTab === "Profile" && (
        <form className="account-section__form" onSubmit={saveProfile}>
          <div>
            <p className="eyebrow">Personal details</p>
            <h3>Account <em>information.</em></h3>
          </div>
          <label>
            Name
            <input
              value={profile.name}
              onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              minLength={3}
              maxLength={30}
              autoComplete="name"
              required
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={profile.email}
              onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              autoComplete="email"
              required
            />
          </label>
          <div className="account-section__password-heading">
            <div>
              <p className="eyebrow">Change password</p>
              <small>Leave these fields blank to keep your current password.</small>
            </div>
            <button
              type="button"
              className="account-section__peek"
              aria-pressed={showPasswords}
              onClick={() => setShowPasswords((current) => !current)}
            >
              {showPasswords ? "Hide passwords" : "Show passwords"}
            </button>
          </div>
          <label>
            Current password
            <input
              type={showPasswords ? "text" : "password"}
              value={profile.currentPassword}
              onChange={(event) => setProfile({ ...profile, currentPassword: event.target.value })}
              autoComplete="current-password"
              minLength={6}
            />
          </label>
          <label className="account-section__password-field">
            <div className="account-section__password-field-head">
              <span>New password</span>
              {profile.password && (
                <span className={`account-section__strength is-${passwordScoreValue}`}>
                  <span aria-hidden="true">
                    {[1, 2, 3, 4].map((segment) => (
                      <i key={segment} className={segment <= passwordScoreValue ? "is-on" : ""} />
                    ))}
                  </span>
                  {strengthLabels[passwordScoreValue]}
                </span>
              )}
            </div>
            <input
              type={showPasswords ? "text" : "password"}
              value={profile.password}
              onChange={(event) => setProfile({ ...profile, password: event.target.value })}
              autoComplete="new-password"
              minLength={6}
            />
          </label>
          <button
            className={`hero-action account-section__submit ${dirty ? "is-dirty" : ""}`}
            type="submit"
            disabled={busy}
          >
            <span className="account-section__dirty-dot" aria-hidden="true" />
            {busy ? "Saving…" : "Save account details"}
            {dirty && !busy && <span className="account-section__dirty-flag">unsaved changes</span>}
          </button>
        </form>
      )}

      {!isVendor && activeTab === "Favorites" && (
        <div className="account-section__items">
          <div className="account-section__section-heading">
            <div><p className="eyebrow">Saved for later</p><h3>Your <em>favorites.</em></h3></div>
            <span>{favorites.length} {favorites.length === 1 ? "piece" : "pieces"}</span>
          </div>
          {favorites.length ? (
            <div className="account-section__item-rail">
              {favorites.map((product, index) => (
                <article
                  className="account-section__item"
                  key={product.id}
                  style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
                >
                  <div className="account-section__item-media">
                    <img src={product.image} alt={product.name} loading="lazy" />
                  </div>
                  <div className="account-section__item-copy">
                    <span>{product.category}</span>
                    <strong>{product.name}</strong>
                    <small>{money(product.priceValue)}</small>
                  </div>
                  <div className="account-section__item-actions">
                    <button type="button" onClick={() => onAddToBag(product)}>Add to bag</button>
                    <button type="button" aria-label={`Remove ${product.name} from favorites`} onClick={() => onRemoveFavorite(product.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="account-section__empty">
              <span className="account-section__empty-icon" aria-hidden="true">♡</span>
              <p>Your favorites are waiting to be discovered. Save a piece with the heart on its product card.</p>
            </div>
          )}
        </div>
      )}

      {!isVendor && activeTab === "Bag" && (
        <div className="account-section__items">
          <div className="account-section__section-heading">
            <div><p className="eyebrow">Ready when you are</p><h3>Your <em>bag.</em></h3></div>
            <span>{bag.length} {bag.length === 1 ? "piece" : "pieces"}</span>
          </div>
          {bag.length ? (
            <>
              <div className="account-section__item-rail">
                {bag.map((product, index) => (
                  <article
                    className="account-section__item"
                    key={product.id}
                    style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
                  >
                    <div className="account-section__item-media">
                      <img src={product.image} alt={product.name} loading="lazy" />
                    </div>
                    <div className="account-section__item-copy">
                      <span>{product.category}</span>
                      <strong>{product.name}</strong>
                      <small>{money(product.priceValue)} each</small>
                    </div>
                    <div className="account-section__item-actions">
                      <div className="account-section__quantity" aria-label={`Quantity of ${product.name}`}>
                        <button type="button" aria-label={`Remove one ${product.name}`} onClick={() => onUpdateQuantity(product.id, -1)}>−</button>
                        <span>{product.qty}</span>
                        <button type="button" aria-label={`Add one ${product.name}`} onClick={() => onUpdateQuantity(product.id, 1)}>+</button>
                      </div>
                      <button type="button" aria-label={`Remove ${product.name} from bag`} onClick={() => onRemoveBag(product.id)}>Remove</button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="account-section__total"><span>Bag subtotal</span><strong>{money(bagTotal)}</strong></div>
              <button type="button" className="hero-action account-section__buy" onClick={() => onBuyNow?.()}>
                Buy now <span aria-hidden="true">↗</span>
              </button>
              <p className="account-section__hint">Ready to order? Press Buy now to head straight to checkout, or open the bag from the top navigation to review it first.</p>
            </>
          ) : (
            <div className="account-section__empty">
              <span className="account-section__empty-icon" aria-hidden="true">◌</span>
              <p>Your bag is empty. Add a handmade favorite whenever you find the right piece.</p>
            </div>
          )}
        </div>
      )}

      {!isVendor && activeTab === "Delivery Location" && (
        <form className="account-section__form account-section__delivery" onSubmit={saveLocation}>
          <div>
            <p className="eyebrow">Where we’ll send it</p>
            <h3>Delivery <em>locations.</em></h3>
            <p className="account-section__hint">Save multiple addresses and choose which one to use by default at checkout.</p>
          </div>
          {savedLocations.length > 0 && (
            <div className="account-section__location-list">
              {savedLocations.map((savedLocation, index) => (
                <article className="account-section__saved-card" key={savedLocation._id || `location-${index}`}>
                  <div className="account-section__saved-card-text">
                    <p className="eyebrow">{index === selectedLocationIndex ? "Default delivery location" : `Saved location ${index + 1}`}</p>
                    <strong>
                      {savedLocation.building || savedLocation.fullName}
                      {savedLocation.mobile ? ` · ${savedLocation.mobile}` : ""}
                    </strong>
                    <p className="account-section__hint">
                      {[savedLocation.area, savedLocation.city, savedLocation.state, savedLocation.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                  {index !== selectedLocationIndex && (
                    <button
                      className="account-section__saved-card-button"
                      type="button"
                      onClick={() => setDefaultLocation(index)}
                      disabled={busy}
                    >
                      Set as default
                    </button>
                  )}
                  <button
                    className="account-section__saved-card-button"
                    type="button"
                    onClick={() => editLocation(index)}
                    disabled={busy}
                  >
                    Edit
                  </button>
                  <button
                    className="account-section__saved-card-button is-danger"
                    type="button"
                    onClick={() => deleteLocation(index)}
                    disabled={busy}
                  >
                    Delete
                  </button>
                </article>
              ))}
            </div>
          )}
          {editingLocationIndex === null && (
            <button
              className="account-section__saved-card-button account-section__add-location"
              type="button"
              onClick={addLocation}
              disabled={busy || savedLocations.length >= 20}
              title={savedLocations.length >= 20 ? "You can save up to 20 delivery locations" : undefined}
            >
              + Add another location
            </button>
          )}
          {editingLocationIndex !== null && (
            <>
          <div className="account-section__location-form-heading">
            <p className="eyebrow">{editingLocationIndex < 0 ? "New address" : "Update saved address"}</p>
            <h3>{editingLocationIndex < 0 ? "Add a delivery location." : "Edit this location."}</h3>
            <p className="account-section__hint">Use your current device location or enter a delivery address below.</p>
          </div>
          <button
            className={`account-section__location-button ${locating ? "is-locating" : ""}`}
            type="button"
            onClick={handleCurrentLocation}
            disabled={locating}
          >
            <span className="account-section__pulse" aria-hidden="true" />
            {locating ? "Finding your location…" : "Use my current location"}
          </button>
          <div className="account-section__delivery-fields">
            <label>
              Flat / House / Building name *
              <input
                value={location.building}
                onChange={(event) => setLocation({ ...location, building: event.target.value })}
                placeholder="e.g. Flat 402, Green Park"
                autoComplete="address-line1"
                maxLength={100}
                required
              />
            </label>
            <label>
              Area / Sector / Locality *
              <input
                value={location.area}
                onChange={(event) => setLocation({ ...location, area: event.target.value })}
                placeholder="e.g. Sector 15, Jaipur"
                autoComplete="address-level2"
                maxLength={100}
                required
              />
            </label>
            <label>
              City *
              <input
                value={location.city}
                onChange={(event) => setLocation({ ...location, city: event.target.value })}
                placeholder="e.g. Jaipur"
                autoComplete="address-level2"
                maxLength={60}
                required
              />
            </label>
            <label>
              State *
              <input
                value={location.state}
                onChange={(event) => setLocation({ ...location, state: event.target.value })}
                placeholder="e.g. Rajasthan"
                autoComplete="address-level1"
                maxLength={60}
                required
              />
            </label>
            <label>
              PIN code *
              <input
                value={location.pincode}
                onChange={(event) =>
                  setLocation({ ...location, pincode: event.target.value.replace(/\D/g, "").slice(0, 6) })
                }
                inputMode="numeric"
                placeholder="e.g. 302015"
                autoComplete="postal-code"
                pattern="[0-9]{6}"
                title="Enter a 6-digit PIN code"
                required
              />
            </label>
            <label>
              Your full name *
              <input
                value={location.fullName}
                onChange={(event) => setLocation({ ...location, fullName: event.target.value })}
                placeholder="e.g. Aarav Sharma"
                autoComplete="name"
                maxLength={60}
                required
              />
            </label>
            <label>
              10-digit mobile number *
              <input
                type="tel"
                inputMode="numeric"
                value={location.mobile}
                onChange={(event) =>
                  setLocation({ ...location, mobile: event.target.value.replace(/\D/g, "").slice(0, 10) })
                }
                placeholder="98765 43210"
                autoComplete="tel"
                pattern="[0-9]{10}"
                title="Enter a 10-digit mobile number"
                required
              />
            </label>
            <label>
              Alternate phone number (optional)
              <input
                type="tel"
                inputMode="numeric"
                value={location.alternateMobile}
                onChange={(event) =>
                  setLocation({ ...location, alternateMobile: event.target.value.replace(/\D/g, "").slice(0, 10) })
                }
                placeholder="Another number we can reach you"
                autoComplete="tel"
                pattern="[0-9]{10}"
                title="Enter a 10-digit mobile number"
              />
            </label>
          </div>
          {isSelectingLocation ? (
            <div className="account-section__maps-card">
              <div className="account-section__maps-card-head">
                <p className="eyebrow">Select your delivery location</p>
                <h3>Use the <em>map.</em></h3>
              </div>
              <p className="account-section__hint">
                Review the location found by your device. To choose another pin, close this preview and paste a Google Maps link below.
              </p>
              <div className="account-section__map-view">
                <iframe
                  title="Delivery location on Google Maps"
                  src={`https://maps.google.com/maps?ll=${mapCenter?.lat ?? 0},${mapCenter?.lng ?? 0}&z=${mapZoom}&output=embed`}
                  loading="lazy"
                  allowFullScreen
                />
                <div className="account-section__map-actions">
                  <button
                    type="button"
                    className="account-section__saved-card-button"
                    onClick={() => {
                      setIsSelectingLocation(false);
                      setMessage("Location selected. Click Save to confirm.");
                    }}
                  >
                    Use this current location
                  </button>
                  <button type="button" onClick={() => setIsSelectingLocation(false)}>
                    Cancel
                  </button>
                </div>
              </div>
              <p className="account-section__hint" style={{marginTop:12}}>
                This map is a preview and does not support moving the pin. Use a Google Maps link below to select a different location.
              </p>
            </div>
          ) : (
            <div className="account-section__maps-card">
              <div className="account-section__maps-card-head">
                <p className="eyebrow">Exact delivery pin</p>
                <h3>Your location <em>on the map.</em></h3>
              </div>
              <p className="account-section__hint">
                We save your exact Google Maps pin so the delivery agent reaches your door easily.
                Open the link, drag the pin onto your flat or building, then <strong>Share → Copy link</strong> and paste it below.
              </p>
              <div className="account-section__maps-link-row">
                <input
                  value={mapLink}
                  onChange={(event) => setMapLink(event.target.value)}
                  placeholder="Paste your Google Maps link here (https://maps.google.com/… or https://www.google.com/maps/…)"
                  inputMode="url"
                  aria-label="Google Maps link"
                />
                <button type="button" onClick={handleMapLinkLocation} disabled={busy}>
                  Use this exact pin
                </button>
              </div>
              {hasCoordinates && (
                <div className="account-section__map-view">
                  <iframe
                    title="Delivery location on Google Maps"
                    src={`https://maps.google.com/maps?ll=${location.latitude},${location.longitude}&z=18&output=embed&q=${encodeURIComponent(
                      [location.building.trim(), location.area.trim(), location.city.trim(), location.pincode.trim()]
                        .filter(Boolean)
                        .join(", "),
                    )}`}
                    loading="lazy"
                  />
                  <div className="account-section__map-actions">
                    <span>Your pin is saved with this delivery location.</span>
                    <button type="button" onClick={openGoogleMaps}>Open in Google Maps ↗</button>
                  </div>
                </div>
              )}
            </div>
          )}
          <button className="hero-action account-section__submit" type="submit" disabled={busy}>
            {busy ? "Saving…" : hasSavedLocation ? "Update saved location ↗" : "Save location ↗"}
          </button>
          <button
            className="account-section__cancel-location"
            type="button"
            onClick={() => setEditingLocationIndex(null)}
            disabled={busy}
          >
            Cancel
          </button>
            </>
          )}
        </form>
      )}

      {isVendor && activeTab === "My Products" && (
        <div className="account-section__items">
          <div className="account-section__section-heading">
            <div>
              <p className="eyebrow">Your catalogue</p>
              <h3>Your <em>registered products.</em></h3>
            </div>
            <span>
              {vendorProducts.length} {vendorProducts.length === 1 ? "piece" : "pieces"}
            </span>
          </div>
          {!vendorProductsLoaded ? (
            <div className="account-section__empty">
              <span className="account-section__empty-icon" aria-hidden="true">↻</span>
              <p>Loading your registered products…</p>
            </div>
          ) : vendorProducts.length === 0 ? (
            <div className="account-section__empty">
              <span className="account-section__empty-icon" aria-hidden="true">📦</span>
              <p>
                You haven't registered any products yet. Open the vendor studio to add your
                first piece.
              </p>
              <button
                type="button"
                className="hero-action account-section__saved-card-button"
                onClick={onOpenVendorPanel}
              >
                Open vendor studio ↗
              </button>
            </div>
          ) : (
            <div className="account-section__item-rail vendor-rail">
              {vendorProducts.map((product, index) => (
                <article
                  className="account-section__item vendor-item"
                  key={product._id}
                  style={{ animationDelay: `${Math.min(index * 70, 420)}ms` }}
                >
                  <div className="account-section__item-media">
                    <img src={product.images?.[0]} alt={product.name} loading="lazy" />
                    {product.discountPercent > 0 && (
                      <span className="account-section__item-discount">{product.discountPercent}% off</span>
                    )}
                  </div>
                  <div className="account-section__item-copy">
                    <span>{product.category}</span>
                    <strong>{product.name}</strong>
                    <small>{money(product.price * (1 - (product.discountPercent || 0) / 100))}</small>
                    {product.discountPercent > 0 && (
                      <small className="account-section__item-was">
                        {money(product.price)}
                      </small>
                    )}
                  </div>
                  <div className="account-section__item-actions">
                    <button
                      type="button"
                      className="account-section__saved-card-button"
                      onClick={() => onOpenVendorPanel()}
                    >
                      Edit ↗
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}


      {!isVendor && activeTab === "Orders" && (
        <div className="account-section__items">
          <div className="account-section__section-heading">
            <div>
              <p className="eyebrow">Order history</p>
              <h3>Your <em>orders.</em></h3>
            </div>
            <span>{orders.length} {orders.length === 1 ? "order" : "orders"}</span>
          </div>
          {orders.length === 0 ? (
            <div className="account-section__empty">
              <span className="account-section__empty-icon" aria-hidden="true">🛒</span>
              <p>You haven't placed any orders yet.</p>
              <button type="button" className="hero-action account-section__saved-card-button" onClick={() => onBuyNow?.()}>
                Start shopping ↗
              </button>
            </div>
          ) : (
            <div className="account-section__order-list">
              {orders.map((order) => (
                <article key={order.id} className="account-section__order-card">
                  <div className="account-section__order-head">
                    <div>
                      <strong>Order #{order.id}</strong>
                      <p>{new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</p>
                    </div>
                    <span className={`account-section__order-status account-section__order-status--${order.status.toLowerCase()}`}>{order.status}</span>
                  </div>
                  <div className="account-section__order-items">
                    {order.items.map((item, index) => (
                      <div key={index} className="account-section__order-item">
                        <span>{item.name}</span>
                        <span>×{item.qty}</span>
                        <span>{money(item.priceValue * item.qty)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="account-section__order-total">
                    <span>Total</span>
                    <strong>{money(order.total)}</strong>
                  </div>
                  <div className="account-section__order-customer">
                    <span>{order.customer.name}</span>
                    <span>{order.customer.address}</span>
                    <span>{order.customer.city}</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "Profile" && (
        <div className="account-section__footer">
          {confirmLogout ? (
            <div className="account-section__logout-card" role="alertdialog" aria-label="Confirm sign out">
              <div>
                <strong>Sign out of OzaBay?</strong>
                <small>Your bag and saved pieces stay safe — you’ll find them when you’re back.</small>
              </div>
              <div className="account-section__logout-actions">
                <button type="button" onClick={() => setConfirmLogout(false)}>Stay signed in</button>
                <button type="button" className="is-danger" onClick={handleLogout} disabled={busy}>
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className="account-section__logout" onClick={() => setConfirmLogout(true)}>
              Sign out ↗
            </button>
          )}
        </div>
      )}
        </div>
    </section>
  );
}
