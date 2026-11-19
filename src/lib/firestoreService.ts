import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './firestoreError';
import {
  DEFAULT_PLATFORM_SETTINGS,
  STARTER_CATEGORIES,
  STARTER_COUPONS,
  STARTER_PRODUCTS,
  STARTER_SUPPLIERS,
} from '../data/dehradunCatalog';
import {
  generateOrderNumber,
  generateSafeId,
  generateTicketNumber,
  getEffectivePrice,
  sanitizeText,
  slugify,
} from '../utils/commerce';
import type {
  Address,
  AuditLog,
  CartItem,
  Category,
  Coupon,
  DeliveryAssignment,
  DeliveryPartner,
  DeliveryStatus,
  Expense,
  InventoryChangeType,
  InventoryLog,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  PickingChecklistItem,
  PlatformSettings,
  Product,
  StaffRoleRecord,
  Supplier,
  SupportMessage,
  SupportTicket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  UserProfile,
  UserRole,
} from '../types';

function toIso(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function mapDoc<T>(id: string, data: Record<string, unknown>): T {
  const mapped: Record<string, unknown> = { ...data, id };
  if ('createdAt' in mapped) mapped.createdAt = toIso(mapped.createdAt);
  if ('updatedAt' in mapped) mapped.updatedAt = toIso(mapped.updatedAt);
  if ('assignedAt' in mapped) mapped.assignedAt = toIso(mapped.assignedAt);
  return mapped as T;
}

// ============================================================================
// AUDIT LOGGING
// ============================================================================

export async function recordAuditLog(params: {
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
}): Promise<void> {
  const id = generateSafeId('aud');
  const path = `audit_logs/${id}`;
  try {
    await setDoc(doc(db, 'audit_logs', id), {
      id,
      actorId: params.actorId,
      actorName: sanitizeText(params.actorName, 120),
      actorRole: sanitizeText(params.actorRole, 40),
      action: sanitizeText(params.action, 100),
      targetType: sanitizeText(params.targetType, 60),
      targetId: params.targetId.slice(0, 128),
      summary: sanitizeText(params.summary, 400),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    // Do not block primary UX if audit write fails due to non-staff context, but log structured error
    console.warn('Audit log skipped:', error instanceof Error ? error.message : String(error), path);
  }
}

// ============================================================================
// CATALOG SEEDING (OWNER ONE-CLICK)
// ============================================================================

export async function seedStarterCatalogToFirestore(actor: {
  uid: string;
  displayName: string;
  role: UserRole;
}): Promise<{ categories: number; products: number; coupons: number; suppliers: number }> {
  try {
    const batch = writeBatch(db);

    for (const cat of STARTER_CATEGORIES) {
      batch.set(doc(db, 'categories', cat.id), {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description ?? '',
        imageUrl: cat.imageUrl,
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const prod of STARTER_PRODUCTS) {
      batch.set(doc(db, 'products', prod.id), {
        id: prod.id,
        name: prod.name,
        description: prod.description,
        categoryId: prod.categoryId,
        categoryName: prod.categoryName,
        sku: prod.sku,
        price: prod.price,
        discountPrice: prod.discountPrice ?? null,
        unit: prod.unit,
        stock: prod.stock,
        minStockThreshold: prod.minStockThreshold,
        imageUrl: prod.imageUrl,
        isFeatured: prod.isFeatured,
        isBestSeller: prod.isBestSeller,
        isActive: prod.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const cpn of STARTER_COUPONS) {
      batch.set(doc(db, 'coupons', cpn.id), {
        id: cpn.id,
        code: cpn.code,
        description: cpn.description ?? '',
        discountType: cpn.discountType,
        discountValue: cpn.discountValue,
        maxDiscount: cpn.maxDiscount ?? null,
        minOrderValue: cpn.minOrderValue,
        usageLimit: cpn.usageLimit,
        usedCount: 0,
        expiresAt: cpn.expiresAt,
        isActive: cpn.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    for (const sup of STARTER_SUPPLIERS) {
      batch.set(doc(db, 'suppliers', sup.id), {
        id: sup.id,
        name: sup.name,
        contactPerson: sup.contactPerson,
        phone: sup.phone,
        email: sup.email ?? '',
        address: sup.address ?? '',
        productsSupplied: sup.productsSupplied,
        notes: sup.notes ?? '',
        isActive: sup.isActive,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(doc(db, 'platform_settings', 'default'), {
      storeName: DEFAULT_PLATFORM_SETTINGS.storeName,
      city: DEFAULT_PLATFORM_SETTINGS.city,
      supportPhone: DEFAULT_PLATFORM_SETTINGS.supportPhone ?? '',
      supportEmail: DEFAULT_PLATFORM_SETTINGS.supportEmail ?? '',
      deliveryFee: DEFAULT_PLATFORM_SETTINGS.deliveryFee,
      freeDeliveryThreshold: DEFAULT_PLATFORM_SETTINGS.freeDeliveryThreshold,
      minOrderAmount: DEFAULT_PLATFORM_SETTINGS.minOrderAmount,
      estimatedDeliveryMinutes: DEFAULT_PLATFORM_SETTINGS.estimatedDeliveryMinutes,
      serviceableLocalities: DEFAULT_PLATFORM_SETTINGS.serviceableLocalities,
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'catalog.seed',
      targetType: 'catalog',
      targetId: 'dehradun_starter',
      summary: `Seeded ${STARTER_CATEGORIES.length} categories, ${STARTER_PRODUCTS.length} products, ${STARTER_COUPONS.length} coupons, and ${STARTER_SUPPLIERS.length} suppliers.`,
    });

    return {
      categories: STARTER_CATEGORIES.length,
      products: STARTER_PRODUCTS.length,
      coupons: STARTER_COUPONS.length,
      suppliers: STARTER_SUPPLIERS.length,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'products');
  }
}

// ============================================================================
// PUBLIC / STOREFRONT SUBSCRIPTIONS
// ============================================================================

export function subscribePublicCategories(
  includeInactive: boolean,
  onData: (items: Category[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'categories';
  const q = includeInactive
    ? query(collection(db, path))
    : query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapDoc<Category>(d.id, d.data()))
        .sort((a, b) => a.sortOrder - b.sortOrder);
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribePublicProducts(
  includeInactive: boolean,
  onData: (items: Product[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'products';
  const q = includeInactive
    ? query(collection(db, path))
    : query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs
        .map((d) => mapDoc<Product>(d.id, d.data()))
        .sort((a, b) => a.name.localeCompare(b.name));
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribeCoupons(
  includeInactive: boolean,
  onData: (items: Coupon[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'coupons';
  const q = includeInactive
    ? query(collection(db, path))
    : query(collection(db, path), where('isActive', '==', true));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => mapDoc<Coupon>(d.id, d.data())));
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.LIST, path);
    }
  );
}

export function subscribePlatformSettings(
  onData: (settings: PlatformSettings | null) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const path = 'platform_settings/default';
  return onSnapshot(
    doc(db, 'platform_settings', 'default'),
    (snap) => {
      if (snap.exists()) {
        onData(mapDoc<PlatformSettings>(snap.id, snap.data()));
      } else {
        onData(null);
      }
    },
    (err) => {
      if (onError) onError(err);
      else handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

// ============================================================================
// ADDRESSES
// ============================================================================

export function subscribeUserAddresses(
  userId: string,
  onData: (items: Address[]) => void
): Unsubscribe {
  const path = 'addresses';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc<Address>(d.id, d.data()))
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function saveAddress(
  userId: string,
  input: Omit<Address, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
  existingId?: string
): Promise<string> {
  const id = existingId || generateSafeId('addr');
  const path = `addresses/${id}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'addresses', id), {
        label: sanitizeText(input.label, 40),
        recipientName: sanitizeText(input.recipientName, 100),
        phone: sanitizeText(input.phone, 20),
        line1: sanitizeText(input.line1, 200),
        landmark: sanitizeText(input.landmark ?? '', 120),
        locality: sanitizeText(input.locality, 100),
        city: sanitizeText(input.city || 'Dehradun', 60),
        pincode: sanitizeText(input.pincode, 6),
        isDefault: Boolean(input.isDefault),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'addresses', id), {
        id,
        userId,
        label: sanitizeText(input.label, 40),
        recipientName: sanitizeText(input.recipientName, 100),
        phone: sanitizeText(input.phone, 20),
        line1: sanitizeText(input.line1, 200),
        landmark: sanitizeText(input.landmark ?? '', 120),
        locality: sanitizeText(input.locality, 100),
        city: sanitizeText(input.city || 'Dehradun', 60),
        pincode: sanitizeText(input.pincode, 6),
        isDefault: Boolean(input.isDefault),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteAddress(addressId: string): Promise<void> {
  const path = `addresses/${addressId}`;
  try {
    await deleteDoc(doc(db, 'addresses', addressId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// TRANSACTIONAL ORDER CHECKOUT & LIFECYCLE
// ============================================================================

export interface PlaceOrderParams {
  user: UserProfile;
  address: Address;
  items: CartItem[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  coupon?: Coupon | null;
  notes?: string;
  idempotencyKey: string;
}

export async function placeCodOrderTransaction(params: PlaceOrderParams): Promise<Order> {
  const orderId = generateSafeId('ord');
  const orderNumber = generateOrderNumber();
  const path = `orders/${orderId}`;
  const nowIso = new Date().toISOString();

  const orderItems: OrderItem[] = params.items.map((item) => {
    const unitPrice = getEffectivePrice(item);
    return {
      productId: item.productId,
      name: sanitizeText(item.name, 140),
      sku: item.sku,
      unit: item.unit,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      imageUrl: item.imageUrl,
    };
  });

  const checklist: PickingChecklistItem[] = orderItems.map((item) => ({
    productId: item.productId,
    name: item.name,
    sku: item.sku,
    quantity: item.quantity,
    picked: false,
  }));

  try {
    await runTransaction(db, async (tx) => {
      // 1. Validate live Firestore stock (if product exists in Firestore)
      const productUpdates: { ref: ReturnType<typeof doc>; prevStock: number; newStock: number; item: OrderItem }[] = [];

      for (const item of orderItems) {
        const prodRef = doc(db, 'products', item.productId);
        const prodSnap = await tx.get(prodRef);
        if (prodSnap.exists()) {
          const data = prodSnap.data();
          const currentStock = Number(data.stock ?? 0);
          if (!data.isActive) {
            throw new Error(`"${item.name}" is currently unavailable.`);
          }
          if (currentStock < item.quantity) {
            throw new Error(`Insufficient stock for "${item.name}" (${currentStock} left).`);
          }
          productUpdates.push({
            ref: prodRef,
            prevStock: currentStock,
            newStock: currentStock - item.quantity,
            item,
          });
        }
      }

      // 2. Validate & increment coupon if applied and stored in Firestore
      let couponRefToUpdate: { ref: ReturnType<typeof doc>; nextUsed: number } | null = null;
      if (params.coupon) {
        const cRef = doc(db, 'coupons', params.coupon.id);
        const cSnap = await tx.get(cRef);
        if (cSnap.exists()) {
          const cData = cSnap.data();
          const used = Number(cData.usedCount ?? 0);
          const limit = Number(cData.usageLimit ?? 0);
          if (!cData.isActive || used >= limit) {
            throw new Error(`Coupon ${params.coupon.code} is no longer valid.`);
          }
          couponRefToUpdate = { ref: cRef, nextUsed: used + 1 };
        }
      }

      // 3. Apply stock deductions + inventory logs atomically
      for (const upd of productUpdates) {
        tx.update(upd.ref, {
          stock: upd.newStock,
          updatedAt: serverTimestamp(),
        });
        const logId = generateSafeId('inv');
        tx.set(doc(db, 'inventory_logs', logId), {
          id: logId,
          productId: upd.item.productId,
          productName: upd.item.name,
          sku: upd.item.sku,
          changeType: 'order_deduction',
          quantityDelta: -upd.item.quantity,
          previousStock: upd.prevStock,
          newStock: upd.newStock,
          reason: `Deducted for COD order ${orderNumber}`,
          performedBy: params.user.uid,
          performedByName: sanitizeText(params.user.displayName, 120),
          createdAt: serverTimestamp(),
        });
      }

      if (couponRefToUpdate) {
        tx.update(couponRefToUpdate.ref, {
          usedCount: couponRefToUpdate.nextUsed,
          updatedAt: serverTimestamp(),
        });
      }

      // 4. Create the order document
      const orderPayload: Record<string, unknown> = {
        id: orderId,
        orderNumber,
        userId: params.user.uid,
        customerName: sanitizeText(params.address.recipientName || params.user.displayName, 120),
        customerEmail: sanitizeText(params.user.email, 200),
        customerPhone: sanitizeText(params.address.phone || params.user.phone || '0000000000', 20),
        deliveryAddress: {
          label: params.address.label,
          recipientName: params.address.recipientName,
          phone: params.address.phone,
          line1: params.address.line1,
          landmark: params.address.landmark ?? '',
          locality: params.address.locality,
          city: params.address.city,
          pincode: params.address.pincode,
        },
        items: orderItems,
        subtotal: params.subtotal,
        discountAmount: params.discountAmount,
        deliveryFee: params.deliveryFee,
        totalAmount: params.subtotal - params.discountAmount + params.deliveryFee,
        paymentMethod: 'COD',
        paymentStatus: 'pending',
        status: 'placed',
        deliveryStatus: 'unassigned',
        pickingChecklist: checklist,
        statusHistory: [
          {
            status: 'placed',
            deliveryStatus: 'unassigned',
            timestamp: nowIso,
            actorName: sanitizeText(params.user.displayName, 120),
            actorRole: 'customer',
            note: 'Order placed with Cash on Delivery',
          },
        ],
        notes: sanitizeText(params.notes ?? '', 400),
        idempotencyKey: params.idempotencyKey,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (params.coupon?.code) {
        orderPayload.couponCode = params.coupon.code;
      }

      tx.set(doc(db, 'orders', orderId), orderPayload);
    });

    return {
      id: orderId,
      orderNumber,
      userId: params.user.uid,
      customerName: params.address.recipientName || params.user.displayName,
      customerEmail: params.user.email,
      customerPhone: params.address.phone || params.user.phone || '',
      deliveryAddress: {
        label: params.address.label,
        recipientName: params.address.recipientName,
        phone: params.address.phone,
        line1: params.address.line1,
        landmark: params.address.landmark ?? '',
        locality: params.address.locality,
        city: params.address.city,
        pincode: params.address.pincode,
      },
      items: orderItems,
      subtotal: params.subtotal,
      discountAmount: params.discountAmount,
      deliveryFee: params.deliveryFee,
      totalAmount: params.subtotal - params.discountAmount + params.deliveryFee,
      couponCode: params.coupon?.code,
      paymentMethod: 'COD',
      paymentStatus: 'pending',
      status: 'placed',
      deliveryStatus: 'unassigned',
      pickingChecklist: checklist,
      statusHistory: [
        {
          status: 'placed',
          deliveryStatus: 'unassigned',
          timestamp: nowIso,
          actorName: params.user.displayName,
          actorRole: 'customer',
          note: 'Order placed with Cash on Delivery',
        },
      ],
      notes: params.notes ?? '',
      idempotencyKey: params.idempotencyKey,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    if (error instanceof Error && (error.message.includes('Insufficient stock') || error.message.includes('unavailable') || error.message.includes('Coupon'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export function subscribeCustomerOrders(
  userId: string,
  onData: (orders: Order[]) => void
): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc<Order>(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllOrders(onData: (orders: Order[]) => void): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc<Order>(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribePartnerAssignedOrders(
  partnerUid: string,
  onData: (orders: Order[]) => void
): Unsubscribe {
  const path = 'orders';
  const q = query(collection(db, path), where('assignedPartnerId', '==', partnerUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc<Order>(d.id, d.data()))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function updateOrderStatus(params: {
  order: Order;
  nextStatus: OrderStatus;
  nextDeliveryStatus?: DeliveryStatus;
  nextPaymentStatus?: PaymentStatus;
  pickingChecklist?: PickingChecklistItem[];
  actor: { uid: string; displayName: string; role: UserRole };
  note?: string;
}): Promise<void> {
  const path = `orders/${params.order.id}`;
  const historyEntry = {
    status: params.nextStatus,
    deliveryStatus: params.nextDeliveryStatus ?? params.order.deliveryStatus,
    timestamp: new Date().toISOString(),
    actorName: sanitizeText(params.actor.displayName, 120),
    actorRole: params.actor.role,
    note: sanitizeText(params.note ?? `Updated status to ${params.nextStatus.replace(/_/g, ' ')}`, 200),
  };
  const nextHistory = [...params.order.statusHistory, historyEntry].slice(-30);

  const payload: Record<string, unknown> = {
    status: params.nextStatus,
    statusHistory: nextHistory,
    updatedAt: serverTimestamp(),
  };

  if (params.nextDeliveryStatus) {
    payload.deliveryStatus = params.nextDeliveryStatus;
  }
  if (params.nextPaymentStatus) {
    payload.paymentStatus = params.nextPaymentStatus;
  }
  if (params.pickingChecklist) {
    payload.pickingChecklist = params.pickingChecklist;
  }

  try {
    await updateDoc(doc(db, 'orders', params.order.id), payload);

    // If cancelled by owner/store, restore product stock cleanly when owner performs it
    if (params.nextStatus === 'cancelled' && params.actor.role === 'owner') {
      for (const item of params.order.items) {
        const prodRef = doc(db, 'products', item.productId);
        const snap = await getDoc(prodRef);
        if (snap.exists()) {
          const prevStock = Number(snap.data().stock ?? 0);
          const newStock = prevStock + item.quantity;
          await updateDoc(prodRef, { stock: newStock, updatedAt: serverTimestamp() });
          const logId = generateSafeId('inv');
          await setDoc(doc(db, 'inventory_logs', logId), {
            id: logId,
            productId: item.productId,
            productName: item.name,
            sku: item.sku,
            changeType: 'order_restore',
            quantityDelta: item.quantity,
            previousStock: prevStock,
            newStock,
            reason: `Stock restored after cancellation of ${params.order.orderNumber}`,
            performedBy: params.actor.uid,
            performedByName: params.actor.displayName,
            createdAt: serverTimestamp(),
          });
        }
      }
    }

    if (params.actor.role !== 'customer') {
      await recordAuditLog({
        actorId: params.actor.uid,
        actorName: params.actor.displayName,
        actorRole: params.actor.role,
        action: 'order.status_updated',
        targetType: 'order',
        targetId: params.order.id,
        summary: `Order ${params.order.orderNumber}: ${params.order.status} -> ${params.nextStatus}`,
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderPickingChecklist(
  order: Order,
  pickingChecklist: PickingChecklistItem[]
): Promise<void> {
  const path = `orders/${order.id}`;
  try {
    await updateDoc(doc(db, 'orders', order.id), {
      pickingChecklist,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function assignDeliveryPartnerToOrder(params: {
  order: Order;
  partner: DeliveryPartner;
  actor: { uid: string; displayName: string; role: UserRole };
}): Promise<void> {
  const assignmentId = generateSafeId('asgn');
  const partnerTargetUid = params.partner.userId || params.partner.id;
  const nowIso = new Date().toISOString();
  const nextHistory = [
    ...params.order.statusHistory,
    {
      status: 'assigned' as OrderStatus,
      deliveryStatus: 'assigned' as DeliveryStatus,
      timestamp: nowIso,
      actorName: sanitizeText(params.actor.displayName, 120),
      actorRole: params.actor.role,
      note: `Assigned to delivery partner ${params.partner.name}`,
    },
  ].slice(-30);

  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'orders', params.order.id), {
      status: 'assigned',
      deliveryStatus: 'assigned',
      assignedPartnerId: partnerTargetUid,
      assignedPartnerName: sanitizeText(params.partner.name, 120),
      statusHistory: nextHistory,
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'delivery_assignments', assignmentId), {
      id: assignmentId,
      orderId: params.order.id,
      orderNumber: params.order.orderNumber,
      partnerId: params.partner.id,
      partnerUserId: partnerTargetUid,
      partnerName: sanitizeText(params.partner.name, 120),
      status: 'assigned',
      assignedBy: params.actor.uid,
      assignedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();

    await recordAuditLog({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: params.actor.role,
      action: 'delivery.assigned',
      targetType: 'order',
      targetId: params.order.id,
      summary: `Assigned ${params.order.orderNumber} to ${params.partner.name}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `orders/${params.order.id}`);
  }
}

// ============================================================================
// PRODUCTS, CATEGORIES, INVENTORY
// ============================================================================

export async function saveProduct(
  input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; displayName: string; role: UserRole },
  existingId?: string
): Promise<string> {
  const id = existingId || generateSafeId('prod');
  const path = `products/${id}`;
  const cleanSku = input.sku.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 48) || `FE-${Date.now().toString().slice(-5)}`;
  try {
    if (existingId) {
      await updateDoc(doc(db, 'products', id), {
        name: sanitizeText(input.name, 140),
        description: sanitizeText(input.description, 1000),
        categoryId: input.categoryId,
        categoryName: sanitizeText(input.categoryName, 80),
        sku: cleanSku,
        price: Number(input.price),
        discountPrice: input.discountPrice && input.discountPrice < input.price ? Number(input.discountPrice) : null,
        unit: sanitizeText(input.unit, 40),
        stock: Math.max(0, Math.floor(Number(input.stock))),
        minStockThreshold: Math.max(0, Math.floor(Number(input.minStockThreshold))),
        imageUrl: sanitizeText(input.imageUrl, 500),
        isFeatured: Boolean(input.isFeatured),
        isBestSeller: Boolean(input.isBestSeller),
        isActive: Boolean(input.isActive),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'products', id), {
        id,
        name: sanitizeText(input.name, 140),
        description: sanitizeText(input.description, 1000),
        categoryId: input.categoryId,
        categoryName: sanitizeText(input.categoryName, 80),
        sku: cleanSku,
        price: Number(input.price),
        discountPrice: input.discountPrice && input.discountPrice < input.price ? Number(input.discountPrice) : null,
        unit: sanitizeText(input.unit, 40),
        stock: Math.max(0, Math.floor(Number(input.stock))),
        minStockThreshold: Math.max(0, Math.floor(Number(input.minStockThreshold))),
        imageUrl: sanitizeText(input.imageUrl, 500),
        isFeatured: Boolean(input.isFeatured),
        isBestSeller: Boolean(input.isBestSeller),
        isActive: Boolean(input.isActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: existingId ? 'product.updated' : 'product.created',
      targetType: 'product',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Created'} product "${input.name}" (${cleanSku})`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteProduct(
  product: Product,
  actor: { uid: string; displayName: string; role: UserRole }
): Promise<void> {
  const path = `products/${product.id}`;
  try {
    await deleteDoc(doc(db, 'products', product.id));
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'product.deleted',
      targetType: 'product',
      targetId: product.id,
      summary: `Deleted product "${product.name}" (${product.sku})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function adjustProductInventory(params: {
  product: Product;
  newStock: number;
  minStockThreshold?: number;
  changeType: InventoryChangeType;
  reason: string;
  actor: { uid: string; displayName: string; role: UserRole };
}): Promise<void> {
  const safeNewStock = Math.max(0, Math.floor(params.newStock));
  const delta = safeNewStock - params.product.stock;
  const logId = generateSafeId('inv');

  try {
    const batch = writeBatch(db);
    const updatePayload: Record<string, unknown> = {
      stock: safeNewStock,
      updatedAt: serverTimestamp(),
    };
    if (typeof params.minStockThreshold === 'number') {
      updatePayload.minStockThreshold = Math.max(0, Math.floor(params.minStockThreshold));
    }
    batch.update(doc(db, 'products', params.product.id), updatePayload);
    batch.set(doc(db, 'inventory_logs', logId), {
      id: logId,
      productId: params.product.id,
      productName: sanitizeText(params.product.name, 140),
      sku: params.product.sku,
      changeType: params.changeType,
      quantityDelta: delta,
      previousStock: params.product.stock,
      newStock: safeNewStock,
      reason: sanitizeText(params.reason, 300),
      performedBy: params.actor.uid,
      performedByName: sanitizeText(params.actor.displayName, 120),
      createdAt: serverTimestamp(),
    });
    await batch.commit();

    await recordAuditLog({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: params.actor.role,
      action: 'inventory.adjusted',
      targetType: 'product',
      targetId: params.product.id,
      summary: `${params.product.name}: ${params.product.stock} -> ${safeNewStock} (${params.reason})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `products/${params.product.id}`);
  }
}

export async function saveCategory(
  input: Omit<Category, 'id' | 'slug' | 'createdAt' | 'updatedAt'> & { slug?: string },
  actor: { uid: string; displayName: string; role: UserRole },
  existingId?: string
): Promise<string> {
  const id = existingId || generateSafeId('cat');
  const path = `categories/${id}`;
  const cleanSlug = slugify(input.slug || input.name) || id.toLowerCase();
  try {
    if (existingId) {
      await updateDoc(doc(db, 'categories', id), {
        name: sanitizeText(input.name, 80),
        slug: cleanSlug,
        description: sanitizeText(input.description ?? '', 300),
        imageUrl: sanitizeText(input.imageUrl, 500),
        sortOrder: Number(input.sortOrder) || 0,
        isActive: Boolean(input.isActive),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(doc(db, 'categories', id), {
        id,
        name: sanitizeText(input.name, 80),
        slug: cleanSlug,
        description: sanitizeText(input.description ?? '', 300),
        imageUrl: sanitizeText(input.imageUrl, 500),
        sortOrder: Number(input.sortOrder) || 0,
        isActive: Boolean(input.isActive),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: existingId ? 'category.updated' : 'category.created',
      targetType: 'category',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Created'} category "${input.name}"`,
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCategory(
  category: Category,
  actor: { uid: string; displayName: string; role: UserRole }
): Promise<void> {
  const path = `categories/${category.id}`;
  try {
    await deleteDoc(doc(db, 'categories', category.id));
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'category.deleted',
      targetType: 'category',
      targetId: category.id,
      summary: `Deleted category "${category.name}"`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// SUPPLIERS, DELIVERY PARTNERS, COUPONS, EXPENSES, SETTINGS, ROLES
// ============================================================================

export async function saveSupplier(
  input: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; displayName: string; role: UserRole },
  existingId?: string
): Promise<void> {
  const id = existingId || generateSafeId('sup');
  const path = `suppliers/${id}`;
  try {
    const payload = {
      name: sanitizeText(input.name, 140),
      contactPerson: sanitizeText(input.contactPerson, 120),
      phone: sanitizeText(input.phone, 24),
      email: sanitizeText(input.email ?? '', 200),
      address: sanitizeText(input.address ?? '', 240),
      productsSupplied: input.productsSupplied.slice(0, 50),
      notes: sanitizeText(input.notes ?? '', 500),
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    };
    if (existingId) {
      await updateDoc(doc(db, 'suppliers', id), payload);
    } else {
      await setDoc(doc(db, 'suppliers', id), { id, ...payload, createdAt: serverTimestamp() });
    }
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: existingId ? 'supplier.updated' : 'supplier.created',
      targetType: 'supplier',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Added'} supplier "${input.name}"`,
    });
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteSupplier(supplierId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'suppliers', supplierId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `suppliers/${supplierId}`);
  }
}

export async function saveDeliveryPartner(
  input: Omit<DeliveryPartner, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; displayName: string; role: UserRole },
  existingId?: string
): Promise<void> {
  const id = existingId || generateSafeId('dp');
  const path = `delivery_partners/${id}`;
  try {
    const payload = {
      userId: sanitizeText(input.userId ?? '', 128),
      name: sanitizeText(input.name, 120),
      phone: sanitizeText(input.phone, 20),
      email: sanitizeText(input.email ?? '', 200),
      vehicleType: input.vehicleType,
      vehicleNumber: sanitizeText(input.vehicleNumber ?? '', 32),
      zone: sanitizeText(input.zone, 100),
      isAvailable: Boolean(input.isAvailable),
      isActive: Boolean(input.isActive),
      completedDeliveries: Math.max(0, Math.floor(Number(input.completedDeliveries) || 0)),
      updatedAt: serverTimestamp(),
    };
    if (existingId) {
      await updateDoc(doc(db, 'delivery_partners', id), payload);
    } else {
      await setDoc(doc(db, 'delivery_partners', id), { id, ...payload, createdAt: serverTimestamp() });
    }
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: existingId ? 'partner.updated' : 'partner.created',
      targetType: 'delivery_partner',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Added'} delivery partner "${input.name}" (${input.zone})`,
    });
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function saveCoupon(
  input: Omit<Coupon, 'id' | 'createdAt' | 'updatedAt'>,
  actor: { uid: string; displayName: string; role: UserRole },
  existingId?: string
): Promise<void> {
  const id = existingId || generateSafeId('cpn');
  const path = `coupons/${id}`;
  const cleanCode = input.code.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
  try {
    const payload = {
      code: cleanCode,
      description: sanitizeText(input.description ?? '', 240),
      discountType: input.discountType,
      discountValue: Number(input.discountValue),
      maxDiscount: input.maxDiscount ? Number(input.maxDiscount) : null,
      minOrderValue: Math.max(0, Number(input.minOrderValue) || 0),
      usageLimit: Math.max(1, Math.floor(Number(input.usageLimit) || 100)),
      usedCount: Math.max(0, Math.floor(Number(input.usedCount) || 0)),
      expiresAt: input.expiresAt,
      isActive: Boolean(input.isActive),
      updatedAt: serverTimestamp(),
    };
    if (existingId) {
      await updateDoc(doc(db, 'coupons', id), payload);
    } else {
      await setDoc(doc(db, 'coupons', id), { id, ...payload, createdAt: serverTimestamp() });
    }
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: existingId ? 'coupon.updated' : 'coupon.created',
      targetType: 'coupon',
      targetId: id,
      summary: `${existingId ? 'Updated' : 'Created'} coupon ${cleanCode}`,
    });
  } catch (error) {
    handleFirestoreError(error, existingId ? OperationType.UPDATE : OperationType.CREATE, path);
  }
}

export async function deleteCoupon(
  coupon: Coupon,
  actor: { uid: string; displayName: string; role: UserRole }
): Promise<void> {
  try {
    await deleteDoc(doc(db, 'coupons', coupon.id));
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'coupon.deleted',
      targetType: 'coupon',
      targetId: coupon.id,
      summary: `Deleted coupon ${coupon.code}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `coupons/${coupon.id}`);
  }
}

export async function createExpense(
  input: Omit<Expense, 'id' | 'recordedBy' | 'createdAt'>,
  actor: { uid: string; displayName: string; role: UserRole }
): Promise<void> {
  const id = generateSafeId('exp');
  const path = `expenses/${id}`;
  try {
    await setDoc(doc(db, 'expenses', id), {
      id,
      title: sanitizeText(input.title, 140),
      category: input.category,
      amount: Number(input.amount),
      expenseDate: input.expenseDate,
      notes: sanitizeText(input.notes ?? '', 400),
      recordedBy: actor.uid,
      createdAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'expense.recorded',
      targetType: 'expense',
      targetId: id,
      summary: `Recorded expense "${input.title}" (₹${input.amount})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteExpense(expenseId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'expenses', expenseId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `expenses/${expenseId}`);
  }
}

export async function savePlatformSettings(
  settings: Omit<PlatformSettings, 'updatedAt'>,
  actor: { uid: string; displayName: string; role: UserRole }
): Promise<void> {
  const path = 'platform_settings/default';
  try {
    await setDoc(doc(db, 'platform_settings', 'default'), {
      storeName: sanitizeText(settings.storeName, 80),
      city: sanitizeText(settings.city, 80),
      supportPhone: sanitizeText(settings.supportPhone ?? '', 24),
      supportEmail: sanitizeText(settings.supportEmail ?? '', 200),
      deliveryFee: Math.max(0, Number(settings.deliveryFee)),
      freeDeliveryThreshold: Math.max(0, Number(settings.freeDeliveryThreshold)),
      minOrderAmount: Math.max(0, Number(settings.minOrderAmount)),
      estimatedDeliveryMinutes: Math.max(10, Math.min(240, Number(settings.estimatedDeliveryMinutes))),
      serviceableLocalities: settings.serviceableLocalities.slice(0, 50),
      updatedAt: serverTimestamp(),
    });
    await recordAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName,
      actorRole: actor.role,
      action: 'settings.updated',
      targetType: 'platform_settings',
      targetId: 'default',
      summary: `Updated store delivery settings (fee ₹${settings.deliveryFee}, free threshold ₹${settings.freeDeliveryThreshold})`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function assignStaffRole(params: {
  targetUser: UserProfile;
  role: UserRole;
  actor: { uid: string; displayName: string; role: UserRole };
}): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'users', params.targetUser.uid), {
      role: params.role,
      updatedAt: serverTimestamp(),
    });

    if (params.role === 'customer') {
      batch.delete(doc(db, 'staff_roles', params.targetUser.uid));
    } else {
      batch.set(doc(db, 'staff_roles', params.targetUser.uid), {
        uid: params.targetUser.uid,
        email: params.targetUser.email,
        role: params.role,
        isActive: true,
        assignedBy: params.actor.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await batch.commit();

    await recordAuditLog({
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorRole: params.actor.role,
      action: 'role.assigned',
      targetType: 'user',
      targetId: params.targetUser.uid,
      summary: `Changed role for ${params.targetUser.email} to ${params.role}`,
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `staff_roles/${params.targetUser.uid}`);
  }
}

// ============================================================================
// SUPPORT TICKETS & MASTER-GATED MESSAGES
// ============================================================================

export function subscribeCustomerTickets(
  userId: string,
  onData: (tickets: SupportTicket[]) => void
): Unsubscribe {
  const path = 'support_tickets';
  const q = query(collection(db, path), where('userId', '==', userId));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc<SupportTicket>(d.id, d.data()))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeAllTickets(onData: (tickets: SupportTicket[]) => void): Unsubscribe {
  const path = 'support_tickets';
  return onSnapshot(
    collection(db, path),
    (snap) => {
      const list = snap.docs
        .map((d) => mapDoc<SupportTicket>(d.id, d.data()))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onData(list);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export function subscribeTicketMessages(
  ticketId: string,
  ticketOwnerId: string,
  isOwnerUser: boolean,
  onData: (messages: SupportMessage[]) => void
): Unsubscribe {
  const path = `support_tickets/${ticketId}/messages`;
  const q = isOwnerUser
    ? query(collection(db, 'support_tickets', ticketId, 'messages'), orderBy('createdAt', 'asc'))
    : query(
        collection(db, 'support_tickets', ticketId, 'messages'),
        where('ticketOwnerId', '==', ticketOwnerId)
      );
  return onSnapshot(
    q,
    (snap) => {
      const msgs = snap.docs
        .map((d) => mapDoc<SupportMessage>(d.id, d.data()))
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onData(msgs);
    },
    (err) => handleFirestoreError(err, OperationType.LIST, path)
  );
}

export async function createSupportTicket(params: {
  user: UserProfile;
  subject: string;
  category: TicketCategory;
  orderId?: string;
  initialMessage: string;
}): Promise<string> {
  const ticketId = generateSafeId('tkt');
  const messageId = generateSafeId('msg');
  const ticketNumber = generateTicketNumber();

  try {
    const ticketPayload: Record<string, unknown> = {
      id: ticketId,
      ticketNumber,
      userId: params.user.uid,
      customerName: sanitizeText(params.user.displayName, 120),
      customerEmail: sanitizeText(params.user.email, 200),
      subject: sanitizeText(params.subject, 160),
      category: params.category,
      priority: 'medium',
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.orderId) {
      ticketPayload.orderId = params.orderId;
    }

    await setDoc(doc(db, 'support_tickets', ticketId), ticketPayload);

    await setDoc(doc(db, 'support_tickets', ticketId, 'messages', messageId), {
      id: messageId,
      ticketId,
      ticketOwnerId: params.user.uid,
      senderId: params.user.uid,
      senderName: sanitizeText(params.user.displayName, 120),
      senderRole: 'customer',
      body: sanitizeText(params.initialMessage, 2000),
      createdAt: serverTimestamp(),
    });

    return ticketId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `support_tickets/${ticketId}`);
  }
}

export async function postSupportMessage(params: {
  ticket: SupportTicket;
  sender: UserProfile;
  body: string;
}): Promise<void> {
  const messageId = generateSafeId('msg');
  const path = `support_tickets/${params.ticket.id}/messages/${messageId}`;
  const senderRole = params.sender.role === 'owner' ? 'owner' : 'customer';
  try {
    await setDoc(doc(db, 'support_tickets', params.ticket.id, 'messages', messageId), {
      id: messageId,
      ticketId: params.ticket.id,
      ticketOwnerId: params.ticket.userId,
      senderId: params.sender.uid,
      senderName: sanitizeText(params.sender.displayName, 120),
      senderRole,
      body: sanitizeText(params.body, 2000),
      createdAt: serverTimestamp(),
    });
    if (senderRole === 'owner' && params.ticket.status === 'open') {
      await updateDoc(doc(db, 'support_tickets', params.ticket.id), {
        status: 'in_progress',
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSupportTicket(
  ticketId: string,
  updates: { status?: TicketStatus; priority?: TicketPriority }
): Promise<void> {
  const path = `support_tickets/${ticketId}`;
  try {
    await updateDoc(doc(db, 'support_tickets', ticketId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// ADMIN & OPERATIONS SUBSCRIPTIONS
// ============================================================================

export function subscribeAllUsers(onData: (users: UserProfile[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'users'),
    (snap) => {
      onData(
        snap.docs
          .map((d) => mapDoc<UserProfile>(d.id, d.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'users')
  );
}

export function subscribeInventoryLogs(onData: (logs: InventoryLog[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'inventory_logs'),
    (snap) => {
      onData(
        snap.docs
          .map((d) => mapDoc<InventoryLog>(d.id, d.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      );
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'inventory_logs')
  );
}

export function subscribeSuppliers(onData: (items: Supplier[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'suppliers'),
    (snap) => onData(snap.docs.map((d) => mapDoc<Supplier>(d.id, d.data()))),
    (err) => handleFirestoreError(err, OperationType.LIST, 'suppliers')
  );
}

export function subscribeDeliveryPartners(onData: (items: DeliveryPartner[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'delivery_partners'),
    (snap) => onData(snap.docs.map((d) => mapDoc<DeliveryPartner>(d.id, d.data()))),
    (err) => handleFirestoreError(err, OperationType.LIST, 'delivery_partners')
  );
}

export function subscribeDeliveryAssignments(onData: (items: DeliveryAssignment[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'delivery_assignments'),
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapDoc<DeliveryAssignment>(d.id, d.data()))
          .sort((a, b) => b.assignedAt.localeCompare(a.assignedAt))
      ),
    (err) => handleFirestoreError(err, OperationType.LIST, 'delivery_assignments')
  );
}

export function subscribeExpenses(onData: (items: Expense[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'expenses'),
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapDoc<Expense>(d.id, d.data()))
          .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate))
      ),
    (err) => handleFirestoreError(err, OperationType.LIST, 'expenses')
  );
}

export function subscribeAuditLogs(onData: (items: AuditLog[]) => void): Unsubscribe {
  return onSnapshot(
    collection(db, 'audit_logs'),
    (snap) =>
      onData(
        snap.docs
          .map((d) => mapDoc<AuditLog>(d.id, d.data()))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      ),
    (err) => handleFirestoreError(err, OperationType.LIST, 'audit_logs')
  );
}

export async function fetchStaffRoles(): Promise<StaffRoleRecord[]> {
  try {
    const snap = await getDocs(collection(db, 'staff_roles'));
    return snap.docs.map((d) => mapDoc<StaffRoleRecord>(d.id, d.data()));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'staff_roles');
  }
}
