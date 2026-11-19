# FinEase — Hyperlocal Grocery & Daily Essentials Delivery

**Tagline:** Your Daily Essentials, All in One Place.  
**Initial Target Market:** Dehradun, Uttarakhand, India (Rajpur Road, Jakhan, Sahastradhara Road, Ballupur, GMS Road, Race Course, Dalanwala, Vasant Vihar, Premnagar, Clement Town, Patel Nagar, Nehru Colony).

FinEase is a full-stack hyperlocal grocery and household essentials delivery web application built with React, TypeScript, Vite, Tailwind CSS v4, Firebase Authentication, Cloud Firestore, Lucide React, and Recharts.

---

## Core Capabilities

### 1. Customer Storefront & Commerce
- **Editorial Storefront**: Dehradun locality switcher, instant search, 10 daily-essentials categories, featured picks, best sellers, and transparent Cash-on-Delivery (COD) service standards.
- **Shop Catalog**: Real-time search, category filtering, price/name sorting, in-stock filter, uniform 4:3 product cards, and a full Product Detail modal with unit pricing and quantity controls.
- **Persistent Shopping Basket**: Synced locally for guests and persisted to Firestore (`carts/{uid}`) for signed-in customers, with coupon validation (`WELCOME50`, `DOON10`) and free-delivery threshold tracking.
- **COD-Only Checkout**: Dehradun address book CRUD (with 6-digit pincode & phone validation) and atomic Firestore transaction checkout (`runTransaction`) that validates live stock, deducts inventory, logs inventory changes, increments coupon usage, and creates the order.
- **Customer Account**: 7-step Order Tracking timeline (`Pending -> Confirmed -> Preparing -> Ready for Pickup -> Assigned to Delivery -> Out for Delivery -> Delivered`, plus `Cancelled`), saved addresses, support tickets with live threaded messaging, and profile/theme preferences.

### 2. Dedicated Role-Based Dashboards (RBAC)
Roles (`customer`, `owner`, `store_manager`, `delivery_partner`) are never assigned from client signup forms. The bootstrapped owner account (`pandarishal568@gmail.com`, verified email required) provisions operational staff roles via the protected `/staff_roles/{uid}` collection.

- **Owner / Super Admin Console (16 Modules)**:
  - Overview (with one-click Starter Catalog seeding into Firestore), Orders, Products, Categories, Customers, Inventory (mandatory-reason audit logs), Suppliers, Delivery Partners, Delivery Assignments, Finance (real actuals strictly separated from hypothetical Conservative ₹250 / Base ₹300 / Ambitious ₹350 AOV planning forecasts), Expenses, Coupons, Support Tickets, Reports (zero-cost CSV export), Activity Logs, and Settings (including Staff Role Provisioning).
- **Store Manager Workspace**:
  - Focused strictly on order fulfillment (`confirmed`, `preparing`, `ready_for_pickup`), interactive per-item picking checklists, and inventory/low-stock adjustments with mandatory reason logs. No access to finance, expenses, platform settings, or role provisioning.
- **Delivery Partner Console**:
  - Scoped strictly to orders assigned to the signed-in partner (`assigned -> accepted -> picked_up -> out_for_delivery -> delivered`), with Cash on Delivery collection confirmation and delivery history.

### 3. Unified Light, Dark & System Theme System
- Dedicated light and dark semantic CSS variables (`--bg-canvas`, `--bg-surface`, `--bg-elevated`, `--text-primary`, `--brand-primary`, status tokens, shadows).
- Accessible Light / Dark / System switcher in the navigation bar and workspaces.
- Persisted locally for guests, synced to Firestore user profiles upon login, and preserved locally upon logout.

---

## Zero-Cost Operational Architecture
FinEase is designed to operate strictly within Firebase's free Spark tier:
- **Cash on Delivery (COD) only** — no paid payment gateways.
- **Manual delivery partner assignment** — no paid dispatch or routing APIs.
- **Zero paid SMS, WhatsApp, email, mapping, or AI APIs**.
- **Client-side CSV report exports** — no paid reporting pipelines.

---

## Firebase Setup & Verification

1. **Firebase Project**: Provisioned to project `engaged-shield-fcxst` with Firestore rules deployed (`firestore.rules`).
2. **Google Sign-In**: Enabled automatically during Firebase provisioning.
3. **Enable Email & Password Authentication (One-Time Console Step)**:
   - Open the [Firebase Console](https://console.firebase.google.com/) and select project **`engaged-shield-fcxst`**.
   - Go to **Authentication -> Sign-in method**.
   - Click **Email/Password**, enable the top **Email/Password** toggle, and click **Save**.
4. **Seed Starter Catalog**:
   - Sign in with the owner account (`pandarishal568@gmail.com`), open **Owner Console -> Overview**, and click **Seed Starter Catalog** to populate Firestore with the 10 Dehradun categories, 13 products, starter coupons, and default platform settings.
5. **Security Rules Review**:
   - While `firestore.rules` enforces strict schema, role, and ownership validation across all 17 collections, always review and audit your rules in the Firebase Console before launching to a broad public audience.

---

## Local Development & Tests

```bash
# Run pure commerce, workflow, finance & security-rule unit tests
npx --yes tsx --test src/utils/commerce.test.ts firestore.rules.test.ts

# Validate Firestore security rules
npx eslint firestore.rules

# Type-check & production build
npm run lint
npm run build
```
