import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { money } from "../../utils/formatCurrency.js";
import { apiUrl } from "../../utils/api.js";
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
const customerTabs = [
  "Profile",
  "Favorites",
  "Bag",
  "Delivery Location",
  "Orders",
  "Support",
];
const vendorTabs = ["Profile", "My Products", "Support"];
const orderTrackingStages = [
  "In progress",
  "Crafting",
  "Shipped",
  "Out for delivery",
  "Delivered",
];

const trackingStageIcons = {
  "In progress": "📋",
  Crafting: "🪄",
  Shipped: "📦",
  "Out for delivery": "🚚",
  Delivered: "✅",
};

const trackingStageDesc = {
  "In progress": "Order confirmed & payment verified",
  Crafting: "Artisan is handcrafting your piece",
  Shipped: "Handed over to courier",
  "Out for delivery": "On its way to your door",
  Delivered: "Delivered — enjoy your craft!",
};
const customerOrderStatus = (status) =>
  status === "Received" ? "In progress" : status;

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
  onRequestPasswordChange,
  onConfirmPasswordChange,
  onSaveLocation,
  onRemoveFavorite,
  onRemoveBag,
  onUpdateQuantity,
  onAddToBag,
  onBuyNow,
  onOpenVendorPanel,
  onLogout,
  orders = [],
  onRefreshOrders,
  onCancelOrder,
  onRequestOrderItemCancellation,
  onRequestOrderItemReturn,
  onListSupportMessages,
  onGetSupportUnreadCount,
  onCreateSupportMessage,
  onReplySupportMessage,
}) {
  // Vendors do not shop — favorites, bag and delivery are hidden from their panel.
  const tabs = isVendor ? vendorTabs : customerTabs;
  const [activeTab, setActiveTab] = useState("Profile");
  const [profile, setProfile] = useState({
    name: account.name || "",
    email: account.email || "",
    currentPassword: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    otp: "",
  });
  const [passwordStep, setPasswordStep] = useState("idle"); // idle | code
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [logoutError, setLogoutError] = useState("");
  const [cancelOrderError, setCancelOrderError] = useState("");
  const [cancelOrderNotice, setCancelOrderNotice] = useState("");
  const [cancellingOrderId, setCancellingOrderId] = useState("");
  const [requestingCancellationItemId, setRequestingCancellationItemId] = useState("");
  const [cancellationFormKey, setCancellationFormKey] = useState("");
  const [cancellationReason, setCancellationReason] = useState("");
  const [cancellationRequestError, setCancellationRequestError] = useState("");
  const [confirmCancelOrderId, setConfirmCancelOrderId] = useState("");
  const [returningItemId, setReturningItemId] = useState("");
  const [returnFormKey, setReturnFormKey] = useState(""); // "orderId:productId"
  const [returnReason, setReturnReason] = useState("");
  const [returnCustomText, setReturnCustomText] = useState("");
  const [returnFeedback, setReturnFeedback] = useState({}); // { [itemKey]: { type: "success" | "error", message: string, reason?: string } }
  const [returnError, setReturnError] = useState({}); // { [itemKey]: string }
  const [trackingOrderId, setTrackingOrderId] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [supportTickets, setSupportTickets] = useState([]);
  const [supportUnreadCount, setSupportUnreadCount] = useState(0);
  const [supportCategory, setSupportCategory] = useState(isVendor ? "Vendor" : "Support");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportText, setSupportText] = useState("");
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportNotice, setSupportNotice] = useState("");
  const [supportError, setSupportError] = useState("");
  const [supportReply, setSupportReply] = useState({});
  const tabsRef = useRef(null);
  const tabRefs = useRef([]);
  const [indicator, setIndicator] = useState({ translateX: 0, width: 0 });
  const passwordScoreValue = passwordScore(passwordForm.newPassword);
  const dirty =
    profile.name !== (account.name || "") ||
    profile.email.trim().toLowerCase() !==
      (account.email || "").toLowerCase() ||
    Boolean(profile.currentPassword);

  const cancelOrder = async (order) => {
    setCancelOrderError("");
    setCancelOrderNotice("");
    setCancellingOrderId(order.id);
    try {
      const result = await onCancelOrder(order.id);
      setCancelOrderNotice(result.message || "Order cancelled successfully.");
      setConfirmCancelOrderId("");
    } catch (requestError) {
      setCancelOrderError(
        requestError.message || "Unable to cancel this order.",
      );
    } finally {
      setCancellingOrderId("");
    }
  };

  const openCancellationForm = (order, item) => {
    const itemKey = `${order.id}:${item.productId}`;
    setCancellationFormKey((current) => (current === itemKey ? "" : itemKey));
    setCancellationReason("");
    setCancellationRequestError("");
  };

  const requestItemCancellation = async (order, item) => {
    const itemKey = `${order.id}:${item.productId}`;
    setCancellationRequestError("");
    setCancelOrderNotice("");
    setRequestingCancellationItemId(itemKey);
    try {
      const result = await onRequestOrderItemCancellation(
        order.id,
        item.productId,
        cancellationReason.trim(),
      );
      setCancelOrderNotice(
        result.message || "Cancellation request sent to the vendor.",
      );
      setCancellationFormKey("");
      setCancellationReason("");
    } catch (requestError) {
      setCancellationRequestError(
        requestError.message || "Unable to request product cancellation.",
      );
    } finally {
      setRequestingCancellationItemId("");
    }
  };

  const openReturnForm = (order, item) => {
    const key = `${order.id}:${item.productId}`;
    setReturnFormKey((current) => (current === key ? "" : key));
    setReturnReason("");
    setReturnCustomText("");
    setReturnError((prev) => ({ ...prev, [key]: "" }));
  };

  const dismissReturnFeedback = (itemKey) => {
    setReturnFeedback((prev) => {
      const next = { ...prev };
      delete next[itemKey];
      return next;
    });
  };

  const submitReturn = async (order, item) => {
    const itemKey = `${order.id}:${item.productId}`;
    const finalReason =
      returnReason === "Something else"
        ? returnCustomText.trim()
        : returnReason;

    if (!finalReason) {
      setReturnError((prev) => ({
        ...prev,
        [itemKey]:
          returnReason === "Something else"
            ? "Please write a brief description of your issue or problem."
            : "Please select a reason for the return.",
      }));
      return;
    }

    setReturnError((prev) => ({ ...prev, [itemKey]: "" }));
    setCancelOrderError("");
    setCancelOrderNotice("");
    setReturningItemId(itemKey);

    try {
      const result = await onRequestOrderItemReturn(
        order.id,
        item.productId,
        finalReason,
      );
      const successMessage =
        result?.message ||
        "Return request submitted! The maker will review your request.";

      // Display beautiful feedback message directly in UI (no alerts / popups)
      setReturnFeedback((prev) => ({
        ...prev,
        [itemKey]: {
          type: "success",
          message: successMessage,
          reason: finalReason,
        },
      }));
      setCancelOrderNotice(successMessage);
      setReturnFormKey("");
      setReturnReason("");
      setReturnCustomText("");
    } catch (requestError) {
      const errorText =
        requestError.message || "Unable to submit return request.";
      setReturnError((prev) => ({ ...prev, [itemKey]: errorText }));
      setCancelOrderError(errorText);
    } finally {
      setReturningItemId("");
    }
  };

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

  useEffect(() => {
    if (!onGetSupportUnreadCount) return undefined;
    let active = true;
    const refreshUnreadCount = () => {
      onGetSupportUnreadCount()
        .then((result) => {
          if (active) setSupportUnreadCount(Number(result.unreadCount) || 0);
        })
        .catch(() => {});
    };
    refreshUnreadCount();
    const interval = window.setInterval(refreshUnreadCount, 30000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshUnreadCount();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [onGetSupportUnreadCount]);

  useEffect(() => {
    if (activeTab !== "Support" || !onListSupportMessages) return undefined;
    let active = true;
    const loadSupportMessages = async () => {
      try {
        const result = await onListSupportMessages({ markRead: true });
        if (!active) return;
        setSupportTickets(result.tickets || []);
        if (active) setSupportUnreadCount(0);
      } catch (requestError) {
        if (active) setSupportError(requestError.message);
      }
    };
    loadSupportMessages();
    const interval = window.setInterval(loadSupportMessages, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [activeTab, onListSupportMessages]);

  const submitSupportMessage = async (event) => {
    event.preventDefault();
    setSupportBusy(true);
    setSupportError("");
    setSupportNotice("");
    try {
      const result = await onCreateSupportMessage({
        category: supportCategory,
        subject: supportSubject,
        message: supportText,
      });
      setSupportTickets((current) => [result.ticket, ...current]);
      setSupportSubject("");
      setSupportText("");
      setSupportNotice("Message sent to support.");
    } catch (requestError) {
      setSupportError(requestError.message || "Unable to send your message.");
    } finally {
      setSupportBusy(false);
    }
  };

  const submitSupportReply = async (ticketId) => {
    const text = (supportReply[ticketId] || "").trim();
    if (!text) return;
    setSupportBusy(true);
    setSupportError("");
    setSupportNotice("");
    try {
      const result = await onReplySupportMessage(ticketId, text);
      setSupportTickets((current) =>
        current.map((ticket) => String(ticket._id) === String(ticketId) ? result.ticket : ticket),
      );
      setSupportReply((current) => ({ ...current, [ticketId]: "" }));
      setSupportNotice("Reply sent.");
    } catch (requestError) {
      setSupportError(requestError.message || "Unable to send your reply.");
    } finally {
      setSupportBusy(false);
    }
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
      profile.email.trim().toLowerCase() !==
        (account.email || "").toLowerCase() &&
      !profile.currentPassword
    ) {
      setError("Enter your current password to change your email address.");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: profile.name.trim(),
        email: profile.email.trim(),
      };
      if (profile.currentPassword)
        payload.currentPassword = profile.currentPassword;
      await onSaveProfile(payload);
      setProfile((current) => ({ ...current, currentPassword: "" }));
      setMessage("Your account details have been updated.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  const requestPasswordChangeCode = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (!passwordForm.currentPassword) {
      setPasswordError("Enter your current password to continue.");
      return;
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      setPasswordError("Enter a new password with at least 6 characters.");
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await onRequestPasswordChange(
        passwordForm.currentPassword,
      );
      setPasswordStep("code");
      setPasswordMessage(
        result?.message ||
          `We sent a verification code to ${result?.email || "your registered email"}.`,
      );
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setPasswordBusy(false);
    }
  };

  const confirmPasswordChangeCode = async (event) => {
    event.preventDefault();
    setPasswordMessage("");
    setPasswordError("");
    if (!/^\d{6}$/.test(passwordForm.otp.trim())) {
      setPasswordError(
        "Enter the 6-digit verification code sent to your email.",
      );
      return;
    }
    setPasswordBusy(true);
    try {
      const result = await onConfirmPasswordChange({
        otp: passwordForm.otp.trim(),
        password: passwordForm.newPassword,
      });
      setPasswordForm({ currentPassword: "", newPassword: "", otp: "" });
      setPasswordStep("idle");
      setPasswordMessage(result?.message || "Password changed successfully.");
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setPasswordBusy(false);
    }
  };

  const resendPasswordChangeCode = async () => {
    setPasswordMessage("");
    setPasswordError("");
    setPasswordBusy(true);
    try {
      const result = await onRequestPasswordChange(
        passwordForm.currentPassword,
      );
      setPasswordMessage(
        result?.message || "A new verification code was sent to your email.",
      );
    } catch (requestError) {
      setPasswordError(requestError.message);
    } finally {
      setPasswordBusy(false);
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
  const [mapLink, setMapLink] = useState(
    account.deliveryLocation?.mapLink || "",
  );
  const [locating, setLocating] = useState(false);
  const [hasCoordinates, setHasCoordinates] = useState(
    account.deliveryLocation?.latitude !== undefined &&
      account.deliveryLocation?.latitude !== null &&
      account.deliveryLocation?.longitude !== undefined &&
      account.deliveryLocation?.longitude !== null,
  );
  const [hasSavedLocation, setHasSavedLocation] = useState(
    Boolean(account.deliveryLocation),
  );
  const [editingLocationIndex, setEditingLocationIndex] = useState(
    savedLocations.length ? null : -1,
  );
  const [isSelectingLocation, setIsSelectingLocation] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [mapZoom, setMapZoom] = useState(16);

  useEffect(() => {
    const savedLocation =
      account.deliveryLocation || account.deliveryLocations?.[0];
    setLocation(locationToForm(savedLocation, account.name));
    setMapLink(savedLocation?.mapLink || "");
    setHasCoordinates(
      Boolean(
        savedLocation?.latitude !== undefined &&
        savedLocation?.latitude !== null &&
        savedLocation?.longitude !== undefined &&
        savedLocation?.longitude !== null,
      ),
    );
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

      const response = await fetch(apiUrl("/api/geocode"), {
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
      setMessage(
        "Map preview opened with your current location. Confirm the address and save it below.",
      );
    } catch (error) {
      setError(
        error.message || "Geocoding failed. Please enter the address manually.",
      );
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
      setError(
        "Could not find coordinates in that link. Paste a Google Maps link containing a location pin.",
      );
      return;
    }
    const latitude = Number(
      coordinateMatch[1] ?? coordinateMatch[3] ?? coordinateMatch[5],
    );
    const longitude = Number(
      coordinateMatch[2] ?? coordinateMatch[4] ?? coordinateMatch[6],
    );
    if (
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
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
        [
          location.building,
          location.area,
          location.city,
          location.state,
          location.pincode,
        ]
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
      setError(
        requestError.message || "Unable to update your default location.",
      );
    } finally {
      setBusy(false);
    }
  };

  const deleteLocation = async (index) => {
    const label = savedLocations[index]?.building || "this delivery location";
    if (!window.confirm(`Are you sure you want to delete ${label}?`)) {
      return;
    }
    const nextLocations = savedLocations.filter(
      (_, locationIndex) => locationIndex !== index,
    );
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
      const hasLatitude =
        location.latitude !== "" && location.latitude !== null;
      const hasLongitude =
        location.longitude !== "" && location.longitude !== null;
      if (hasLatitude !== hasLongitude) {
        throw new Error(
          "Both location coordinates are required. Select a map pin or clear the location.",
        );
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
              index === editingLocationIndex
                ? { ...savedLocation, ...payload }
                : savedLocation,
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
            <h2>
              Hello, <em>{account.name}.</em>
            </h2>
            <p className="account-section__intro">
              {isVendor
                ? "Your details, registered products and studio settings."
                : "Your details, saved pieces and bag."}
            </p>
            <div className="account-section__chips">
              {!isVendor && (
                <>
                  <span className="account-section__chip">
                    <i>{bag.length}</i>
                    {bag.length === 1 ? "piece in bag" : "pieces in bag"}
                  </span>
                  <span className="account-section__chip">
                    <i>{favorites.length}</i>
                    {favorites.length === 1
                      ? "saved favorite"
                      : "saved favorites"}
                  </span>
                </>
              )}
              {isVendor && (
                <span className="account-section__chip">
                  <i>{vendorProducts.length}</i>
                  {vendorProducts.length === 1
                    ? "registered product"
                    : "registered products"}
                </span>
              )}
            </div>
          </div>
          <div className="account-section__avatar-wrap account-section__member-meta">
            <div className="account-section__avatar" aria-hidden="true">
              {initials}
            </div>
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
            style={{
              transform: `translateX(${indicator.translateX}px)`,
              width: `${indicator.width}px`,
            }}
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
              {tab === "Favorites" && (
                <em className="account-section__tab-count">
                  {favorites.length}
                </em>
              )}
              {tab === "Bag" && (
                <em className="account-section__tab-count">{bag.length}</em>
              )}
              {tab === "My Products" && (
                <em className="account-section__tab-count">
                  {vendorProducts.length}
                </em>
              )}
              {tab === "Delivery Location" && (
                <em className="account-section__tab-count">
                  {savedLocations.length}
                </em>
              )}
              {tab === "Orders" && (
                <em className="account-section__tab-count">{orders.length}</em>
              )}
              {tab === "Support" && (
                <em
                  className={`account-section__tab-count${supportUnreadCount ? " is-unread" : ""}`}
                  aria-label={`${supportUnreadCount || supportTickets.length} ${supportUnreadCount ? "unread support conversations" : "support conversations"}`}
                >
                  {supportUnreadCount || supportTickets.length}
                </em>
              )}
            </button>
          ))}
        </nav>
        <hr className="account-section__divider" aria-hidden="true" />

        {(message || error || logoutError) && (
          <p
            className={`account-section__notice ${error || logoutError ? "is-error" : ""}`}
            role={error || logoutError ? "alert" : "status"}
          >
            {error || logoutError || message}
          </p>
        )}

        {activeTab === "Profile" && (
          <>
            <form className="account-section__form" onSubmit={saveProfile}>
              <div>
                <p className="eyebrow">Personal details</p>
                <h3>
                  Account <em>information.</em>
                </h3>
              </div>
              <label>
                Name
                <input
                  value={profile.name}
                  onChange={(event) =>
                    setProfile({ ...profile, name: event.target.value })
                  }
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
                  onChange={(event) =>
                    setProfile({ ...profile, email: event.target.value })
                  }
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Current password (required to change email)
                <input
                  type={showPasswords ? "text" : "password"}
                  value={profile.currentPassword}
                  onChange={(event) =>
                    setProfile({
                      ...profile,
                      currentPassword: event.target.value,
                    })
                  }
                  autoComplete="current-password"
                  minLength={6}
                />
              </label>
              <button
                className={`hero-action account-section__submit ${dirty ? "is-dirty" : ""}`}
                type="submit"
                disabled={busy}
              >
                <span
                  className="account-section__dirty-dot"
                  aria-hidden="true"
                />
                {busy ? "Saving…" : "Save account details"}
                {dirty && !busy && (
                  <span className="account-section__dirty-flag">
                    unsaved changes
                  </span>
                )}
              </button>
            </form>

            <form
              className="account-section__form"
              onSubmit={
                passwordStep === "code"
                  ? confirmPasswordChangeCode
                  : requestPasswordChangeCode
              }
            >
              <div className="account-section__password-heading">
                <div>
                  <p className="eyebrow">Change password</p>
                  <small>
                    For security, verify your registered email ({account.email})
                    before changing your password.
                  </small>
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

              {(passwordMessage || passwordError) && (
                <p
                  className={`account-section__notice ${passwordError ? "is-error" : ""}`}
                  role={passwordError ? "alert" : "status"}
                >
                  {passwordError || passwordMessage}
                </p>
              )}

              <label>
                Current password
                <input
                  type={showPasswords ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: event.target.value,
                    })
                  }
                  autoComplete="current-password"
                  minLength={6}
                  required
                  disabled={passwordBusy || passwordStep === "code"}
                />
              </label>
              <label className="account-section__password-field">
                <div className="account-section__password-field-head">
                  <span>New password</span>
                  {passwordForm.newPassword && (
                    <span
                      className={`account-section__strength is-${passwordScoreValue}`}
                    >
                      <span aria-hidden="true">
                        {[1, 2, 3, 4].map((segment) => (
                          <i
                            key={segment}
                            className={
                              segment <= passwordScoreValue ? "is-on" : ""
                            }
                          />
                        ))}
                      </span>
                      {strengthLabels[passwordScoreValue]}
                    </span>
                  )}
                </div>
                <input
                  type={showPasswords ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: event.target.value,
                    })
                  }
                  autoComplete="new-password"
                  minLength={6}
                  required
                  disabled={passwordBusy || passwordStep === "code"}
                />
              </label>

              {passwordStep === "code" && (
                <label>
                  Email verification code
                  <input
                    value={passwordForm.otp}
                    onChange={(event) =>
                      setPasswordForm({
                        ...passwordForm,
                        otp: event.target.value.replace(/\D/g, "").slice(0, 6),
                      })
                    }
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    placeholder="6-digit code"
                    required
                    disabled={passwordBusy}
                  />
                </label>
              )}

              <div className="account-section__item-actions">
                <button
                  className="hero-action account-section__submit"
                  type="submit"
                  disabled={passwordBusy}
                >
                  {passwordBusy
                    ? "Please wait…"
                    : passwordStep === "code"
                      ? "Verify email & change password ↗"
                      : "Send verification code ↗"}
                </button>
                {passwordStep === "code" && (
                  <>
                    <button
                      type="button"
                      className="account-section__saved-card-button"
                      onClick={resendPasswordChangeCode}
                      disabled={passwordBusy}
                    >
                      Resend code
                    </button>
                    <button
                      type="button"
                      className="account-section__cancel-location"
                      onClick={() => {
                        setPasswordStep("idle");
                        setPasswordForm((current) => ({ ...current, otp: "" }));
                        setPasswordMessage("");
                        setPasswordError("");
                      }}
                      disabled={passwordBusy}
                    >
                      Cancel
                    </button>
                  </>
                )}
              </div>
            </form>
          </>
        )}

        {!isVendor && activeTab === "Favorites" && (
          <div className="account-section__items">
            <div className="account-section__section-heading">
              <div>
                <p className="eyebrow">Saved for later</p>
                <h3>
                  Your <em>favorites.</em>
                </h3>
              </div>
              <span>
                {favorites.length} {favorites.length === 1 ? "piece" : "pieces"}
              </span>
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
                      <img
                        src={product.image}
                        alt={product.name}
                        loading="lazy"
                      />
                    </div>
                    <div className="account-section__item-copy">
                      <span>{product.category}</span>
                      <strong>{product.name}</strong>
                      <small>{money(product.priceValue)}</small>
                    </div>
                    <div className="account-section__item-actions">
                      <button type="button" onClick={() => onAddToBag(product)}>
                        Add to bag
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${product.name} from favorites`}
                        onClick={() => onRemoveFavorite(product.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="account-section__empty">
                <span
                  className="account-section__empty-icon"
                  aria-hidden="true"
                >
                  ♡
                </span>
                <p>
                  Your favorites are waiting to be discovered. Save a piece with
                  the heart on its product card.
                </p>
              </div>
            )}
          </div>
        )}

        {!isVendor && activeTab === "Bag" && (
          <div className="account-section__items">
            <div className="account-section__section-heading">
              <div>
                <p className="eyebrow">Ready when you are</p>
                <h3>
                  Your <em>bag.</em>
                </h3>
              </div>
              <span>
                {bag.length} {bag.length === 1 ? "piece" : "pieces"}
              </span>
            </div>
            {bag.length ? (
              <>
                <div className="account-section__item-rail">
                  {bag.map((product, index) => (
                    <article
                      className="account-section__item"
                      key={product.id}
                      style={{
                        animationDelay: `${Math.min(index * 70, 420)}ms`,
                      }}
                    >
                      <div className="account-section__item-media">
                        <img
                          src={product.image}
                          alt={product.name}
                          loading="lazy"
                        />
                      </div>
                      <div className="account-section__item-copy">
                        <span>{product.category}</span>
                        <strong>{product.name}</strong>
                        <small>{money(product.priceValue)} each</small>
                      </div>
                      <div className="account-section__item-actions">
                        <div
                          className="account-section__quantity"
                          aria-label={`Quantity of ${product.name}`}
                        >
                          <button
                            type="button"
                            aria-label={`Remove one ${product.name}`}
                            onClick={() => onUpdateQuantity(product.id, -1)}
                          >
                            −
                          </button>
                          <span>{product.qty}</span>
                          <button
                            type="button"
                            aria-label={`Add one ${product.name}`}
                            onClick={() => onUpdateQuantity(product.id, 1)}
                          >
                            +
                          </button>
                        </div>
                        <button
                          type="button"
                          aria-label={`Remove ${product.name} from bag`}
                          onClick={() => onRemoveBag(product.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <div className="account-section__total">
                  <span>Bag subtotal</span>
                  <strong>{money(bagTotal)}</strong>
                </div>
                <button
                  type="button"
                  className="hero-action account-section__buy"
                  onClick={() => onBuyNow?.()}
                >
                  Buy now <span aria-hidden="true">↗</span>
                </button>
                <p className="account-section__hint">
                  Ready to order? Press Buy now to head straight to checkout, or
                  open the bag from the top navigation to review it first.
                </p>
              </>
            ) : (
              <div className="account-section__empty">
                <span
                  className="account-section__empty-icon"
                  aria-hidden="true"
                >
                  ◌
                </span>
                <p>
                  Your bag is empty. Add a handmade favorite whenever you find
                  the right piece.
                </p>
              </div>
            )}
          </div>
        )}

        {!isVendor && activeTab === "Delivery Location" && (
          <form
            className="account-section__form account-section__delivery"
            onSubmit={saveLocation}
          >
            <div>
              <p className="eyebrow">Where we’ll send it</p>
              <h3>
                Delivery <em>locations.</em>
              </h3>
              <p className="account-section__hint">
                Save multiple addresses and choose which one to use by default
                at checkout.
              </p>
            </div>
            {savedLocations.length > 0 && (
              <div className="account-section__location-list">
                {savedLocations.map((savedLocation, index) => (
                  <article
                    className="account-section__saved-card"
                    key={savedLocation._id || `location-${index}`}
                  >
                    <div className="account-section__saved-card-text">
                      <p className="eyebrow">
                        {index === selectedLocationIndex
                          ? "Default delivery location"
                          : `Saved location ${index + 1}`}
                      </p>
                      <strong>
                        {savedLocation.building || savedLocation.fullName}
                        {savedLocation.mobile
                          ? ` · ${savedLocation.mobile}`
                          : ""}
                      </strong>
                      <p className="account-section__hint">
                        {[
                          savedLocation.area,
                          savedLocation.city,
                          savedLocation.state,
                          savedLocation.pincode,
                        ]
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
                title={
                  savedLocations.length >= 20
                    ? "You can save up to 20 delivery locations"
                    : undefined
                }
              >
                + Add another location
              </button>
            )}
            {editingLocationIndex !== null && (
              <>
                <div className="account-section__location-form-heading">
                  <p className="eyebrow">
                    {editingLocationIndex < 0
                      ? "New address"
                      : "Update saved address"}
                  </p>
                  <h3>
                    {editingLocationIndex < 0
                      ? "Add a delivery location."
                      : "Edit this location."}
                  </h3>
                  <p className="account-section__hint">
                    Use your current device location or enter a delivery address
                    below.
                  </p>
                </div>
                <button
                  className={`account-section__location-button ${locating ? "is-locating" : ""}`}
                  type="button"
                  onClick={handleCurrentLocation}
                  disabled={locating}
                >
                  <span className="account-section__pulse" aria-hidden="true" />
                  {locating
                    ? "Finding your location…"
                    : "Use my current location"}
                </button>
                <div className="account-section__delivery-fields">
                  <label>
                    Flat / House / Building name *
                    <input
                      value={location.building}
                      onChange={(event) =>
                        setLocation({
                          ...location,
                          building: event.target.value,
                        })
                      }
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
                      onChange={(event) =>
                        setLocation({ ...location, area: event.target.value })
                      }
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
                      onChange={(event) =>
                        setLocation({ ...location, city: event.target.value })
                      }
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
                      onChange={(event) =>
                        setLocation({ ...location, state: event.target.value })
                      }
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
                        setLocation({
                          ...location,
                          pincode: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 6),
                        })
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
                      onChange={(event) =>
                        setLocation({
                          ...location,
                          fullName: event.target.value,
                        })
                      }
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
                        setLocation({
                          ...location,
                          mobile: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        })
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
                        setLocation({
                          ...location,
                          alternateMobile: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 10),
                        })
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
                      <h3>
                        Use the <em>map.</em>
                      </h3>
                    </div>
                    <p className="account-section__hint">
                      Review the location found by your device. To choose
                      another pin, close this preview and paste a Google Maps
                      link below.
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
                            setMessage(
                              "Location selected. Click Save to confirm.",
                            );
                          }}
                        >
                          Use this current location
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsSelectingLocation(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                    <p
                      className="account-section__hint"
                      style={{ marginTop: 12 }}
                    >
                      This map is a preview and does not support moving the pin.
                      Use a Google Maps link below to select a different
                      location.
                    </p>
                  </div>
                ) : (
                  <div className="account-section__maps-card">
                    <div className="account-section__maps-card-head">
                      <p className="eyebrow">Exact delivery pin</p>
                      <h3>
                        Your location <em>on the map.</em>
                      </h3>
                    </div>
                    <p className="account-section__hint">
                      We save your exact Google Maps pin so the delivery agent
                      reaches your door easily. Open the link, drag the pin onto
                      your flat or building, then{" "}
                      <strong>Share → Copy link</strong> and paste it below.
                    </p>
                    <div className="account-section__maps-link-row">
                      <input
                        value={mapLink}
                        onChange={(event) => setMapLink(event.target.value)}
                        placeholder="Paste your Google Maps link here (https://maps.google.com/… or https://www.google.com/maps/…)"
                        inputMode="url"
                        aria-label="Google Maps link"
                      />
                      <button
                        type="button"
                        onClick={handleMapLinkLocation}
                        disabled={busy}
                      >
                        Use this exact pin
                      </button>
                    </div>
                    {hasCoordinates && (
                      <div className="account-section__map-view">
                        <iframe
                          title="Delivery location on Google Maps"
                          src={`https://maps.google.com/maps?ll=${location.latitude},${location.longitude}&z=18&output=embed&q=${encodeURIComponent(
                            [
                              location.building.trim(),
                              location.area.trim(),
                              location.city.trim(),
                              location.pincode.trim(),
                            ]
                              .filter(Boolean)
                              .join(", "),
                          )}`}
                          loading="lazy"
                        />
                        <div className="account-section__map-actions">
                          <span>
                            Your pin is saved with this delivery location.
                          </span>
                          <button type="button" onClick={openGoogleMaps}>
                            Open in Google Maps ↗
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <button
                  className="hero-action account-section__submit"
                  type="submit"
                  disabled={busy}
                >
                  {busy
                    ? "Saving…"
                    : hasSavedLocation
                      ? "Update saved location ↗"
                      : "Save location ↗"}
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
                <h3>
                  Your <em>registered products.</em>
                </h3>
              </div>
              <span>
                {vendorProducts.length}{" "}
                {vendorProducts.length === 1 ? "piece" : "pieces"}
              </span>
            </div>
            {!vendorProductsLoaded ? (
              <div className="account-section__empty">
                <span
                  className="account-section__empty-icon"
                  aria-hidden="true"
                >
                  ↻
                </span>
                <p>Loading your registered products…</p>
              </div>
            ) : vendorProducts.length === 0 ? (
              <div className="account-section__empty">
                <span
                  className="account-section__empty-icon"
                  aria-hidden="true"
                >
                  📦
                </span>
                <p>
                  You haven't registered any products yet. Open the vendor
                  studio to add your first piece.
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
                      <img
                        src={product.images?.[0]}
                        alt={product.name}
                        loading="lazy"
                      />
                      {product.discountPercent > 0 && (
                        <span className="account-section__item-discount">
                          {product.discountPercent}% off
                        </span>
                      )}
                    </div>
                    <div className="account-section__item-copy">
                      <span>{product.category}</span>
                      <strong>{product.name}</strong>
                      <small>
                        {money(
                          product.price *
                            (1 - (product.discountPercent || 0) / 100),
                        )}
                      </small>
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

        {activeTab === "Support" && (
          <div className="account-section__support">
            <div className="account-section__section-heading">
              <div>
                <p className="eyebrow">{isVendor ? "Maker concierge" : "Customer concierge"}</p>
                <h3>{isVendor ? "Vendor support" : "Support"} <em>messages.</em></h3>
              </div>
              <span>{supportTickets.length} conversation{supportTickets.length === 1 ? "" : "s"}</span>
            </div>
            {supportUnreadCount > 0 && (
              <p className="account-section__support-unread" role="status">
                {supportUnreadCount} support {supportUnreadCount === 1 ? "conversation has" : "conversations have"} new messages
              </p>
            )}
            {supportNotice && <p className="account-section__notice" role="status">{supportNotice}</p>}
            {supportError && <p className="account-section__notice is-error" role="alert">{supportError}</p>}
            {isVendor && (
              <div className="account-section__support-contact">
                <a href="mailto:ankush@infinitivecloud.com">Email admin · ankush@infinitivecloud.com</a>
                <a href="tel:+918690393087">Call · +91 8690393087</a>
                <a href="https://wa.me/918690393087?text=Hi%20OzaBay%2C%20I%20need%20vendor%20support." target="_blank" rel="noopener noreferrer">WhatsApp admin support ↗</a>
              </div>
            )}
            <form className="account-section__support-form" onSubmit={submitSupportMessage}>
              <label>
                Category
                <select value={supportCategory} onChange={(event) => setSupportCategory(event.target.value)}>
                  {isVendor && <option value="Vendor">Vendor help</option>}
                  <option value="Support">Support</option>
                  <option value="Feedback">Feedback</option>
                  <option value="Order">Order</option>
                  <option value="Return">Return</option>
                  <option value="Review">Review</option>
                </select>
              </label>
              <label>
                Subject
                <input value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} minLength={3} maxLength={120} required />
              </label>
              <label className="account-section__support-message">
                Message
                <textarea value={supportText} onChange={(event) => setSupportText(event.target.value)} minLength={5} maxLength={2000} rows={5} required />
              </label>
              <button className="hero-action account-section__support-send" type="submit" disabled={supportBusy}>
                {supportBusy ? "Sending…" : isVendor ? "Send to OzaBay admin ↗" : "Send to support ↗"}
              </button>
            </form>
            <div className="account-section__support-list">
              {supportTickets.map((ticket) => (
                <article className="account-section__support-card" key={ticket._id}>
                  <div className="account-section__support-card-head">
                    <div><strong>{ticket.subject}</strong><small>{ticket.category}</small></div>
                    <div className="account-section__support-card-indicators">
                      {ticket.hasUnread && <span className="account-section__support-new">New reply</span>}
                      <span className={`account-section__support-status is-${ticket.status.toLowerCase()}`}>{ticket.status}</span>
                    </div>
                  </div>
                  <p className="account-section__support-original">{ticket.message}</p>
                  <div className="account-section__support-replies">
                    {(ticket.replies || []).map((reply, index) => (
                      <div className={`account-section__support-reply is-${reply.sender}`} key={`${ticket._id}-${index}`}>
                        <strong>{reply.sender === "admin" ? "OzaBay support" : "You"}</strong>
                        <p>{reply.message}</p>
                      </div>
                    ))}
                  </div>
                  <div className="account-section__support-reply-form">
                    <input
                      aria-label={`Reply to ${ticket.subject}`}
                      value={supportReply[ticket._id] || ""}
                      onChange={(event) => setSupportReply((current) => ({ ...current, [ticket._id]: event.target.value }))}
                      maxLength={2000}
                      placeholder="Write a reply…"
                    />
                    <button type="button" disabled={supportBusy} onClick={() => submitSupportReply(ticket._id)}>Reply</button>
                  </div>
                </article>
              ))}
              {!supportTickets.length && <div className="account-section__empty"><p>No support or feedback messages yet.</p></div>}
            </div>
          </div>
        )}

        {!isVendor && activeTab === "Orders" && (
          <div className="account-section__items">
            <div className="account-section__section-heading">
              <div>
                <p className="eyebrow">Order history</p>
                <h3>
                  Your <em>orders.</em>
                </h3>
              </div>
              <span>
                {orders.length} {orders.length === 1 ? "order" : "orders"}
              </span>
            </div>
            {orders.length === 0 ? (
              <div className="account-section__empty">
                <span
                  className="account-section__empty-icon"
                  aria-hidden="true"
                >
                  🛒
                </span>
                <p>You haven't placed any orders yet.</p>
                <button
                  type="button"
                  className="hero-action account-section__saved-card-button"
                  onClick={() => onBuyNow?.()}
                >
                  Start shopping ↗
                </button>
              </div>
            ) : (
              <div className="account-section__order-list">
                {cancelOrderError && (
                  <p
                    className="account-section__order-message account-section__order-message--error"
                    role="alert"
                  >
                    {cancelOrderError}
                  </p>
                )}
                {cancelOrderNotice && (
                  <p className="account-section__order-message" role="status">
                    {cancelOrderNotice}
                  </p>
                )}
                {orders.map((order) => {
                  const displayStatus = customerOrderStatus(order.status);
                  return (
                    <article
                      key={order.id}
                      className="account-section__order-card"
                    >
                      <div className="account-section__order-head">
                        <div>
                          <strong>Order #{order.id}</strong>
                          <p>
                            {new Date(order.createdAt).toLocaleDateString(
                              "en-IN",
                              { dateStyle: "medium" },
                            )}
                          </p>
                        </div>
                        <span
                          className={`account-section__order-status account-section__order-status--${displayStatus.toLowerCase().replace(/\s+/g, "-")}`}
                        >
                          {displayStatus}
                        </span>
                      </div>
                      <div className="account-section__order-items">
                        {order.items.map((item, index) => {
                          const itemKey = `${order.id}:${item.productId}`;
                          const deliveredAt = item.deliveredAt
                            ? new Date(item.deliveredAt).getTime()
                            : 0;
                          const returnDeadline =
                            deliveredAt + 7 * 24 * 60 * 60 * 1000;
                          const isReturnEligible =
                            deliveredAt > 0 &&
                            deliveredAt <= Date.now() &&
                            Date.now() < returnDeadline;
                          const isReturnFormOpen = returnFormKey === itemKey;
                          const isCancellationFormOpen = cancellationFormKey === itemKey;
                          const isReturningThis = returningItemId === itemKey;
                          const canSubmitReturn =
                            Boolean(returnReason) &&
                            (returnReason !== "Something else" ||
                              returnCustomText.trim().length >= 3);

                          const returnReasons = [
                            {
                              label: "Damaged or defective",
                              icon: "📦",
                              desc: "Item arrived broken, scratched or damaged",
                            },
                            {
                              label: "Differs from description",
                              icon: "🔍",
                              desc: "Product appearance differs from website",
                            },
                            {
                              label: "Color or material mismatch",
                              icon: "🎨",
                              desc: "Finish, tone or craft material doesn't match",
                            },
                            {
                              label: "Incorrect size or fit",
                              icon: "📏",
                              desc: "Measurements differ from specified dimensions",
                            },
                            {
                              label: "Delivery delayed / late",
                              icon: "⏳",
                              desc: "Arrived too late for intended need",
                            },
                            {
                              label: "Changed my mind",
                              icon: "💭",
                              desc: "No longer needed or want a different craft",
                            },
                            {
                              label: "Something else",
                              icon: "✏️",
                              desc: "Write your custom issue or problem below",
                            },
                          ];

                          return (
                            <div
                              key={itemKey || index}
                              className="account-section__order-item-wrap"
                            >
                              <div className="account-section__order-item">
                                <span>
                                  {item.name}
                                  {item.fulfillmentStatus && (
                                    <small className="account-section__order-item-status">
                                      {customerOrderStatus(
                                        item.fulfillmentStatus,
                                      )}
                                    </small>
                                  )}
                                  {item.cancellationRequest?.status
                                    && item.cancellationRequest.status !== "none" && (
                                    <small className={`account-section__cancellation-status account-section__cancellation-status--${item.cancellationRequest.status}`}>
                                      Cancellation {item.cancellationRequest.status}
                                      {item.cancellationRequest.reason
                                        && ` · ${item.cancellationRequest.reason}`}
                                    </small>
                                  )}
                                  {order.paymentMethod ===
                                    "Cash on delivery" && (
                                    <small
                                      className={`account-section__order-item-status account-section__cod-status${item.cashOnDelivery?.status === "paid" ? " is-paid" : ""}`}
                                    >
                                      COD{" "}
                                      {item.cashOnDelivery?.status === "paid"
                                        ? "paid"
                                        : "payment due"}
                                      {item.cashOnDelivery?.collectedAt &&
                                        ` · ${new Date(item.cashOnDelivery.collectedAt).toLocaleDateString("en-IN")}`}
                                    </small>
                                  )}
                                  {item.fulfillmentStatus === "Delivered" &&
                                    ["requested", "approved"].includes(
                                      item.returnRequest?.status,
                                    ) && (
                                      <small
                                        className={`account-section__return-status account-section__return-status--${item.returnRequest.status}`}
                                      >
                                        Return {item.returnRequest.status}
                                      </small>
                                    )}
                                </span>
                                <span>×{item.qty}</span>
                                <span>{money(item.priceValue * item.qty)}</span>
                                {item.fulfillmentStatus === "Out for delivery"
                                  && item.cancellationRequest?.status !== "requested"
                                  && item.cancellationRequest?.status !== "approved"
                                  && onRequestOrderItemCancellation && (
                                    <button
                                      type="button"
                                      className="account-section__cancel-item-request"
                                      disabled={requestingCancellationItemId === itemKey}
                                      aria-expanded={isCancellationFormOpen}
                                      onClick={() => openCancellationForm(order, item)}
                                    >
                                      {requestingCancellationItemId === itemKey
                                        ? "Sending request…"
                                        : isCancellationFormOpen
                                          ? "Close request form"
                                        : item.cancellationRequest?.status === "rejected"
                                          ? "Request cancellation again"
                                          : "Request cancellation"}
                                    </button>
                                  )}
                                {item.fulfillmentStatus === "Delivered" &&
                                  item.returnRequest?.status !== "requested" &&
                                  item.returnRequest?.status !== "approved" &&
                                  onRequestOrderItemReturn &&
                                  isReturnEligible && (
                                    <button
                                      type="button"
                                      className={`account-section__return-button ${isReturnFormOpen ? "is-open" : ""}`}
                                      onClick={() =>
                                        openReturnForm(order, item)
                                      }
                                      disabled={isReturningThis}
                                    >
                                      {isReturningThis
                                        ? "Requesting…"
                                        : isReturnFormOpen
                                          ? "✕ Close return"
                                          : item.returnRequest?.status ===
                                              "rejected"
                                            ? "↩ Request return again"
                                            : "↩ Request return"}
                                    </button>
                                  )}
                                {item.fulfillmentStatus === "Delivered" &&
                                  item.returnRequest?.status === "rejected" &&
                                  !isReturnFormOpen && (
                                    <small className="account-section__return-status account-section__return-status--rejected">
                                      Previous return request declined
                                    </small>
                                  )}
                                {item.fulfillmentStatus === "Delivered" &&
                                  (!item.returnRequest ||
                                    item.returnRequest.status === "none") &&
                                  item.deliveredAt &&
                                  Date.now() >=
                                    new Date(item.deliveredAt).getTime() +
                                      7 * 24 * 60 * 60 * 1000 && (
                                    <small className="account-section__return-expired">
                                      7-day return window ended
                                    </small>
                                  )}
                              </div>

                              {isCancellationFormOpen && (
                                <div
                                  className="account-section__cancel-item-panel"
                                  role="region"
                                  aria-label={`Cancellation request for ${item.name}`}
                                >
                                  <label htmlFor={`cancel-reason-${itemKey}`}>
                                    Why do you need to cancel? <span>(optional)</span>
                                  </label>
                                  <textarea
                                    id={`cancel-reason-${itemKey}`}
                                    value={cancellationReason}
                                    onChange={(event) => {
                                      setCancellationReason(event.target.value);
                                      if (cancellationRequestError) {
                                        setCancellationRequestError("");
                                      }
                                    }}
                                    maxLength={500}
                                    rows={3}
                                    placeholder="Add a short reason for the vendor…"
                                    disabled={requestingCancellationItemId === itemKey}
                                  />
                                  <div className="account-section__cancel-item-panel-footer">
                                    <small>{cancellationReason.length} / 500 characters</small>
                                    {cancellationRequestError && (
                                      <p role="alert">{cancellationRequestError}</p>
                                    )}
                                  </div>
                                  <div className="account-section__cancel-item-panel-actions">
                                    <button
                                      type="button"
                                      className="account-section__cancel-item-submit"
                                      disabled={requestingCancellationItemId === itemKey}
                                      onClick={() => requestItemCancellation(order, item)}
                                    >
                                      {requestingCancellationItemId === itemKey
                                        ? "Sending request…"
                                        : "Send cancellation request"}
                                    </button>
                                    <button
                                      type="button"
                                      className="account-section__cancel-item-dismiss"
                                      disabled={requestingCancellationItemId === itemKey}
                                      onClick={() => openCancellationForm(order, item)}
                                    >
                                      Keep item
                                    </button>
                                  </div>
                                </div>
                              )}

                              {/* 1. In-UI Return Feedback Banner (Success / Error notification - No alert/popup) */}
                              {returnFeedback[itemKey] && (
                                <div
                                  className={`account-section__return-feedback is-${returnFeedback[itemKey].type}`}
                                  role={
                                    returnFeedback[itemKey].type === "success"
                                      ? "status"
                                      : "alert"
                                  }
                                >
                                  <div className="account-section__return-feedback-icon">
                                    {returnFeedback[itemKey].type === "success"
                                      ? "✓"
                                      : "⚠"}
                                  </div>
                                  <div className="account-section__return-feedback-body">
                                    <strong>
                                      {returnFeedback[itemKey].type ===
                                      "success"
                                        ? "Return request submitted"
                                        : "Unable to process return"}
                                    </strong>
                                    <p>{returnFeedback[itemKey].message}</p>
                                    {returnFeedback[itemKey].reason && (
                                      <small className="account-section__return-feedback-reason">
                                        Reason: "
                                        {returnFeedback[itemKey].reason}"
                                      </small>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    className="account-section__return-feedback-close"
                                    onClick={() =>
                                      dismissReturnFeedback(itemKey)
                                    }
                                    aria-label="Dismiss notification"
                                  >
                                    ×
                                  </button>
                                </div>
                              )}

                              {/* 2. In-UI Return Status Card (when requested or reviewed, without pending banner) */}
                              {item.fulfillmentStatus === "Delivered" &&
                                item.returnRequest?.status &&
                                item.returnRequest.status !== "none" &&
                                !returnFeedback[itemKey] && (
                                  <div
                                    className={`account-section__return-status-card is-${item.returnRequest.status}`}
                                  >
                                    <span className="account-section__return-status-card-icon">
                                      {item.returnRequest.status === "approved"
                                        ? "✓"
                                        : item.returnRequest.status ===
                                            "rejected"
                                          ? "✕"
                                          : "⏳"}
                                    </span>
                                    <div className="account-section__return-status-card-body">
                                      <div className="account-section__return-status-card-head">
                                        <strong>
                                          {item.returnRequest.status ===
                                          "approved"
                                            ? "Return approved by maker"
                                            : item.returnRequest.status ===
                                                "rejected"
                                              ? "Return request declined"
                                              : "Return request under review"}
                                        </strong>
                                        <span
                                          className={`account-section__return-status-pill is-${item.returnRequest.status}`}
                                        >
                                          {item.returnRequest.status ===
                                          "approved"
                                            ? "Approved"
                                            : item.returnRequest.status ===
                                                "rejected"
                                              ? "Declined"
                                              : "Pending review"}
                                        </span>
                                      </div>
                                      <p>
                                        {item.returnRequest.status ===
                                        "approved"
                                          ? "The artisan approved your return. Courier pickup and refund to your payment method are being arranged."
                                          : item.returnRequest.status ===
                                              "rejected"
                                            ? "The maker was unable to accept this return. If eligible, you may submit again or reach our Customer Concierge."
                                            : "Your return request has been received by the artisan. You will be updated once reviewed."}
                                      </p>
                                      {item.returnRequest.reason && (
                                        <small className="account-section__return-status-card-reason">
                                          Recorded issue: "
                                          {item.returnRequest.reason}"
                                        </small>
                                      )}
                                    </div>
                                  </div>
                                )}

                              {/* 3. Inline Return Form UI */}
                              {isReturnFormOpen && (
                                <div
                                  className="account-section__return-panel"
                                  role="region"
                                  aria-label={`Return request for ${item.name}`}
                                >
                                  <div className="account-section__return-panel-head">
                                    <div className="account-section__return-panel-head-icon">
                                      ↩
                                    </div>
                                    <div>
                                      <p className="eyebrow">
                                        Artisan return guarantee
                                      </p>
                                      <h4>
                                        Return <em>{item.name}</em>
                                      </h4>
                                      <p>
                                        Please select the reason for returning
                                        this piece. The maker will review your
                                        request within 2 business days.
                                      </p>
                                    </div>
                                  </div>

                                  {/* In-form error message if any */}
                                  {returnError[itemKey] && (
                                    <div
                                      className="account-section__return-error-banner"
                                      role="alert"
                                    >
                                      <span className="account-section__return-error-icon">
                                        ⚠
                                      </span>
                                      <p>{returnError[itemKey]}</p>
                                      <button
                                        type="button"
                                        className="account-section__return-error-dismiss"
                                        onClick={() =>
                                          setReturnError((prev) => ({
                                            ...prev,
                                            [itemKey]: "",
                                          }))
                                        }
                                        aria-label="Dismiss error"
                                      >
                                        ×
                                      </button>
                                    </div>
                                  )}

                                  <div className="account-section__return-reasons-grid">
                                    {returnReasons.map((r) => {
                                      const isSelected =
                                        returnReason === r.label;
                                      return (
                                        <button
                                          key={r.label}
                                          type="button"
                                          className={`account-section__return-reason-card ${isSelected ? "is-selected" : ""}`}
                                          onClick={() => {
                                            setReturnReason(r.label);
                                            if (r.label !== "Something else") {
                                              setReturnCustomText("");
                                            }
                                            if (returnError[itemKey]) {
                                              setReturnError((prev) => ({
                                                ...prev,
                                                [itemKey]: "",
                                              }));
                                            }
                                          }}
                                        >
                                          <div className="account-section__return-reason-head">
                                            <span className="account-section__return-reason-icon">
                                              {r.icon}
                                            </span>
                                            <span className="account-section__return-reason-title">
                                              {r.label}
                                            </span>
                                            <span
                                              className="account-section__return-reason-radio"
                                              aria-hidden="true"
                                            >
                                              {isSelected ? "✓" : ""}
                                            </span>
                                          </div>
                                          <span className="account-section__return-reason-desc">
                                            {r.desc}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {/* Visible input field at the bottom when user selects 'Something else' */}
                                  {returnReason === "Something else" && (
                                    <div className="account-section__return-custom-box">
                                      <div className="account-section__return-custom-header">
                                        <label
                                          htmlFor={`custom-reason-${itemKey}`}
                                          className="account-section__return-custom-label"
                                        >
                                          Write your own issue or problem{" "}
                                          <span className="account-section__return-required">
                                            *
                                          </span>
                                        </label>
                                        <span className="account-section__return-char-count">
                                          {returnCustomText.length} / 500
                                        </span>
                                      </div>
                                      <textarea
                                        id={`custom-reason-${itemKey}`}
                                        className="account-section__return-custom-textarea"
                                        placeholder="Please describe the exact issue or problem with your piece in detail..."
                                        value={returnCustomText}
                                        onChange={(e) => {
                                          setReturnCustomText(e.target.value);
                                          if (returnError[itemKey]) {
                                            setReturnError((prev) => ({
                                              ...prev,
                                              [itemKey]: "",
                                            }));
                                          }
                                        }}
                                        rows={3}
                                        maxLength={500}
                                        autoFocus
                                      />
                                      <p className="account-section__return-custom-hint">
                                        This description will be shared with the
                                        artisan and customer concierge to
                                        resolve your return promptly.
                                      </p>
                                    </div>
                                  )}

                                  <div className="account-section__return-panel-actions">
                                    <button
                                      type="button"
                                      className="account-section__return-submit-btn"
                                      disabled={
                                        !canSubmitReturn || isReturningThis
                                      }
                                      onClick={() => submitReturn(order, item)}
                                    >
                                      {isReturningThis
                                        ? "Submitting request…"
                                        : "Submit return request ↗"}
                                    </button>
                                    <button
                                      type="button"
                                      className="account-section__return-cancel-btn"
                                      onClick={() => {
                                        setReturnFormKey("");
                                        setReturnReason("");
                                        setReturnCustomText("");
                                        setReturnError((prev) => ({
                                          ...prev,
                                          [itemKey]: "",
                                        }));
                                      }}
                                      disabled={isReturningThis}
                                    >
                                      Cancel
                                    </button>
                                  </div>

                                  <div className="account-section__return-panel-footer">
                                    <span>🔒 7-day return guarantee</span>
                                    <span>·</span>
                                    <span>Artisan direct resolution</span>
                                    <span>·</span>
                                    <span>
                                      Refund to original payment method
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="account-section__order-total">
                        <span>Total</span>
                        <strong>{money(order.total)}</strong>
                      </div>
                      <div className="account-section__order-customer">
                        <span>{order.customer.name}</span>
                        <span>{order.customer.address}</span>
                        <span>{order.customer.city}</span>
                        <span>
                          {order.customer.phone} · {order.customer.email}
                        </span>
                        <span>
                          {order.paymentMethod} · {order.paymentStatus}
                        </span>
                        {order.paymentDetails?.refundStatus === "pending" && (
                          <span className="account-section__refund-note">
                            Refund pending admin follow-up. Your payment remains
                            recorded as paid until refunded.
                          </span>
                        )}
                      </div>
                      <div className="account-section__order-actions">
                        <button
                          type="button"
                          className="account-section__track-order"
                          aria-expanded={trackingOrderId === order.id}
                          onClick={() => {
                            setTrackingOrderId((current) =>
                              current === order.id ? "" : order.id,
                            );
                            if (trackingOrderId !== order.id) {
                              onRefreshOrders?.();
                            }
                          }}
                        >
                          {trackingOrderId === order.id
                            ? "Hide tracking"
                            : "Track order"}
                        </button>
                        {order.status !== "Delivered" &&
                          order.status !== "Cancelled" &&
                          !(order.items || []).some(
                            (item) => item.fulfillmentStatus === "Out for delivery",
                          ) &&
                          !(order.items || []).some(
                            (item) => item.fulfillmentStatus === "Delivered",
                          ) &&
                          onCancelOrder && (
                            <button
                              type="button"
                              className="account-section__cancel-order"
                              onClick={() => setConfirmCancelOrderId(order.id)}
                              disabled={cancellingOrderId === order.id}
                            >
                              {cancellingOrderId === order.id
                                ? "Cancelling…"
                                : "Cancel order"}
                            </button>
                          )}
                      </div>
                      {/* Inline cancel confirmation in UI (no window.confirm popup) */}
                      {confirmCancelOrderId === order.id && (
                        <div
                          className="account-section__cancel-confirm"
                          role="alert"
                        >
                          <div className="account-section__cancel-confirm-icon">
                            ⚠
                          </div>
                          <div className="account-section__cancel-confirm-body">
                            <strong>Cancel Order #{order.id}?</strong>
                            <p>
                              {order.paymentStatus === "paid"
                                ? "This order was paid. Its payment will remain recorded until an administrator processes your refund."
                                : "Are you sure you want to cancel this order? This action cannot be undone."}
                            </p>
                          </div>
                          <div className="account-section__cancel-confirm-actions">
                            <button
                              type="button"
                              className="account-section__cancel-confirm-yes"
                              disabled={cancellingOrderId === order.id}
                              onClick={() => cancelOrder(order)}
                            >
                              {cancellingOrderId === order.id
                                ? "Cancelling…"
                                : "Yes, cancel order"}
                            </button>
                            <button
                              type="button"
                              className="account-section__cancel-confirm-no"
                              onClick={() => setConfirmCancelOrderId("")}
                            >
                              Keep order
                            </button>
                          </div>
                        </div>
                      )}
                      {trackingOrderId === order.id && (
                        <div className="account-section__order-tracking">
                          <button
                            type="button"
                            className="account-section__track-refresh"
                            onClick={() => onRefreshOrders?.()}
                          >
                            Refresh tracking status
                          </button>
                          {/* Status banner */}
                          <div
                            className={`account-section__tracking-banner ${
                              order.status === "Cancelled"
                                ? "is-cancelled"
                                : order.status === "Payment failed"
                                  ? "is-failed"
                                  : order.status === "Delivered"
                                    ? "is-delivered"
                                    : "is-active"
                            }`}
                          >
                            <span className="account-section__tracking-banner-icon">
                              {order.status === "Cancelled"
                                ? "✕"
                                : order.status === "Payment failed"
                                  ? "⚠"
                                  : order.status === "Delivered"
                                    ? "✓"
                                    : "↻"}
                            </span>
                            <div>
                              <strong>
                                {order.status === "Awaiting payment"
                                  ? "Awaiting payment confirmation"
                                  : order.status === "Payment failed"
                                    ? "Payment was not completed"
                                    : order.status === "Cancelled"
                                      ? `Cancelled${order.cancelledAt ? ` on ${new Date(order.cancelledAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}` : ""}`
                                      : order.status === "Delivered"
                                        ? "Order delivered — enjoy your craft!"
                                        : "Live update from your maker"}
                              </strong>
                              {order.updatedAt &&
                                order.status !== "Cancelled" && (
                                  <span>
                                    Last updated{" "}
                                    {new Date(order.updatedAt).toLocaleString(
                                      "en-IN",
                                      {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                      },
                                    )}
                                  </span>
                                )}
                            </div>
                          </div>

                          {/* Per-item journey */}
                          {(order.items || []).map((item, index) => {
                            const status = customerOrderStatus(
                              item.fulfillmentStatus ||
                                (order.status === "Delivered"
                                  ? "Delivered"
                                  : order.status),
                            );
                            const currentStage =
                              orderTrackingStages.indexOf(status);
                            return (
                              <div
                                className="account-section__tracking-item"
                                key={`${item.name}-${index}`}
                              >
                                <div className="account-section__tracking-item-head">
                                  <strong>{item.name}</strong>
                                  {orderTrackingStages.includes(status) && (
                                    <span
                                      className={`account-section__tracking-badge ${currentStage === orderTrackingStages.length - 1 ? "is-done" : "is-live"}`}
                                    >
                                      {trackingStageIcons[status]} {status}
                                    </span>
                                  )}
                                </div>

                                {orderTrackingStages.includes(status) ? (
                                  <div className="account-section__tracking-timeline">
                                    {orderTrackingStages.map(
                                      (stage, stageIndex) => {
                                        const done = stageIndex <= currentStage;
                                        const active =
                                          stageIndex === currentStage;
                                        return (
                                          <div
                                            key={stage}
                                            className={`account-section__tracking-node ${done ? "is-done" : ""} ${active ? "is-active" : ""}`}
                                          >
                                            <div className="account-section__tracking-node-rail">
                                              <div className="account-section__tracking-node-dot">
                                                {done ? (
                                                  active ? (
                                                    <span className="dot-pulse" />
                                                  ) : (
                                                    "✓"
                                                  )
                                                ) : (
                                                  ""
                                                )}
                                              </div>
                                              {stageIndex <
                                                orderTrackingStages.length -
                                                  1 && (
                                                <div
                                                  className={`account-section__tracking-node-line ${stageIndex < currentStage ? "is-done" : ""}`}
                                                />
                                              )}
                                            </div>
                                            <div className="account-section__tracking-node-copy">
                                              <span className="account-section__tracking-node-icon">
                                                {trackingStageIcons[stage]}
                                              </span>
                                              <div>
                                                <b>{stage}</b>
                                                <small>
                                                  {trackingStageDesc[stage]}
                                                </small>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      },
                                    )}
                                  </div>
                                ) : (
                                  <span className="account-section__tracking-special">
                                    {status}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "Profile" && (
          <div className="account-section__footer">
            {confirmLogout ? (
              <div
                className="account-section__logout-card"
                role="alertdialog"
                aria-label="Confirm sign out"
              >
                <div>
                  <strong>Sign out of OzaBay?</strong>
                  <small>
                    Your bag and saved pieces stay safe — you’ll find them when
                    you’re back.
                  </small>
                </div>
                <div className="account-section__logout-actions">
                  <button type="button" onClick={() => setConfirmLogout(false)}>
                    Stay signed in
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={handleLogout}
                    disabled={busy}
                  >
                    Sign out
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="account-section__logout"
                onClick={() => setConfirmLogout(true)}
              >
                Sign out ↗
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
