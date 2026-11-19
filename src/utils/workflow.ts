import type { DeliveryStatus, OrderStatus, UserRole } from '../types';

export const ORDER_TIMELINE_STEPS: { status: OrderStatus; label: string; description: string }[] = [
  { status: 'placed', label: 'Order Placed', description: 'Received by FinEase Dehradun' },
  { status: 'confirmed', label: 'Order Confirmed', description: 'Accepted for store fulfillment' },
  { status: 'preparing', label: 'Preparing Order', description: 'Fresh items being handpicked & packed' },
  { status: 'ready_for_pickup', label: 'Ready for Pickup', description: 'Packed and awaiting dispatch' },
  { status: 'assigned', label: 'Partner Assigned', description: 'Delivery partner assigned to your order' },
  { status: 'out_for_delivery', label: 'Out for Delivery', description: 'On the way to your doorstep' },
  { status: 'delivered', label: 'Delivered', description: 'Order delivered & COD settled' },
];

export const DELIVERY_WORKFLOW_STEPS: { status: Exclude<DeliveryStatus, 'unassigned' | 'cancelled'>; label: string }[] = [
  { status: 'assigned', label: 'Assigned' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'out_for_delivery', label: 'Out for Delivery' },
  { status: 'delivered', label: 'Delivered' },
];

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
  placed: { label: 'Order Placed', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'info' },
  preparing: { label: 'Preparing', tone: 'warning' },
  ready_for_pickup: { label: 'Ready for Pickup', tone: 'warning' },
  assigned: { label: 'Partner Assigned', tone: 'info' },
  out_for_delivery: { label: 'Out for Delivery', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export const DELIVERY_STATUS_META: Record<
  DeliveryStatus,
  { label: string; tone: 'neutral' | 'info' | 'warning' | 'success' | 'danger' }
> = {
  unassigned: { label: 'Unassigned', tone: 'neutral' },
  assigned: { label: 'Assigned', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'info' },
  picked_up: { label: 'Picked Up', tone: 'warning' },
  out_for_delivery: { label: 'Out for Delivery', tone: 'warning' },
  delivered: { label: 'Delivered', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return status === 'delivered' || status === 'cancelled';
}

export function getOrderTimelineIndex(status: OrderStatus): number {
  if (status === 'cancelled') return -1;
  return ORDER_TIMELINE_STEPS.findIndex((step) => step.status === status);
}

const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  placed: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['assigned', 'cancelled'],
  assigned: ['out_for_delivery', 'delivered', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

const VALID_DELIVERY_TRANSITIONS: Record<DeliveryStatus, DeliveryStatus[]> = {
  unassigned: ['assigned'],
  assigned: ['accepted', 'cancelled'],
  accepted: ['picked_up', 'cancelled'],
  picked_up: ['out_for_delivery'],
  out_for_delivery: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransitionOrder(
  role: UserRole,
  currentStatus: OrderStatus,
  nextStatus: OrderStatus
): boolean {
  if (currentStatus === nextStatus) return false;
  if (isTerminalOrderStatus(currentStatus)) return false;

  if (role === 'owner') {
    return VALID_ORDER_TRANSITIONS[currentStatus].includes(nextStatus);
  }

  if (role === 'customer') {
    return (currentStatus === 'placed' || currentStatus === 'confirmed') && nextStatus === 'cancelled';
  }

  if (role === 'store_manager') {
    return (
      (currentStatus === 'confirmed' && nextStatus === 'preparing') ||
      (currentStatus === 'preparing' && nextStatus === 'ready_for_pickup')
    );
  }

  if (role === 'delivery_partner') {
    return (
      (currentStatus === 'assigned' && nextStatus === 'out_for_delivery') ||
      (currentStatus === 'out_for_delivery' && nextStatus === 'delivered')
    );
  }

  return false;
}

export function canTransitionDelivery(
  currentDeliveryStatus: DeliveryStatus,
  nextDeliveryStatus: DeliveryStatus
): boolean {
  return VALID_DELIVERY_TRANSITIONS[currentDeliveryStatus].includes(nextDeliveryStatus);
}

export function getNextDeliveryStep(
  current: DeliveryStatus
): { nextDeliveryStatus: DeliveryStatus; nextOrderStatus: OrderStatus; actionLabel: string } | null {
  switch (current) {
    case 'assigned':
      return {
        nextDeliveryStatus: 'accepted',
        nextOrderStatus: 'assigned',
        actionLabel: 'Accept Assignment',
      };
    case 'accepted':
      return {
        nextDeliveryStatus: 'picked_up',
        nextOrderStatus: 'assigned',
        actionLabel: 'Mark Picked Up',
      };
    case 'picked_up':
      return {
        nextDeliveryStatus: 'out_for_delivery',
        nextOrderStatus: 'out_for_delivery',
        actionLabel: 'Start Delivery',
      };
    case 'out_for_delivery':
      return {
        nextDeliveryStatus: 'delivered',
        nextOrderStatus: 'delivered',
        actionLabel: 'Confirm COD & Delivered',
      };
    default:
      return null;
  }
}

export function canAccessWorkspace(role: UserRole, workspace: 'admin' | 'store_manager' | 'delivery_partner'): boolean {
  if (workspace === 'admin') return role === 'owner';
  if (workspace === 'store_manager') return role === 'owner' || role === 'store_manager';
  if (workspace === 'delivery_partner') return role === 'owner' || role === 'delivery_partner';
  return false;
}
