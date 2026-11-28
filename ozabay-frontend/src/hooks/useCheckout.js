import { useEffect, useState } from "react";
import { checkoutAttempt, checkoutFor, readAccount } from "../utils/customerSession.js";

const loadRazorpay = () =>
  new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve(window.Razorpay);
      return;
    }

    const existing = document.querySelector("script[data-razorpay-checkout]");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.Razorpay), {
        once: true,
      });
      existing.addEventListener(
        "error",
        () =>
          reject(
            new Error(
              "Unable to load Razorpay checkout. Check your connection.",
            ),
          ),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.dataset.razorpayCheckout = "true";
    script.onload = () => resolve(window.Razorpay);
    script.onerror = () => {
      script.remove();
      reject(
        new Error("Unable to load Razorpay checkout. Check your connection."),
      );
    };
    document.body.appendChild(script);
  });

export default function useCheckout({ account, cart, requestAuthenticatedApi, onComplete, onSignIn }) {
  const [checkout, setCheckout] = useState(() => checkoutFor(account));
  const [placedOrder, setPlacedOrder] = useState(null);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    setCheckout(checkoutFor(account));
    setPlacedOrder(null);
    setCheckoutBusy(false);
    setCheckoutError("");
  }, [account?.id, account?.accountType]);

  const completeOrder = (savedOrder) => {
    if (readAccount()?.id !== account.id) return;
    sessionStorage.removeItem(`ozabay-checkout-${account.id}`);
    const order = {
      id: savedOrder._id,
      createdAt: savedOrder.createdAt,
      updatedAt: savedOrder.updatedAt,
      items: savedOrder.items.map((item) => ({
        name: item.name,
        productId: item.productId,
        qty: item.quantity,
        priceValue: item.unitPrice,
        fulfillmentStatus: item.fulfillmentStatus,
        deliveredAt: item.deliveredAt,
        cashOnDelivery: item.cashOnDelivery,
        cancellationRequest: item.cancellationRequest,
        returnRequest: item.returnRequest,
      })),
      total: savedOrder.total,
      customer: savedOrder.customer,
      status: savedOrder.orderStatus,
      paymentMethod: savedOrder.paymentMethod,
      paymentStatus: savedOrder.paymentStatus,
      paymentDetails: savedOrder.paymentDetails,
      cancelledAt: savedOrder.cancelledAt,
    };
    setPlacedOrder(order);
    setCheckoutBusy(false);
    setCheckoutError("");
    onComplete(order);
  };
  const placeOrder = async (e) => {
    e.preventDefault();
    if (!cart.length || checkoutBusy) return;
    if (account?.accountType !== "user") {
      onSignIn();
      return;
    }
    if (
      cart.some((item) => !/^vendor-[a-fA-F0-9]{24}$/.test(String(item.id)))
    ) {
      setCheckoutError(
        "Custom-made items need a separate quote and can't be included in this checkout. Remove them from your cart to continue.",
      );
      return;
    }

    setCheckoutBusy(true);
    setCheckoutError("");
    try {
      const { payment, ...customer } = checkout;
      const payload = {
        items: cart.map((item) => ({ productId: item.id, quantity: item.qty })),
        customer,
        paymentMethod: payment,
      };
      const checkoutAttemptId = await checkoutAttempt(account.id, payload);
      const { order, razorpay } = await requestAuthenticatedApi("/orders", {
        method: "POST",
        body: JSON.stringify({ ...payload, checkoutAttemptId }),
      });
      if (readAccount()?.id !== account.id) return;

      if (payment === "Cash on delivery" || order.paymentStatus === "paid") {
        completeOrder(order);
        return;
      }

      await loadRazorpay();
      if (readAccount()?.id !== account.id) return;
      if (!window.Razorpay) {
        throw new Error("Razorpay checkout is unavailable in this browser.");
      }
      if (!razorpay?.keyId || !razorpay?.orderId) {
        throw new Error(
          "Online payment could not be initialized. Please try again.",
        );
      }

      const paymentWindow = new window.Razorpay({
        key: razorpay.keyId,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        name: "OzaBay",
        description: "Handcrafted marketplace order",
        order_id: razorpay.orderId,
        prefill: {
          name: checkout.name,
          email: checkout.email,
          contact: checkout.phone,
        },
        theme: { color: "#17365f" },
        config: {
          display: {
            blocks: {
              online: {
                name: "Pay using UPI, cards, wallets or netbanking",
                instruments: [
                  { method: "upi" },
                  { method: "card" },
                  { method: "wallet" },
                  { method: "netbanking" },
                ],
              },
            },
            sequence: ["block.online"],
            hide: [{ method: "upi", flows: ["collect"] }],
            preferences: { show_default_blocks: false },
          },
        },
        handler: async (paymentResult) => {
          if (readAccount()?.id !== account.id) return;
          let verificationError;
          const verificationOptions = {
            method: "POST",
            body: JSON.stringify({
              orderId: order._id,
              ...paymentResult,
            }),
          };
          for (let attempt = 0; attempt < 4; attempt += 1) {
            if (attempt > 0) {
              await new Promise((resolve) =>
                window.setTimeout(resolve, attempt * 750),
              );
            }
            try {
              const verified = await requestAuthenticatedApi(
                "/orders/verify-payment",
                verificationOptions,
              );
              completeOrder(verified.order);
              return;
            } catch (error) {
              if (error.code === "checkout_cancelled") {
                if (readAccount()?.id === account.id) {
                  sessionStorage.removeItem(`ozabay-checkout-${account.id}`);
                  setCheckoutError(error.message);
                  setCheckoutBusy(false);
                }
                return;
              }
              verificationError = error;
              const paymentMayStillSettle =
                error.message === "The payment has not been captured for this order.";
              const retryableResponse =
                !Number.isInteger(error.status) ||
                error.status >= 500 ||
                error.status === 408 ||
                error.status === 429;
              if (!paymentMayStillSettle && !retryableResponse) break;
            }
          }

          for (let attempt = 0; attempt < 3; attempt += 1) {
            await new Promise((resolve) =>
              window.setTimeout(resolve, (attempt + 1) * 1000),
            );
            try {
              const { orders: latestOrders } = await requestAuthenticatedApi(
                "/orders/mine",
                { cache: "no-store" },
              );
              const paidOrder = latestOrders?.find(
                (latestOrder) =>
                  latestOrder._id === order._id &&
                  latestOrder.paymentStatus === "paid" && latestOrder.orderStatus !== "Cancelled",
              );
              if (paidOrder) {
                completeOrder(paidOrder);
                return;
              }
            } catch (refreshError) {
              console.error(
                "Unable to refresh order after payment verification failed:",
                refreshError,
              );
            }
          }
          if (readAccount()?.id !== account.id) return;
          setCheckoutError(
            `Razorpay has not confirmed this payment yet, so the order is not confirmed. Do not retry until the payment status is resolved. Check your Orders page; contact support with order ${order._id} if it remains unpaid. ${verificationError?.message || "Payment verification could not be completed."}`,
          );
          setCheckoutBusy(false);
        },
        modal: {
          ondismiss: () => setCheckoutBusy(false),
          escape: true,
          confirm_close: true,
        },
      });
      paymentWindow.on("payment.failed", (response) => {
        if (readAccount()?.id !== account.id) return;
        console.error("Razorpay payment failed:", response?.error);
        setCheckoutError(
          `Razorpay could not complete this payment${response?.error?.description ? `: ${response.error.description}` : ""}. Your order is not confirmed. If your bank account was debited, check for a reversal before retrying.`,
        );
        setCheckoutBusy(false);
      });
      paymentWindow.open();
    } catch (error) {
      if (readAccount()?.id !== account.id) return;
      if (error.code === "checkout_cancelled") sessionStorage.removeItem(`ozabay-checkout-${account.id}`);
      setCheckoutError(error.message);
      setCheckoutBusy(false);
    }
  };
  return { checkout, setCheckout, placedOrder, checkoutBusy, checkoutError, placeOrder };
}
