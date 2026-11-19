import React, { useState } from 'react';
import { Eye, Plus, Truck, Users } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { StatusLabel } from '../ui/StatusLabel';
import { OrderTimeline } from '../storefront/OrderTimeline';
import { EmptyState } from '../ui/EmptyState';
import { useToast } from '../../contexts/ToastContext';
import {
  assignDeliveryPartnerToOrder,
  saveDeliveryPartner,
  updateOrderStatus,
} from '../../lib/firestoreService';
import { formatINR } from '../../utils/commerce';
import { DEHRADUN_LOCALITIES } from '../../data/dehradunCatalog';
import { DELIVERY_STATUS_META, ORDER_STATUS_META } from '../../utils/workflow';
import type {
  DeliveryAssignment,
  DeliveryPartner,
  Order,
  OrderStatus,
  UserProfile,
  VehicleType,
} from '../../types';

export function AdminOrdersPanel({
  orders,
  partners,
  actor,
}: {
  orders: Order[];
  partners: DeliveryPartner[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [assignPartnerId, setAssignPartnerId] = useState('');

  const filtered = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.deliveryAddress.locality.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleStatusChange = async (order: Order, nextStatus: OrderStatus) => {
    try {
      await updateOrderStatus({
        order,
        nextStatus,
        nextDeliveryStatus:
          nextStatus === 'delivered'
            ? 'delivered'
            : nextStatus === 'cancelled'
              ? 'cancelled'
              : nextStatus === 'out_for_delivery'
                ? 'out_for_delivery'
                : undefined,
        nextPaymentStatus:
          nextStatus === 'delivered'
            ? 'collected'
            : nextStatus === 'cancelled'
              ? 'void'
              : undefined,
        actor: { uid: actor.uid, displayName: actor.displayName, role: actor.role },
      });
      showToast(`Order ${order.orderNumber} updated to ${nextStatus.replace(/_/g, ' ')}.`, 'success');
      setSelectedOrder(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const handleAssignPartner = async (order: Order) => {
    const partner = partners.find((p) => p.id === assignPartnerId);
    if (!partner) {
      showToast('Select a delivery partner first.', 'error');
      return;
    }
    try {
      await assignDeliveryPartnerToOrder({
        order,
        partner,
        actor: { uid: actor.uid, displayName: actor.displayName, role: actor.role },
      });
      showToast(`Assigned ${order.orderNumber} to ${partner.name}.`, 'success');
      setAssignPartnerId('');
      setSelectedOrder(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Assignment failed.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search order #, customer, or locality..."
          className="w-full sm:w-72 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        >
          <option value="all">All Statuses</option>
          <option value="placed">Placed</option>
          <option value="confirmed">Confirmed</option>
          <option value="preparing">Preparing</option>
          <option value="ready_for_pickup">Ready for Pickup</option>
          <option value="assigned">Assigned</option>
          <option value="out_for_delivery">Out for Delivery</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Truck className="h-5 w-5" />}
          title="No orders found"
          description="Customer orders placed through checkout will appear here in real time."
        />
      ) : (
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Locality</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Partner</th>
                <th className="px-4 py-3 font-medium text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {filtered.map((order) => {
                const meta = ORDER_STATUS_META[order.status];
                return (
                  <tr key={order.id} className="hover:bg-[var(--bg-surface-subtle)]/50">
                    <td className="px-4 py-3">
                      <span className="font-mono-num text-xs font-bold text-[var(--text-primary)]">
                        {order.orderNumber}
                      </span>
                      <span className="block text-[11px] text-[var(--text-muted)]">
                        {new Date(order.createdAt).toLocaleDateString('en-IN')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <p className="font-medium text-[var(--text-primary)]">{order.customerName}</p>
                      <p className="text-[var(--text-muted)]">{order.customerPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {order.deliveryAddress.locality}
                    </td>
                    <td className="px-4 py-3 text-right font-mono-num font-semibold text-[var(--text-primary)]">
                      {formatINR(order.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusLabel label={meta.label} tone={meta.tone} />
                    </td>
                    <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                      {order.assignedPartnerName || '—'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOrder(order);
                          setAssignPartnerId('');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        title={`Order ${selectedOrder?.orderNumber ?? ''}`}
        subtitle={
          selectedOrder
            ? `${selectedOrder.customerName} · ${selectedOrder.deliveryAddress.locality}, Dehradun · COD ${formatINR(selectedOrder.totalAmount)}`
            : ''
        }
        maxWidthClass="max-w-3xl"
      >
        {selectedOrder && (
          <div className="space-y-5">
            <OrderTimeline order={selectedOrder} />

            {/* Owner Action Controls */}
            {selectedOrder.status !== 'delivered' && selectedOrder.status !== 'cancelled' && (
              <div className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] p-4 space-y-3">
                <p className="text-xs font-semibold text-[var(--text-primary)]">Owner Actions</p>
                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status === 'placed' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder, 'confirmed')}
                      className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Accept & Confirm Order
                    </button>
                  )}
                  {selectedOrder.status === 'confirmed' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder, 'preparing')}
                      className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Mark Preparing
                    </button>
                  )}
                  {selectedOrder.status === 'preparing' && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder, 'ready_for_pickup')}
                      className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Mark Ready for Pickup
                    </button>
                  )}
                  {(selectedOrder.status === 'assigned' ||
                    selectedOrder.status === 'out_for_delivery') && (
                    <button
                      type="button"
                      onClick={() => handleStatusChange(selectedOrder, 'delivered')}
                      className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-semibold text-white"
                    >
                      Confirm Delivered & COD Collected
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleStatusChange(selectedOrder, 'cancelled')}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3.5 py-1.5 text-xs font-semibold text-[var(--status-danger-text)]"
                  >
                    Reject / Cancel Order
                  </button>
                </div>

                {/* Manual Delivery Partner Assignment */}
                {partners.filter((p) => p.isActive).length > 0 && (
                  <div className="pt-2 border-t border-[var(--border-hairline)] flex flex-wrap items-center gap-2">
                    <select
                      value={assignPartnerId}
                      onChange={(e) => setAssignPartnerId(e.target.value)}
                      className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-1.5 text-xs text-[var(--text-primary)]"
                    >
                      <option value="">Select Delivery Partner...</option>
                      {partners
                        .filter((p) => p.isActive)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.zone} · {p.isAvailable ? 'Available' : 'Busy'})
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleAssignPartner(selectedOrder)}
                      className="rounded-lg border border-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-primary-text)] hover:bg-[var(--brand-primary-soft)]"
                    >
                      Assign Partner
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="divide-y divide-[var(--border-hairline)] text-xs">
              {selectedOrder.items.map((item) => (
                <div key={item.productId} className="py-2 flex justify-between">
                  <span className="text-[var(--text-primary)]">
                    {item.quantity} × {item.name} ({item.unit})
                  </span>
                  <span className="font-mono-num font-semibold">{formatINR(item.lineTotal)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export function AdminDeliveryPartnersPanel({
  partners,
  orders,
  actor,
}: {
  partners: DeliveryPartner[];
  orders: Order[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [userId, setUserId] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('scooter');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [zone, setZone] = useState(DEHRADUN_LOCALITIES[0]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || phone.trim().length < 10) {
      showToast('Enter partner name and valid 10-digit phone.', 'error');
      return;
    }
    try {
      await saveDeliveryPartner(
        {
          name: name.trim(),
          phone: phone.trim(),
          userId: userId.trim(),
          vehicleType,
          vehicleNumber: vehicleNumber.trim().toUpperCase(),
          zone,
          isAvailable: true,
          isActive: true,
          completedDeliveries: 0,
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role }
      );
      setName('');
      setPhone('');
      setUserId('');
      setVehicleNumber('');
      showToast('Delivery partner added.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not add delivery partner.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3"
      >
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Add Delivery Partner
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Partner Full Name"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {DEHRADUN_LOCALITIES.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <select
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value as VehicleType)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="scooter">Scooter</option>
            <option value="bike">Motorbike</option>
            <option value="ev_cycle">EV Cycle</option>
            <option value="van">Mini Van</option>
          </select>
          <input
            type="text"
            value={vehicleNumber}
            onChange={(e) => setVehicleNumber(e.target.value)}
            placeholder="UK-07-XX-0000"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Linked Auth UID (optional)"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono-num text-[var(--text-primary)]"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Partner
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partners.map((p) => {
          const activeLoad = orders.filter(
            (o) =>
              (o.assignedPartnerId === p.userId || o.assignedPartnerId === p.id) &&
              o.status !== 'delivered' &&
              o.status !== 'cancelled'
          ).length;

          return (
            <div
              key={p.id}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 flex items-start justify-between gap-4"
            >
              <div className="space-y-1 text-xs">
                <p className="text-sm font-semibold text-[var(--text-primary)]">{p.name}</p>
                <p className="text-[var(--text-secondary)]">
                  {p.zone} · {p.vehicleType} {p.vehicleNumber ? `(${p.vehicleNumber})` : ''}
                </p>
                <p className="font-mono-num text-[var(--text-muted)]">{p.phone}</p>
                <p className="text-[var(--text-secondary)] pt-1">
                  Active Workload: <strong className="font-mono-num">{activeLoad}</strong> orders
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await saveDeliveryPartner(
                    { ...p, isAvailable: !p.isAvailable },
                    { uid: actor.uid, displayName: actor.displayName, role: actor.role },
                    p.id
                  );
                }}
                className="rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
              >
                {p.isAvailable ? 'Available' : 'Unavailable'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AdminDeliveryAssignmentsPanel({
  orders,
  partners,
  assignments,
  actor,
}: {
  orders: Order[];
  partners: DeliveryPartner[];
  assignments: DeliveryAssignment[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState('');

  const assignableOrders = orders.filter((o) =>
    ['confirmed', 'preparing', 'ready_for_pickup'].includes(o.status)
  );

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    const ord = orders.find((o) => o.id === selectedOrderId);
    const partner = partners.find((p) => p.id === selectedPartnerId);
    if (!ord || !partner) {
      showToast('Select both an order and an active delivery partner.', 'error');
      return;
    }
    try {
      await assignDeliveryPartnerToOrder({
        order: ord,
        partner,
        actor: { uid: actor.uid, displayName: actor.displayName, role: actor.role },
      });
      setSelectedOrderId('');
      setSelectedPartnerId('');
      showToast(`Dispatched ${ord.orderNumber} to ${partner.name}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Assignment failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAssign}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3"
      >
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Manual Delivery Dispatch (Zero-Cost Operations)
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select
            value={selectedOrderId}
            onChange={(e) => setSelectedOrderId(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Select Ready Order ({assignableOrders.length})...</option>
            {assignableOrders.map((o) => (
              <option key={o.id} value={o.id}>
                {o.orderNumber} · {o.deliveryAddress.locality} ({o.status.replace(/_/g, ' ')})
              </option>
            ))}
          </select>
          <select
            value={selectedPartnerId}
            onChange={(e) => setSelectedPartnerId(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="">Select Available Partner...</option>
            {partners
              .filter((p) => p.isActive)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.zone} ({p.isAvailable ? 'Available' : 'Busy'})
                </option>
              ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Assign Delivery
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
              <th className="px-4 py-3 font-medium">Order</th>
              <th className="px-4 py-3 font-medium">Partner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned At</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {assignments.map((a) => {
              const meta = DELIVERY_STATUS_META[a.status];
              return (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-mono-num text-xs font-bold text-[var(--text-primary)]">
                    {a.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{a.partnerName}</td>
                  <td className="px-4 py-3">
                    <StatusLabel label={meta.label} tone={meta.tone} />
                  </td>
                  <td className="px-4 py-3 font-mono-num text-xs text-[var(--text-muted)]">
                    {new Date(a.assignedAt).toLocaleString('en-IN')}
                  </td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-xs text-[var(--text-muted)]">
                  No delivery assignments logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminCustomersPanel({
  users,
  orders,
}: {
  users: UserProfile[];
  orders: Order[];
}) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon={<Users className="h-5 w-5" />}
        title="No registered accounts yet"
        description="Customers who sign in with Google or Email will appear in this directory."
      />
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Locality</th>
            <th className="px-4 py-3 font-medium text-right">Orders</th>
            <th className="px-4 py-3 font-medium text-right">Total Spend</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-hairline)]">
          {users.map((u) => {
            const userOrders = orders.filter((o) => o.userId === u.uid && o.status !== 'cancelled');
            const totalSpend = userOrders.reduce((s, o) => s + o.totalAmount, 0);
            return (
              <tr key={u.uid}>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{u.displayName}</td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{u.email}</td>
                <td className="px-4 py-3 text-xs capitalize text-[var(--brand-primary-text)] font-medium">
                  {u.role.replace('_', ' ')}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {u.locality || 'Dehradun'}
                </td>
                <td className="px-4 py-3 font-mono-num text-right">{userOrders.length}</td>
                <td className="px-4 py-3 font-mono-num text-right font-semibold text-[var(--text-primary)]">
                  {formatINR(totalSpend)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
