export type UserRole = 'customer' | 'owner' | 'store_manager' | 'delivery_partner';
export type ThemeMode = 'light' | 'dark' | 'system';

export type OrderStatus =
  | 'placed'
  | 'confirmed'
  | 'preparing'
  | 'ready_for_pickup'
  | 'assigned'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type DeliveryStatus =
  | 'unassigned'
  | 'assigned'
  | 'accepted'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled';

export type PaymentStatus = 'pending' | 'collected' | 'void';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  phone?: string;
  role: UserRole;
  themePreference: ThemeMode;
  locality?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffRoleRecord {
  uid: string;
  email: string;
  role: 'owner' | 'store_manager' | 'delivery_partner';
  isActive: boolean;
  assignedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName: string;
  sku: string;
  price: number;
  discountPrice?: number | null;
  unit: string;
  stock: number;
  minStockThreshold: number;
  imageUrl: string;
  isFeatured: boolean;
  isBestSeller: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  unit: string;
  sku: string;
  price: number;
  discountPrice?: number | null;
  quantity: number;
  imageUrl: string;
  maxStock: number;
}

export interface Address {
  id: string;
  userId: string;
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  landmark?: string;
  locality: string;
  city: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  imageUrl: string;
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  deliveryStatus?: DeliveryStatus;
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  note?: string;
}

export interface PickingChecklistItem {
  productId: string;
  name: string;
  sku: string;
  quantity: number;
  picked: boolean;
}

export interface Order {
  id: string;
  orderNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: {
    label: string;
    recipientName: string;
    phone: string;
    line1: string;
    landmark?: string;
    locality: string;
    city: string;
    pincode: string;
  };
  items: OrderItem[];
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  couponCode?: string;
  paymentMethod: 'COD';
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  deliveryStatus: DeliveryStatus;
  assignedPartnerId?: string;
  assignedPartnerName?: string;
  pickingChecklist?: PickingChecklistItem[];
  statusHistory: OrderStatusHistoryEntry[];
  notes?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export type InventoryChangeType =
  | 'restock'
  | 'adjustment'
  | 'order_deduction'
  | 'order_restore'
  | 'spoilage';

export interface InventoryLog {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  changeType: InventoryChangeType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  address?: string;
  productsSupplied: string[];
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VehicleType = 'scooter' | 'bike' | 'ev_cycle' | 'van';

export interface DeliveryPartner {
  id: string;
  userId?: string;
  name: string;
  phone: string;
  email?: string;
  vehicleType: VehicleType;
  vehicleNumber?: string;
  zone: string;
  isAvailable: boolean;
  isActive: boolean;
  completedDeliveries: number;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryAssignment {
  id: string;
  orderId: string;
  orderNumber: string;
  partnerId: string;
  partnerUserId?: string;
  partnerName: string;
  status: Exclude<DeliveryStatus, 'unassigned'>;
  assignedBy: string;
  assignedAt: string;
  updatedAt: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue: number;
  usageLimit: number;
  usedCount: number;
  expiresAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TicketCategory = 'order' | 'delivery' | 'quality' | 'account' | 'other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  orderId?: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  ticketId: string;
  ticketOwnerId: string;
  senderId: string;
  senderName: string;
  senderRole: 'customer' | 'owner' | 'store_manager';
  body: string;
  createdAt: string;
}

export type ExpenseCategory =
  | 'inventory_procurement'
  | 'delivery_payout'
  | 'store_rent'
  | 'utilities'
  | 'packaging'
  | 'marketing'
  | 'staff_salary'
  | 'other';

export interface Expense {
  id: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  notes?: string;
  recordedBy: string;
  createdAt: string;
}

export interface PlatformSettings {
  storeName: string;
  city: string;
  supportPhone?: string;
  supportEmail?: string;
  deliveryFee: number;
  freeDeliveryThreshold: number;
  minOrderAmount: number;
  estimatedDeliveryMinutes: number;
  serviceableLocalities: string[];
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  summary: string;
  createdAt: string;
}

export type AppView =
  | 'home'
  | 'shop'
  | 'checkout'
  | 'account'
  | 'admin'
  | 'store_manager'
  | 'delivery_partner';
