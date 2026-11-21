# OzaBay_Site

## Local frontend and backend

The frontend uses relative `/api` and `/uploads` URLs. During local development, Vite proxies both paths to the backend at `http://localhost:3000`; the backend defaults to port `3000`.

1. Configure the backend environment in `ozabay-backend/.env`, including its database connection.
2. In one terminal, run `cd ozabay-backend && npm run dev`.
3. In another terminal, run `cd ozabay-frontend && npm run dev`.
4. Open the local URL printed by Vite (typically `http://localhost:5173`).

Set `VITE_API_BASE_URL` only when intentionally using a separate API origin. The backend allows `http://localhost:5173` as a development origin. Production auth cookies require HTTPS.

## Super admin access

The admin console is available at `/admin-login`; it is separate from customer and vendor accounts. Configure these values in `ozabay-backend/.env` before signing in:

- `ADMIN_EMAIL`: the administrator's email address.
- `ADMIN_PASSWORD_HASH`: a bcrypt hash of a strong administrator password. From `ozabay-backend`, generate one with `node --input-type=module -e 'import bcrypt from "bcryptjs"; import { createInterface } from "node:readline/promises"; const rl = createInterface({ input: process.stdin, output: process.stdout }); const password = await rl.question("Admin password: "); rl.close(); console.log(await bcrypt.hash(password, 12));'`.

The admin login stays unavailable until both settings are configured. Admin sessions use an HTTP-only cookie and expire after one hour. The console can review accounts and marketplace listings, block or restore account access, and permanently remove accounts or products.

## Google sign-in

Set `GOOGLE_CLIENT_ID` in `ozabay-backend/.env` to your OAuth 2.0 web client ID. The frontend retrieves this public client ID from the backend, so it does not need a separate Vite setting. Add the frontend's origin to that Google OAuth client's authorized JavaScript origins. Google sign-in creates a verified user account on first use and signs in existing accounts with the matching verified email.

Customers can cancel orders before any item is out for delivery. For an item already out for delivery, customers can submit a product-specific cancellation request for vendor review. If the vendor approves a request for a paid order, the admin panel flags the product refund for manual follow-up.

Customers can request a return for each delivered product within seven days of delivery. Vendors review return requests in Orders & Sales, and administrators can see each request's status in the order list.
