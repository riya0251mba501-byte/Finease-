# FinEase Firestore Security Specification (Phase 0 — Payload-First TDD)

## 1. Data Invariants

1. **Identity & Role Integrity**: Ordinary clients cannot assign themselves `owner`, `store_manager`, or `delivery_partner` roles. New `/users/{userId}` profiles are locked to `role == 'customer'` unless created by the verified bootstrapped Owner (`pandarishal568@gmail.com` with `email_verified == true`) or an existing Owner recorded in `/staff_roles/{uid}`.
2. **PII Isolation**: User profiles (`/users/{userId}`) and delivery addresses (`/addresses/{addressId}`) are strictly readable only by their owner (`userId == request.auth.uid`) or a verified Owner/Admin.
3. **Price & Order Integrity**: Customer-created `/orders/{orderId}` documents must start with `status == 'placed'`, `deliveryStatus == 'unassigned'`, `paymentMethod == 'COD'`, `paymentStatus == 'pending'`, non-negative amounts, `totalAmount == subtotal - discountAmount + deliveryFee`, and valid non-empty items (bounded `<= 50`).
4. **Terminal Order Locking**: Once an order reaches `delivered` or `cancelled`, non-owner clients (customers, store managers, delivery partners) cannot mutate it.
5. **Role-Scoped Order Transitions**:
   - **Customer**: Can only cancel their own order while `status == 'placed'` or `'confirmed'`.
   - **Store Manager**: Can only update `status` (`confirmed -> preparing -> ready_for_pickup`) and `pickingChecklist` on non-terminal orders.
   - **Delivery Partner**: Can only read/update orders where `resource.data.assignedPartnerId == request.auth.uid`, and only transition `deliveryStatus` / `status` along permitted delivery steps (`assigned -> accepted -> picked_up -> out_for_delivery -> delivered`).
6. **Inventory Protection**: Customers and Delivery Partners cannot modify `/products/{productId}` stock or `/inventory_logs/{logId}`. Store Managers can only modify `stock` and `updatedAt` on products (not price, SKU, or active state) and append immutable `/inventory_logs`.
7. **Master Gate on Support Messages**: Reading or posting to `/support_tickets/{ticketId}/messages/{messageId}` requires checking the parent `/support_tickets/{ticketId}` via `get()` to verify the caller is either the ticket owner or an Owner/Admin.
8. **Immutable Audit & Inventory Logs**: `/audit_logs` and `/inventory_logs` are append-only; updates and deletes are unconditionally denied (`allow update, delete: if false`).

## 2. The "Dirty Dozen" Adversarial Payloads

| # | Attack Vector | Target Path | Malicious Payload | Expected Result |
|---|---------------|-------------|-------------------|-----------------|
| 1 | Self-Assigned Admin Role | `/users/attackerUid` | `{"uid":"attackerUid","email":"a@b.com","displayName":"Attacker","role":"owner","themePreference":"dark"}` | `PERMISSION_DENIED` |
| 2 | Ghost Field Shadow Update | `/users/custUid` | `{"displayName":"Legit","isAdmin":true}` | `PERMISSION_DENIED` |
| 3 | Unverified Email Spoof | `/expenses/exp1` | Auth `{email:"pandarishal568@gmail.com", email_verified:false}` | `PERMISSION_DENIED` |
| 4 | Cross-User PII Read | `/addresses/victimAddr1` | Authenticated as `otherCustUid` performing `get` | `PERMISSION_DENIED` |
| 5 | Negative Order Total | `/orders/ord1` | `{"subtotal":100,"discountAmount":200,"deliveryFee":0,"totalAmount":-100,"paymentMethod":"COD"}` | `PERMISSION_DENIED` |
| 6 | Non-COD Payment Injection | `/orders/ord2` | `{"paymentMethod":"STRIPE","paymentStatus":"collected","status":"delivered"}` | `PERMISSION_DENIED` |
| 7 | Customer Stock Manipulation | `/products/prod_apple` | Customer updating `{"stock":9999,"price":1}` | `PERMISSION_DENIED` |
| 8 | Store Manager Price Tampering | `/products/prod_apple` | Store Manager updating `{"price":1,"updatedAt":"..."}` | `PERMISSION_DENIED` |
| 9 | Delivery Partner Hijack | `/orders/ordAssignedToOther` | Delivery Partner B updating order assigned to Partner A | `PERMISSION_DENIED` |
| 10 | Terminal Order Mutation | `/orders/ordDelivered` | Delivery Partner changing `status` from `delivered` to `cancelled` | `PERMISSION_DENIED` |
| 11 | ID Poisoning (Oversized ID) | `/addresses/<300-char-junk>` | Document ID exceeding 128 chars or containing spaces/slashes | `PERMISSION_DENIED` |
| 12 | Cross-Customer Support Message | `/support_tickets/t1/messages/m1` | Customer B posting message into Customer A's ticket | `PERMISSION_DENIED` |
