# FinEase — Technical Documentation

## 1. Architecture Overview

FinEase is a client-driven full-stack React + TypeScript + Vite application backed by Firebase Authentication and Cloud Firestore (`firebase-applet-config.json`).

### Layer Separation
- **Domain Logic (`src/utils/`)**: Pure, framework-agnostic functions for commerce math, coupon rules, stock validation, INR formatting, CSV serialization (`commerce.ts`), role-gated order & delivery state machines (`workflow.ts`), and financial actuals vs. hypothetical forecast modeling (`finance.ts`). Covered by `node:test` unit tests (`src/utils/commerce.test.ts`).
- **Firebase SDK & Data Service (`src/lib/`)**:
  - `firebase.ts`: Initializes Firebase App, Auth (`GoogleAuthProvider`), and named Firestore instance `getFirestore(app, firebaseConfig.firestoreDatabaseId)`, plus a non-blocking startup connectivity check.
  - `firestoreError.ts`: Structured permission/operation error formatter (`OperationType`, `FirestoreErrorInfo`, `handleFirestoreError`).
  - `firestoreService.ts`: Encapsulates all Firestore queries, real-time `onSnapshot` subscriptions, atomic COD checkout transaction (`placeCodOrderTransaction`), inventory adjustments with mandatory audit logs, workflow transitions, Master-Gated support messaging, and one-click catalog seeding.
- **State Contexts (`src/contexts/`)**: `ToastContext`, `ThemeContext`, `AuthContext`, `StoreDataContext`, `CartContext`.
- **UI & Modules (`src/components/`)**:
  - `ui/`: Design primitives (`FinEaseLogo`, `ThemeSwitcher`, `ProductImage`, `StatusLabel`, `Modal`, `EmptyState`, `ErrorBoundary`).
  - `auth/`: `AuthModal` (Email/Password login, registration, password reset, show/hide password, Google Sign-In, clear inline guidance for `auth/operation-not-allowed`).
  - `storefront/`: `Navbar`, `HomePage`, `ShopPage`, `ProductCard`, `ProductDetailModal`, `CartDrawer`, `CheckoutView`, `OrderTimeline`, `CustomerDashboard`.
  - `operations/`: `StoreManagerDashboard`, `DeliveryPartnerDashboard`.
  - `admin/`: `AdminDashboard`, `AdminOverviewFinance`, `AdminCatalogModules`, `AdminOrdersDeliveryModules`, `AdminBusinessModules`.

---

## 2. Cloud Firestore Collections & Schema (`firebase-blueprint.json`)

| Collection | Purpose | Primary Access |
|---|---|---|
| `/users/{uid}` | Customer & staff profiles (`themePreference`, `locality`, `role`) | Self read/update (role immutable); Owner full management |
| `/staff_roles/{uid}` | Server-trusted operational role assignments (`owner`, `store_manager`, `delivery_partner`) | Self `get` only; Owner full CRUD |
| `/categories/{categoryId}` | 10 grocery & daily essentials categories | Public read; Owner CRUD |
| `/products/{productId}` | Store SKU catalog with live stock, MRP, discount price, cost price | Public read; Owner CRUD; Store Manager stock updates; Customer checkout decrement |
| `/carts/{uid}` | Authenticated customer persistent basket | Owner-scoped (`uid == request.auth.uid`) |
| `/addresses/{addressId}` | Customer Dehradun delivery addresses | Owner-scoped (`userId == request.auth.uid`) + Staff read |
| `/orders/{orderId}` | COD orders with immutable line items, address snapshot, 7-step status, picking checklist | Customer own orders; Store Manager/Owner full queue; Delivery Partner assigned orders only |
| `/inventory_logs/{logId}` | Immutable audit trail of every stock change (`order_deduction`, `restock`, `damage`, `manual_adjustment`, `cancellation_restore`) | Append-only; Staff read |
| `/suppliers/{supplierId}` | Dehradun wholesale & farm suppliers | Owner only |
| `/delivery_partners/{partnerId}` | Active local delivery riders | Owner CRUD; Partner self read/availability |
| `/delivery_assignments/{assignmentId}` | Manual dispatch log linking orders to riders | Owner CRUD; Assigned partner read/update |
| `/coupons/{couponId}` | Promotional codes (`flat` or `percentage`, min order, usage cap) | Public read; Owner CRUD; Checkout usage increment |
| `/expenses/{expenseId}` | Operating expenses (inventory, packaging, fuel, salaries, rent, marketing) | Owner only |
| `/support_tickets/{ticketId}` | Customer support requests (`open`, `in_progress`, `resolved`, `closed`) | Customer own tickets; Owner full access |
| `/support_tickets/{ticketId}/messages/{messageId}` | Threaded ticket messages | Master-Gated via `ticketOwnerId` verified on create; Customer own ticket or Owner |
| `/audit_logs/{logId}` | Immutable system activity log | Append-only by authenticated actor; Owner read |
| `/platform_settings/{settingId}` | Delivery fee, free delivery threshold, min order, Dehradun localities | Public read; Owner write |

---

## 3. Security Rules & RBAC Model (`firestore.rules`)

1. **Default Deny**: No wildcard fallback rules; all paths are explicitly enumerated.
2. **Bootstrapped Owner**: `pandarishal568@gmail.com` with `request.auth.token.email_verified == true` is recognized as `isOwner()`. Additional staff roles are resolved exclusively from `/staff_roles/{request.auth.uid}` (`isActive == true`).
3. **Anti-Privilege-Escalation**: Clients registering a profile in `/users/{uid}` can only set `role == 'customer'` (unless bootstrapped owner) and cannot mutate `role` on update.
4. **Master-Gated Support Messages**: Every message stores `ticketOwnerId` verified against the parent `support_tickets/{ticketId}` document on `create`, allowing zero-leak `allow list` scoped to `resource.data.ticketOwnerId == request.auth.uid || isOwner()` without O(n) reads.
5. **Terminal Order Locking**: Once an order reaches `delivered` or `cancelled`, its status cannot be mutated further by operational workflows.
6. **Lint & Static Tests**: Audited via `npx eslint firestore.rules` (using `@firebase/eslint-plugin-security-rules`) and `firestore.rules.test.ts` (10/10 tests passing).

---

## 4. Workflows & Financial Integrity

### 7-Step Customer Order Lifecycle
`pending -> confirmed -> preparing -> ready_for_pickup -> assigned -> out_for_delivery -> delivered` (plus `cancelled` before delivery).

### 5-Step Delivery Partner Lifecycle
`assigned -> accepted -> picked_up -> out_for_delivery -> delivered` with explicit Cash on Delivery confirmation.

### Financial Actuals vs. Planning Forecast Scenarios
- **Actual Metrics**: Computed strictly from live Firestore `orders` and `expenses` documents. Displays honest empty states when 0 orders exist.
- **Hypothetical Forecast Scenarios**: Strictly separated into a dedicated Planning Forecast tab with explicit disclaimers (*Hypothetical Planning Assumptions — Not Actual Revenue*):
  - **Conservative**: ₹250 AOV, 10 -> 30 orders/day
  - **Base**: ₹300 AOV, 20 -> 50 orders/day
  - **Ambitious**: ₹350 AOV, 35 -> 80 orders/day

---

## 5. Theme Token Architecture

Defined in `src/index.css` using Tailwind CSS v4 (`@custom-variant dark (&:where(.dark, .dark *));`) and semantic CSS variables on `:root` and `.dark`:
- **Light Mode**: Warm porcelain canvas (`#F7F8F6`), pure crisp surfaces (`#FFFFFF`), deep forest green brand (`#0F5132`), obsidian text (`#111814`).
- **Dark Mode**: Layered obsidian-slate surfaces (`#0D1110` canvas, `#151B18` surface, `#1C2420` elevated — avoiding flat pure `#000000`), emerald accent (`#2EA067`), crisp off-white text (`#EFF3F0`).
- **Flash-Free Hydration**: An inline script in `index.html` applies the `.dark` class before React mounts.
- **Profile Sync**: `App.tsx` bridges `ThemeContext` and `AuthContext` so signed-in users persist theme changes to `users/{uid}.themePreference` and restore them on login without erasing local preferences on logout.

---

## 6. Known Operational Notes
- Email/Password sign-in requires enabling the Email/Password provider in Firebase Console (`engaged-shield-fcxst -> Authentication -> Sign-in method`).
- Before an owner seeds the starter catalog into Firestore, the storefront presents the 10-category, 13-product Dehradun starter catalog so guests can explore products, search, filter, and assemble baskets immediately.
