# OzaBay_Site

## Local frontend and backend

The frontend uses relative `/api` and `/uploads` URLs. During local development, Vite proxies both paths to the backend at `http://localhost:3000`; the backend defaults to port `3000`.

1. Configure the backend environment in `ozabay-backend/.env`, including its database connection.
2. In one terminal, run `cd ozabay-backend && npm run dev`.
3. In another terminal, run `cd ozabay-frontend && npm run dev`.
4. Open the local URL printed by Vite (typically `http://localhost:5173`).

Set `VITE_API_BASE_URL` only when intentionally using a separate API origin. The backend allows `http://localhost:5173` as a development origin. Production auth cookies require HTTPS.

## Super admin access

The admin console sign-in is available at `/ozabay-control-7e4c9d` or by entering the administrator credentials on the regular sign-in page. The dashboard requires a server-verified admin session, and the old `/admin` and `/admin-login` paths redirect away. The non-obvious URL is only an extra layer of obscurity; it is not a replacement for authentication. Admin access remains separate from customer and vendor accounts. Configure these values in `ozabay-backend/.env` before signing in:

- `ADMIN_EMAIL`: the administrator's email address.
- `ADMIN_PASSWORD_HASH`: a bcrypt hash of a strong administrator password. From `ozabay-backend`, generate one with `node --input-type=module -e 'import bcrypt from "bcryptjs"; import { createInterface } from "node:readline/promises"; const rl = createInterface({ input: process.stdin, output: process.stdout }); const password = await rl.question("Admin password: "); rl.close(); console.log(await bcrypt.hash(password, 12));'`.

The admin login stays unavailable until both settings are configured. Admin sessions expire after one hour; the admin panel uses a session-scoped bearer token for cross-origin API requests and retains the HTTP-only cookie for compatible same-site requests. The console can review accounts and marketplace listings, block or restore account access, and permanently remove accounts or products.

## Razorpay payments

Configure `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in the backend deployment using keys from the same Razorpay test or live mode. Enable UPI, cards, wallets, and netbanking for the Razorpay account in its Dashboard; Checkout displays the methods that the account is eligible to accept. UPI Collect (entering a UPI ID) is hidden because Razorpay deprecated that flow for most merchants; Checkout uses UPI Intent on supported mobile browsers and QR on desktop. To recover orders when a customer closes checkout or the browser cannot send its confirmation, configure a Razorpay webhook at `<backend-origin>/api/orders/razorpay/webhook` for the `payment.captured`, `order.paid`, and `payment.failed` events. Set `RAZORPAY_WEBHOOK_SECRET` in the backend deployment to the same webhook secret entered in the Razorpay Dashboard. The backend verifies captured payment amount, currency, and order before confirming an order; authorized payments are captured during checkout verification. Customers receive an order-confirmation email with successful Razorpay payment details and a payment-failure email for failed attempts.

If the frontend and backend are deployed separately, set `VITE_API_BASE_URL` in the frontend deployment to the backend origin and redeploy the frontend. A failed UPI/bank attempt is not an order confirmation; the checkout keeps the cart so the customer can retry, and any bank debit for a failed attempt must be reversed by the bank/Razorpay.

## Google sign-in

Set `GOOGLE_CLIENT_ID` in `ozabay-backend/.env` and the backend deployment to your OAuth 2.0 web client ID. The frontend retrieves this public client ID from the backend, so it does not need a separate Vite setting. Add each frontend origin to that Google OAuth client's authorized JavaScript origins. The backend allows `https://ozabay.com`, `https://www.ozabay.com`, and `https://oza-bay-site-iota.vercel.app`; set `FRONTEND_URL` to a comma-separated list for any other frontend origins. Google sign-in creates a verified user account on first use and signs in existing accounts with the matching verified email.

Customers can cancel orders before any item is out for delivery. For an item already out for delivery, customers can submit a product-specific cancellation request for vendor review. If the vendor approves a request for a paid order, the admin panel flags the product refund for manual follow-up.

Customers can request a return for each delivered product within seven days of delivery. Vendors review return requests in Orders & Sales, and administrators can see each request's status in the order list.

Vendor product images and videos are uploaded in 3 MB chunks, assembled in MongoDB GridFS, and served from `/api/products/media/:mediaId`. Chunked requests stay below serverless request-size limits; the overall per-file limit remains 50 MB. New uploads do not write product media to local disk; existing product media stored under `/uploads/vendor-products` remains available for compatibility.

## Email delivery

The backend sends email through the Gmail API over HTTPS, avoiding SMTP egress restrictions on hosting platforms such as Render. Enable the Gmail API in the Google Cloud project for `GOOGLE_CLIENT_ID`. Keep `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`, and `GOOGLE_USER` configured in the backend deployment. The refresh token must have the `https://www.googleapis.com/auth/gmail.send` scope (or the broader `https://mail.google.com/` scope); if Gmail reports insufficient permissions, generate a refresh token with the send scope and update `GOOGLE_REFRESH_TOKEN`.

`GOOGLE_USER` is the account authenticated by the refresh token. `EMAIL_FROM` optionally sets the visible sender address and defaults to `GOOGLE_USER`; use it only for the account's primary address or a verified Gmail “Send mail as” alias. `EMAIL_REPLY_TO` optionally sets the reply address. For branded delivery, use a Google Workspace mailbox on `ozabay.com` (or a verified `ozabay.com` alias), authenticate with that mailbox, and set `EMAIL_FROM` to that address. Google requires a configured send-as alias before the Gmail API can use a custom From address ([Gmail send-as aliases](https://developers.google.com/workspace/gmail/api/guides/alias_and_signature_settings)).

For inbox placement, authenticate the sending domain in DNS. If Google Workspace is the only sender, publish one SPF TXT record at the domain root containing `v=spf1 include:_spf.google.com ~all`; merge this authorization into any existing SPF record instead of creating a second one. Generate and enable a DKIM key in the Google Admin console and publish the exact TXT record Google provides. Publish a DMARC TXT record at `_dmarc.ozabay.com`, starting with a monitoring policy such as `v=DMARC1; p=none; rua=mailto:dmarc@ozabay.com` and use a mailbox that can receive those reports. Google's sender guidelines recommend SPF, DKIM, and DMARC, aligned with the From domain; authentication and good sending reputation reduce spam placement but cannot guarantee the Gmail Primary tab ([Gmail sender guidelines](https://support.google.com/mail/answer/81126), [Postmaster Tools](https://support.google.com/mail/answer/14668346)).
