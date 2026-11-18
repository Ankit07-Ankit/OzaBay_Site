# OzaBay_Site

## Super admin access

The admin console is available at `/admin-login`; it is separate from customer and vendor accounts. Configure these values in `ozabay-backend/.env` before signing in:

- `ADMIN_EMAIL`: the administrator's email address.
- `ADMIN_PASSWORD_HASH`: a bcrypt hash of a strong administrator password. From `ozabay-backend`, generate one with `node --input-type=module -e 'import bcrypt from "bcryptjs"; import { createInterface } from "node:readline/promises"; const rl = createInterface({ input: process.stdin, output: process.stdout }); const password = await rl.question("Admin password: "); rl.close(); console.log(await bcrypt.hash(password, 12));'`.

The admin login stays unavailable until both settings are configured. Admin sessions use an HTTP-only cookie and expire after one hour. The console can review accounts and marketplace listings, block or restore account access, and permanently remove accounts or products.

## Google sign-in

Set `GOOGLE_CLIENT_ID` in `ozabay-backend/.env` to your OAuth 2.0 web client ID. The frontend retrieves this public client ID from the backend, so it does not need a separate Vite setting. Add the frontend's origin to that Google OAuth client's authorized JavaScript origins. Google sign-in creates a verified user account on first use and signs in existing accounts with the matching verified email.

Customers can cancel orders before any item is marked delivered. Cancelled orders remain in the admin order history; if a Razorpay payment was captured, the admin panel flags it for manual refund follow-up.

Customers can request a return for each delivered product within seven days of delivery. Vendors review return requests in Orders & Sales, and administrators can see each request's status in the order list.
