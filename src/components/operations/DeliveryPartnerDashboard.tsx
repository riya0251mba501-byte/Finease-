import { useEffect, useState } from 'react';
import { ArrowLeft, Truck, MapPin, Phone, Banknote, CheckCircle2, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { FinEaseLogo } from '../ui/FinEaseLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { StatusLabel } from '../ui/StatusLabel';
import { EmptyState } from '../ui/EmptyState';
import {
  subscribeAllOrders,
  subscribePartnerAssignedOrders,
  updateOrderStatus,
} from '../../lib/firestoreService';
import { formatINR } from '../../utils/commerce';
import {
  DELIVERY_STATUS_META,
  DELIVERY_WORKFLOW_STEPS,
  getNextDeliveryStep,
} from '../../utils/workflow';
import type { Order } from '../../types';

export function DeliveryPartnerDashboard({ onExit }: { onExit: () => void }) {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'active' | 'history'>('active');

  useEffect(() => {
    if (!profile) return;
    // Delivery partners strictly query only their assigned deliveries; owners can inspect assigned fleet queue
    if (profile.role === 'owner') {
      return subscribeAllOrders((all) =>
        setOrders(all.filter((o) => Boolean(o.assignedPartnerId)))
      );
    }
    return subscribePartnerAssignedOrders(profile.uid, setOrders);
  }, [profile]);

  if (!profile) return null;

  const activeDeliveries = orders.filter(
    (o) => o.status !== 'delivered' && o.status !== 'cancelled'
  );
  const completedDeliveries = orders.filter(
    (o) => o.status === 'delivered' || o.status === 'cancelled'
  );

  const handleAdvanceDelivery = async (order: Order) => {
    const step = getNextDeliveryStep(order.deliveryStatus);
    if (!step) return;
    try {
      await updateOrderStatus({
        order,
        nextStatus: step.nextOrderStatus,
        nextDeliveryStatus: step.nextDeliveryStatus,
        nextPaymentStatus: step.nextDeliveryStatus === 'delivered' ? 'collected' : undefined,
        actor: { uid: profile.uid, displayName: profile.displayName, role: profile.role },
        note:
          step.nextDeliveryStatus === 'delivered'
            ? `Delivered and collected ${formatINR(order.totalAmount)} COD`
            : `Delivery partner updated status to ${step.nextDeliveryStatus.replace(/_/g, ' ')}`,
      });
      showToast(
        `${order.orderNumber}: ${step.nextDeliveryStatus.replace(/_/g, ' ')}`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to update delivery status.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <FinEaseLogo size="sm" />
          <span className="text-xs font-medium text-[var(--text-muted)] hidden sm:inline">
            Delivery Partner Console
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeSwitcher compact />
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Storefront
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">Active Deliveries</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
              {activeDeliveries.length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">Completed Deliveries</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--status-success-text)]">
              {completedDeliveries.filter((o) => o.status === 'delivered').length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">COD to Collect (Active)</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--brand-primary-text)]">
              {formatINR(activeDeliveries.reduce((sum, o) => sum + o.totalAmount, 0))}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-6 border-b border-[var(--border-hairline)] pb-3">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'active'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
            }`}
          >
            <Truck className="h-4 w-4" />
            Assigned Deliveries ({activeDeliveries.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'history'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
            }`}
          >
            <CheckCircle2 className="h-4 w-4" />
            Delivery History ({completedDeliveries.length})
          </button>
        </div>

        {tab === 'active' && (
          <div className="space-y-4">
            {activeDeliveries.length === 0 ? (
              <EmptyState
                icon={<Truck className="h-5 w-5" />}
                title="No deliveries assigned right now"
                description="When the FinEase Dehradun dispatcher assigns a packed order to you, it will appear here."
              />
            ) : (
              activeDeliveries.map((order) => {
                const nextStep = getNextDeliveryStep(order.deliveryStatus);
                const meta = DELIVERY_STATUS_META[order.deliveryStatus];
                const stepIdx = DELIVERY_WORKFLOW_STEPS.findIndex(
                  (s) => s.status === order.deliveryStatus
                );

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono-num text-base font-bold text-[var(--text-primary)]">
                            {order.orderNumber}
                          </span>
                          <StatusLabel label={meta.label} tone={meta.tone} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Assigned Partner: {order.assignedPartnerName || profile.displayName}
                        </p>
                      </div>

                      <div className="text-right">
                        <div className="inline-flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <Banknote className="h-3.5 w-3.5 text-[var(--brand-primary-text)]" />
                          <span>Collect COD</span>
                        </div>
                        <p className="font-mono-num text-lg font-bold text-[var(--text-primary)]">
                          {formatINR(order.totalAmount)}
                        </p>
                      </div>
                    </div>

                    {/* 5-step Delivery Progress Bar */}
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {DELIVERY_WORKFLOW_STEPS.map((s, idx) => (
                        <div
                          key={s.status}
                          className={`rounded-md py-1.5 px-1 text-[11px] font-medium border ${
                            idx <= stepIdx
                              ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] text-[var(--brand-primary-text)]'
                              : 'border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] text-[var(--text-muted)]'
                          }`}
                        >
                          {s.label}
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="rounded-lg bg-[var(--bg-surface-subtle)] p-3.5 space-y-1.5">
                        <p className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[var(--brand-primary-text)]" />
                          Delivery Destination
                        </p>
                        <p className="text-[var(--text-primary)] font-medium">
                          {order.deliveryAddress.recipientName}
                        </p>
                        <p className="text-[var(--text-secondary)]">
                          {order.deliveryAddress.line1}
                          {order.deliveryAddress.landmark
                            ? `, near ${order.deliveryAddress.landmark}`
                            : ''}
                          , {order.deliveryAddress.locality}, {order.deliveryAddress.city} -{' '}
                          {order.deliveryAddress.pincode}
                        </p>
                        <p className="text-[var(--text-secondary)] flex items-center gap-1.5 font-mono-num pt-1">
                          <Phone className="h-3.5 w-3.5" />
                          {order.deliveryAddress.phone}
                        </p>
                      </div>

                      <div className="rounded-lg bg-[var(--bg-surface-subtle)] p-3.5 space-y-1.5">
                        <p className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-[var(--brand-primary-text)]" />
                          Order Summary ({order.items.length} items)
                        </p>
                        <ul className="space-y-1 text-[var(--text-secondary)]">
                          {order.items.map((item) => (
                            <li key={item.productId} className="flex justify-between">
                              <span>
                                {item.quantity} × {item.name}
                              </span>
                              <span className="font-mono-num">{item.unit}</span>
                            </li>
                          ))}
                        </ul>
                        {order.notes && (
                          <p className="pt-1.5 text-[var(--status-warning-text)]">
                            Note: {order.notes}
                          </p>
                        )}
                      </div>
                    </div>

                    {nextStep && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleAdvanceDelivery(order)}
                          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                        >
                          {nextStep.actionLabel}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'history' && (
          <div className="space-y-3">
            {completedDeliveries.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-5 w-5" />}
                title="No completed deliveries yet"
                description="Your finished deliveries and collected COD records will appear here."
              />
            ) : (
              completedDeliveries.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-4 flex flex-wrap items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                        {order.orderNumber}
                      </span>
                      <StatusLabel
                        label={order.status === 'delivered' ? 'Delivered' : 'Cancelled'}
                        tone={order.status === 'delivered' ? 'success' : 'danger'}
                      />
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                      {order.deliveryAddress.recipientName} · {order.deliveryAddress.locality}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                      {formatINR(order.totalAmount)}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      COD {order.paymentStatus}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
