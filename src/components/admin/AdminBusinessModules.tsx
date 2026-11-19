import React, { useEffect, useState } from 'react';
import { Download, Send, Shield, Trash2 } from 'lucide-react';
import { StatusLabel } from '../ui/StatusLabel';
import { useToast } from '../../contexts/ToastContext';
import {
  assignStaffRole,
  deleteCoupon,
  postSupportMessage,
  saveCoupon,
  savePlatformSettings,
  subscribeTicketMessages,
  updateSupportTicket,
} from '../../lib/firestoreService';
import { formatINR, triggerCsvDownload } from '../../utils/commerce';
import type {
  AuditLog,
  Coupon,
  DeliveryAssignment,
  Expense,
  Order,
  PlatformSettings,
  Product,
  SupportMessage,
  SupportTicket,
  TicketPriority,
  TicketStatus,
  UserProfile,
  UserRole,
} from '../../types';

export function AdminCouponsPanel({
  coupons,
  actor,
}: {
  coupons: Coupon[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState('50');
  const [minOrderValue, setMinOrderValue] = useState('250');
  const [usageLimit, setUsageLimit] = useState('200');
  const [expiresAt, setExpiresAt] = useState('2027-12-31');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length < 3) return;
    try {
      await saveCoupon(
        {
          code: code.trim().toUpperCase(),
          description:
            discountType === 'fixed'
              ? `Flat ₹${discountValue} off above ₹${minOrderValue}`
              : `${discountValue}% off above ₹${minOrderValue}`,
          discountType,
          discountValue: Number(discountValue),
          maxDiscount: discountType === 'percentage' ? 150 : null,
          minOrderValue: Number(minOrderValue),
          usageLimit: Number(usageLimit),
          usedCount: 0,
          expiresAt: `${expiresAt}T23:59:59.000Z`,
          isActive: true,
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role }
      );
      setCode('');
      showToast('Coupon created.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create coupon.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3"
      >
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Create Promotional Coupon
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
          <input
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE (e.g. DOON25)"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono-num uppercase text-[var(--text-primary)]"
          />
          <select
            value={discountType}
            onChange={(e) => setDiscountType(e.target.value as 'fixed' | 'percentage')}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="fixed">Flat ₹ Off</option>
            <option value="percentage">% Off</option>
          </select>
          <input
            type="number"
            min={1}
            required
            value={discountValue}
            onChange={(e) => setDiscountValue(e.target.value)}
            placeholder="Value"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
          />
          <input
            type="number"
            min={0}
            required
            value={minOrderValue}
            onChange={(e) => setMinOrderValue(e.target.value)}
            placeholder="Min Order ₹"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
          />
          <input
            type="date"
            value={expiresAt}
            onChange={(e) => setExpiresAt(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono-num text-[var(--text-primary)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Create
          </button>
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          Usage limit:{' '}
          <input
            type="number"
            min={1}
            value={usageLimit}
            onChange={(e) => setUsageLimit(e.target.value)}
            className="w-20 rounded border border-[var(--border-hairline)] bg-[var(--bg-input)] px-2 py-0.5 font-mono-num text-[var(--text-primary)]"
          />{' '}
          redemptions
        </div>
      </form>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Discount</th>
              <th className="px-4 py-3 font-medium text-right">Min Order</th>
              <th className="px-4 py-3 font-medium text-right">Usage</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {coupons.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-mono-num font-bold text-[var(--text-primary)]">
                  {c.code}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">
                  {c.discountType === 'fixed' ? formatINR(c.discountValue) : `${c.discountValue}%`}
                </td>
                <td className="px-4 py-3 text-right font-mono-num text-xs">
                  {formatINR(c.minOrderValue)}
                </td>
                <td className="px-4 py-3 text-right font-mono-num text-xs">
                  {c.usedCount} / {c.usageLimit}
                </td>
                <td className="px-4 py-3">
                  <StatusLabel
                    label={c.isActive ? 'Active' : 'Disabled'}
                    tone={c.isActive ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteCoupon(c, {
                        uid: actor.uid,
                        displayName: actor.displayName,
                        role: actor.role,
                      });
                      showToast(`Deleted coupon ${c.code}.`, 'info');
                    }}
                    aria-label={`Delete coupon ${c.code}`}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger-text)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSupportPanel({
  tickets,
  actor,
}: {
  tickets: SupportTicket[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [selected, setSelected] = useState<SupportTicket | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [reply, setReply] = useState('');

  useEffect(() => {
    if (!selected) {
      setMessages([]);
      return;
    }
    return subscribeTicketMessages(selected.id, selected.userId, true, setMessages);
  }, [selected]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reply.trim()) return;
    try {
      await postSupportMessage({ ticket: selected, sender: actor, body: reply.trim() });
      setReply('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Reply failed.', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-5 space-y-2.5">
        {tickets.length === 0 ? (
          <p className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 text-xs text-[var(--text-muted)] text-center">
            No support tickets submitted yet.
          </p>
        ) : (
          tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelected(t)}
              className={`w-full text-left rounded-xl border p-4 ${
                selected?.id === t.id
                  ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                  : 'border-[var(--border-hairline)] bg-[var(--bg-surface)]'
              }`}
            >
              <div className="flex justify-between text-xs">
                <span className="font-mono-num font-bold text-[var(--text-muted)]">
                  {t.ticketNumber}
                </span>
                <span className="capitalize font-medium text-[var(--text-secondary)]">
                  {t.priority} · {t.status.replace('_', ' ')}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{t.subject}</p>
              <p className="text-xs text-[var(--text-muted)]">{t.customerName} · {t.customerEmail}</p>
            </button>
          ))
        )}
      </div>

      <div className="lg:col-span-7">
        {selected ? (
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col h-[500px]">
            <div className="p-4 border-b border-[var(--border-hairline)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
                  {selected.subject}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">{selected.customerName}</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selected.priority}
                  onChange={async (e) => {
                    const p = e.target.value as TicketPriority;
                    await updateSupportTicket(selected.id, { priority: p });
                    setSelected({ ...selected, priority: p });
                  }}
                  className="rounded border border-[var(--border-hairline)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
                <select
                  value={selected.status}
                  onChange={async (e) => {
                    const s = e.target.value as TicketStatus;
                    await updateSupportTicket(selected.id, { status: s });
                    setSelected({ ...selected, status: s });
                    showToast(`Ticket marked ${s}.`, 'success');
                  }}
                  className="rounded border border-[var(--border-hairline)] bg-[var(--bg-input)] px-2 py-1 text-xs text-[var(--text-primary)]"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.senderRole === 'owner' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm ${
                      m.senderRole === 'owner'
                        ? 'bg-[var(--brand-primary)] text-white'
                        : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border border-[var(--border-hairline)]'
                    }`}
                  >
                    <p className="text-[11px] opacity-80 mb-0.5">{m.senderName}</p>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleSend}
              className="p-3 border-t border-[var(--border-hairline)] flex gap-2"
            >
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Write support response..."
                className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white"
              >
                <Send className="h-3.5 w-3.5" />
                Reply
              </button>
            </form>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-10 text-center text-xs text-[var(--text-muted)]">
            Select a support ticket to inspect conversation history and respond.
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminReportsPanel({
  orders,
  products,
  users,
  expenses,
  assignments,
}: {
  orders: Order[];
  products: Product[];
  users: UserProfile[];
  expenses: Expense[];
  assignments: DeliveryAssignment[];
}) {
  const reports = [
    {
      title: 'Sales & Revenue Report',
      description: `${orders.filter((o) => o.status !== 'cancelled').length} non-cancelled orders with COD payment status and totals.`,
      exportFn: () =>
        triggerCsvDownload(
          'finease-sales-report.csv',
          ['OrderNumber', 'Date', 'Customer', 'Locality', 'Subtotal', 'Discount', 'DeliveryFee', 'Total', 'Status', 'PaymentStatus'],
          orders.map((o) => [
            o.orderNumber,
            o.createdAt,
            o.customerName,
            o.deliveryAddress.locality,
            o.subtotal,
            o.discountAmount,
            o.deliveryFee,
            o.totalAmount,
            o.status,
            o.paymentStatus,
          ])
        ),
    },
    {
      title: 'Inventory Valuation & Stock Report',
      description: `${products.length} catalog SKUs with stock counts, min thresholds, and unit prices.`,
      exportFn: () =>
        triggerCsvDownload(
          'finease-inventory-report.csv',
          ['SKU', 'Name', 'Category', 'Unit', 'Price', 'DiscountPrice', 'Stock', 'MinThreshold', 'Active'],
          products.map((p) => [
            p.sku,
            p.name,
            p.categoryName,
            p.unit,
            p.price,
            p.discountPrice ?? '',
            p.stock,
            p.minStockThreshold,
            p.isActive,
          ])
        ),
    },
    {
      title: 'Customer Directory Report',
      description: `${users.length} accounts with role, locality, and registration timestamp.`,
      exportFn: () =>
        triggerCsvDownload(
          'finease-customers-report.csv',
          ['Name', 'Email', 'Role', 'Locality', 'CreatedAt'],
          users.map((u) => [u.displayName, u.email, u.role, u.locality ?? '', u.createdAt])
        ),
    },
    {
      title: 'Delivery Operations Report',
      description: `${assignments.length} dispatch assignments with partner names and completion status.`,
      exportFn: () =>
        triggerCsvDownload(
          'finease-delivery-report.csv',
          ['OrderNumber', 'PartnerName', 'Status', 'AssignedAt'],
          assignments.map((a) => [a.orderNumber, a.partnerName, a.status, a.assignedAt])
        ),
    },
    {
      title: 'Operating Expenses Report',
      description: `${expenses.length} recorded expense entries totaling ${formatINR(expenses.reduce((s, e) => s + e.amount, 0))}.`,
      exportFn: () =>
        triggerCsvDownload(
          'finease-expenses-report.csv',
          ['Date', 'Title', 'Category', 'Amount', 'Notes'],
          expenses.map((e) => [e.expenseDate, e.title, e.category, e.amount, e.notes ?? ''])
        ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {reports.map((r) => (
        <div
          key={r.title}
          className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              {r.title}
            </h3>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">{r.description}</p>
          </div>
          <button
            type="button"
            onClick={r.exportFn}
            className="self-start inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-hairline)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      ))}
    </div>
  );
}

export function AdminAuditLogsPanel({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
            <th className="px-4 py-3 font-medium">Timestamp</th>
            <th className="px-4 py-3 font-medium">Actor</th>
            <th className="px-4 py-3 font-medium">Action</th>
            <th className="px-4 py-3 font-medium">Summary</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border-hairline)] text-xs">
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="px-4 py-3 font-mono-num text-[var(--text-muted)] whitespace-nowrap">
                {new Date(log.createdAt).toLocaleString('en-IN')}
              </td>
              <td className="px-4 py-3 text-[var(--text-primary)] font-medium">
                {log.actorName}{' '}
                <span className="text-[var(--text-muted)]">({log.actorRole})</span>
              </td>
              <td className="px-4 py-3 font-mono-num text-[var(--brand-primary-text)]">
                {log.action}
              </td>
              <td className="px-4 py-3 text-[var(--text-secondary)]">{log.summary}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-8 text-center text-[var(--text-muted)]">
                No administrative audit events recorded yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function AdminSettingsPanel({
  settings,
  users,
  actor,
}: {
  settings: PlatformSettings;
  users: UserProfile[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [storeName, setStoreName] = useState(settings.storeName);
  const [city, setCity] = useState(settings.city);
  const [supportPhone, setSupportPhone] = useState(settings.supportPhone || '');
  const [supportEmail, setSupportEmail] = useState(settings.supportEmail || '');
  const [deliveryFee, setDeliveryFee] = useState(String(settings.deliveryFee));
  const [freeThreshold, setFreeThreshold] = useState(String(settings.freeDeliveryThreshold));
  const [minOrder, setMinOrder] = useState(String(settings.minOrderAmount));
  const [eta, setEta] = useState(String(settings.estimatedDeliveryMinutes));
  const [localitiesText, setLocalitiesText] = useState(settings.serviceableLocalities.join(', '));
  const [saving, setSaving] = useState(false);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await savePlatformSettings(
        {
          storeName: storeName.trim(),
          city: city.trim(),
          supportPhone: supportPhone.trim(),
          supportEmail: supportEmail.trim(),
          deliveryFee: Number(deliveryFee),
          freeDeliveryThreshold: Number(freeThreshold),
          minOrderAmount: Number(minOrder),
          estimatedDeliveryMinutes: Number(eta),
          serviceableLocalities: localitiesText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role }
      );
      showToast('Platform settings saved.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async (targetUser: UserProfile, role: UserRole) => {
    try {
      await assignStaffRole({
        targetUser,
        role,
        actor: { uid: actor.uid, displayName: actor.displayName, role: actor.role },
      });
      showToast(`Updated ${targetUser.displayName} to ${role.replace('_', ' ')}.`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Role update failed.', 'error');
    }
  };

  return (
    <div className="space-y-8">
      <form
        onSubmit={handleSaveSettings}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4"
      >
        <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
          Dehradun Delivery & Store Configuration
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Store Name
            </label>
            <input
              type="text"
              required
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Operating City
            </label>
            <input
              type="text"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Support Phone
            </label>
            <input
              type="text"
              value={supportPhone}
              onChange={(e) => setSupportPhone(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Support Email
            </label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Delivery Fee (₹)
            </label>
            <input
              type="number"
              min={0}
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Free Delivery Above (₹)
            </label>
            <input
              type="number"
              min={0}
              value={freeThreshold}
              onChange={(e) => setFreeThreshold(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Min Order (₹)
            </label>
            <input
              type="number"
              min={0}
              value={minOrder}
              onChange={(e) => setMinOrder(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              ETA (Minutes)
            </label>
            <input
              type="number"
              min={10}
              max={240}
              value={eta}
              onChange={(e) => setEta(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Serviceable Localities (comma-separated)
          </label>
          <textarea
            rows={2}
            value={localitiesText}
            onChange={(e) => setLocalitiesText(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
        >
          {saving ? 'Saving...' : 'Save Store Settings'}
        </button>
      </form>

      {/* Owner-Only Staff Role Provisioning */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--brand-primary-text)]" />
          <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
            Privileged Role Provisioning (Owner Only)
          </h2>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">
          Assign Store Manager or Delivery Partner privileges to verified FinEase accounts. Roles
          are written to the protected <code>/staff_roles</code> collection enforced by Firestore
          Security Rules.
        </p>

        <div className="divide-y divide-[var(--border-hairline)]">
          {users.map((u) => (
            <div key={u.uid} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="text-xs">
                <p className="font-semibold text-[var(--text-primary)]">{u.displayName}</p>
                <p className="text-[var(--text-muted)]">
                  {u.email} · UID: <span className="font-mono-num">{u.uid.slice(0, 12)}...</span>
                </p>
              </div>
              <select
                aria-label={`Role for ${u.email}`}
                value={u.role}
                disabled={u.uid === actor.uid}
                onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-1.5 text-xs font-medium text-[var(--text-primary)] disabled:opacity-50"
              >
                <option value="customer">Customer</option>
                <option value="store_manager">Store Manager</option>
                <option value="delivery_partner">Delivery Partner</option>
                <option value="owner">Owner / Super Admin</option>
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
