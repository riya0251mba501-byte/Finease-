import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Package,
  AlertTriangle,
  CheckSquare,
  Square,
  ArrowLeft,
  Sliders,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreData } from '../../contexts/StoreDataContext';
import { useToast } from '../../contexts/ToastContext';
import { FinEaseLogo } from '../ui/FinEaseLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { StatusLabel } from '../ui/StatusLabel';
import { Modal } from '../ui/Modal';
import { EmptyState } from '../ui/EmptyState';
import {
  adjustProductInventory,
  subscribeAllOrders,
  subscribeInventoryLogs,
  updateOrderPickingChecklist,
  updateOrderStatus,
} from '../../lib/firestoreService';
import { ORDER_STATUS_META } from '../../utils/workflow';
import type { InventoryChangeType, InventoryLog, Order, Product } from '../../types';

export function StoreManagerDashboard({ onExit }: { onExit: () => void }) {
  const { profile } = useAuth();
  const { products } = useStoreData();
  const { showToast } = useToast();

  const [tab, setTab] = useState<'orders' | 'inventory'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // Stock Adjustment Modal
  const [adjustTarget, setAdjustTarget] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const [changeType, setChangeType] = useState<InventoryChangeType>('restock');
  const [reason, setReason] = useState('');
  const [savingStock, setSavingStock] = useState(false);

  useEffect(() => {
    const unsubOrders = subscribeAllOrders(setOrders);
    const unsubLogs = subscribeInventoryLogs(setInventoryLogs);
    return () => {
      unsubOrders();
      unsubLogs();
    };
  }, []);

  if (!profile) return null;

  const storeQueueOrders = orders.filter((o) =>
    ['confirmed', 'preparing', 'ready_for_pickup'].includes(o.status)
  );
  const lowStockProducts = products.filter((p) => p.stock <= p.minStockThreshold);
  const displayedProducts = lowStockOnly ? lowStockProducts : products;

  const handleToggleChecklistItem = async (order: Order, productId: string) => {
    const current =
      order.pickingChecklist && order.pickingChecklist.length > 0
        ? order.pickingChecklist
        : order.items.map((i) => ({
            productId: i.productId,
            name: i.name,
            sku: i.sku,
            quantity: i.quantity,
            picked: false,
          }));
    const updated = current.map((c) =>
      c.productId === productId ? { ...c, picked: !c.picked } : c
    );
    try {
      await updateOrderPickingChecklist(order, updated);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update checklist.', 'error');
    }
  };

  const handleAdvanceOrder = async (order: Order, nextStatus: 'preparing' | 'ready_for_pickup') => {
    try {
      await updateOrderStatus({
        order,
        nextStatus,
        actor: { uid: profile.uid, displayName: profile.displayName, role: profile.role },
        note:
          nextStatus === 'preparing'
            ? 'Store Manager started picking and packing'
            : 'Order packed and ready for delivery pickup',
      });
      showToast(`Order ${order.orderNumber} marked ${nextStatus.replace(/_/g, ' ')}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed.', 'error');
    }
  };

  const handleSubmitStockAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget) return;
    if (reason.trim().length < 2) {
      showToast('Please provide a reason for the inventory adjustment.', 'error');
      return;
    }
    setSavingStock(true);
    try {
      await adjustProductInventory({
        product: adjustTarget,
        newStock: Number(newStock),
        changeType,
        reason: reason.trim(),
        actor: { uid: profile.uid, displayName: profile.displayName, role: profile.role },
      });
      showToast(`Stock updated for ${adjustTarget.name}.`, 'success');
      setAdjustTarget(null);
      setReason('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Inventory adjustment failed.', 'error');
    } finally {
      setSavingStock(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-canvas)]">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <FinEaseLogo size="sm" />
          <span className="text-xs font-medium text-[var(--text-muted)] hidden sm:inline">
            Store & Inventory Manager
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

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Operational KPIs (Store-scoped only — zero financial data exposed) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">Orders to Prepare</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
              {storeQueueOrders.filter((o) => o.status !== 'ready_for_pickup').length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">Ready for Partner Pickup</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--status-success-text)]">
              {storeQueueOrders.filter((o) => o.status === 'ready_for_pickup').length}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
            <p className="text-xs text-[var(--text-muted)]">Low-Stock Alerts</p>
            <p className="mt-1 font-mono-num text-2xl font-bold text-[var(--status-warning-text)]">
              {lowStockProducts.length}
            </p>
          </div>
        </div>

        {/* Restricted Navigation Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b border-[var(--border-hairline)] pb-3">
          <button
            type="button"
            onClick={() => setTab('orders')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'orders'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            Order Preparation ({storeQueueOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('inventory')}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${
              tab === 'inventory'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)]'
            }`}
          >
            <Package className="h-4 w-4" />
            Stock & Inventory
          </button>
        </div>

        {tab === 'orders' && (
          <div className="space-y-4">
            {storeQueueOrders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-5 w-5" />}
                title="No active orders in store queue"
                description="Confirmed orders approved by the Owner will appear here for picking and packing."
              />
            ) : (
              storeQueueOrders.map((order) => {
                const checklist =
                  order.pickingChecklist && order.pickingChecklist.length > 0
                    ? order.pickingChecklist
                    : order.items.map((i) => ({
                        productId: i.productId,
                        name: i.name,
                        sku: i.sku,
                        quantity: i.quantity,
                        picked: false,
                      }));
                const allPicked = checklist.every((c) => c.picked);
                const meta = ORDER_STATUS_META[order.status];

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border-hairline)]">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                            {order.orderNumber}
                          </span>
                          <StatusLabel label={meta.label} tone={meta.tone} />
                        </div>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">
                          Locality: {order.deliveryAddress.locality} · {order.items.length} items
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {order.status === 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceOrder(order, 'preparing')}
                            className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                          >
                            Start Preparing
                          </button>
                        )}
                        {order.status === 'preparing' && (
                          <button
                            type="button"
                            onClick={() => handleAdvanceOrder(order, 'ready_for_pickup')}
                            className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                          >
                            {allPicked ? 'Mark Ready for Pickup' : 'Mark Ready (Force)'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                        Picking Checklist
                      </p>
                      <div className="space-y-2">
                        {checklist.map((item) => (
                          <button
                            key={item.productId}
                            type="button"
                            onClick={() => handleToggleChecklistItem(order, item.productId)}
                            className="w-full flex items-center justify-between gap-3 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] px-3.5 py-2.5 text-left hover:border-[var(--brand-primary)]"
                          >
                            <div className="flex items-center gap-2.5">
                              {item.picked ? (
                                <CheckSquare className="h-4 w-4 text-[var(--brand-primary-text)] shrink-0" />
                              ) : (
                                <Square className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
                              )}
                              <span
                                className={`text-sm ${
                                  item.picked
                                    ? 'line-through text-[var(--text-muted)]'
                                    : 'text-[var(--text-primary)] font-medium'
                                }`}
                              >
                                {item.name}
                              </span>
                            </div>
                            <span className="font-mono-num text-xs text-[var(--text-secondary)]">
                              Qty: {item.quantity} · {item.sku}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === 'inventory' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={lowStockOnly}
                  onChange={(e) => setLowStockOnly(e.target.checked)}
                  className="accent-[var(--brand-primary)]"
                />
                Show low-stock items only ({lowStockProducts.length})
              </label>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                    <th className="px-4 py-3 font-medium">Product</th>
                    <th className="px-4 py-3 font-medium">SKU</th>
                    <th className="px-4 py-3 font-medium text-right">Stock</th>
                    <th className="px-4 py-3 font-medium text-right">Threshold</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-hairline)]">
                  {displayedProducts.map((prod) => {
                    const isLow = prod.stock <= prod.minStockThreshold;
                    return (
                      <tr key={prod.id} className="hover:bg-[var(--bg-surface-subtle)]/50">
                        <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                          {prod.name}
                          <span className="block text-xs text-[var(--text-muted)]">{prod.unit}</span>
                        </td>
                        <td className="px-4 py-3 font-mono-num text-xs text-[var(--text-secondary)]">
                          {prod.sku}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-right font-semibold text-[var(--text-primary)]">
                          {prod.stock}
                        </td>
                        <td className="px-4 py-3 font-mono-num text-right text-[var(--text-muted)]">
                          {prod.minStockThreshold}
                        </td>
                        <td className="px-4 py-3">
                          {prod.stock === 0 ? (
                            <StatusLabel label="Out of Stock" tone="danger" />
                          ) : isLow ? (
                            <StatusLabel label="Low Stock" tone="warning" />
                          ) : (
                            <StatusLabel label="Healthy" tone="success" />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustTarget(prod);
                              setNewStock(String(prod.stock));
                              setChangeType('restock');
                              setReason('');
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                          >
                            <Sliders className="h-3.5 w-3.5" />
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Recent Stock Movements */}
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
              <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--text-muted)]" />
                Recent Inventory Logs
              </h3>
              {inventoryLogs.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)]">No inventory movements recorded yet.</p>
              ) : (
                <div className="divide-y divide-[var(--border-hairline)]">
                  {inventoryLogs.slice(0, 12).map((log) => (
                    <div key={log.id} className="py-2.5 flex flex-wrap justify-between gap-2 text-xs">
                      <div>
                        <span className="font-medium text-[var(--text-primary)]">{log.productName}</span>
                        <span className="text-[var(--text-muted)]"> · {log.reason}</span>
                      </div>
                      <div className="font-mono-num text-[var(--text-secondary)]">
                        {log.previousStock} → {log.newStock} ({log.quantityDelta >= 0 ? '+' : ''}
                        {log.quantityDelta}) · {log.performedByName}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Modal
        open={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title={`Adjust Stock — ${adjustTarget?.name ?? ''}`}
        subtitle={`Current stock: ${adjustTarget?.stock ?? 0} units (${adjustTarget?.sku ?? ''})`}
      >
        <form onSubmit={handleSubmitStockAdjustment} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="sm-stock" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                New Stock Count
              </label>
              <input
                id="sm-stock"
                type="number"
                min={0}
                required
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label htmlFor="sm-type" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Movement Type
              </label>
              <select
                id="sm-type"
                value={changeType}
                onChange={(e) => setChangeType(e.target.value as InventoryChangeType)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                <option value="restock">Supplier Restock</option>
                <option value="adjustment">Audit Adjustment</option>
                <option value="spoilage">Spoilage / Damaged</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="sm-reason" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Reason (Logged to Audit Trail)
            </label>
            <input
              id="sm-reason"
              type="text"
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Morning supplier delivery batch #12"
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAdjustTarget(null)}
              className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingStock}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
            >
              {savingStock ? 'Saving...' : 'Save Stock Update'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
