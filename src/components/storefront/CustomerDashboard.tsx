import React, { useEffect, useState } from 'react';
import {
  Package,
  MapPin,
  MessageSquare,
  User,
  Plus,
  Trash2,
  Send,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreData } from '../../contexts/StoreDataContext';
import { useToast } from '../../contexts/ToastContext';
import { OrderTimeline } from './OrderTimeline';
import { StatusLabel } from '../ui/StatusLabel';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { EmptyState } from '../ui/EmptyState';
import {
  createSupportTicket,
  deleteAddress,
  postSupportMessage,
  saveAddress,
  subscribeTicketMessages,
  updateOrderStatus,
} from '../../lib/firestoreService';
import { BLUEPRINT_PATTERNS, formatINR } from '../../utils/commerce';
import { canTransitionOrder, ORDER_STATUS_META } from '../../utils/workflow';
import type { Order, SupportMessage, SupportTicket, TicketCategory } from '../../types';

type AccountTab = 'orders' | 'addresses' | 'support' | 'profile';

export function CustomerDashboard({
  initialTab = 'orders',
  onGoToShop,
}: {
  initialTab?: string;
  onGoToShop: () => void;
}) {
  const { firebaseUser, profile, updateUserProfile } = useAuth();
  const { customerOrders, userAddresses, customerTickets, settings } = useStoreData();
  const { showToast } = useToast();

  const validInitial: AccountTab =
    initialTab === 'addresses' || initialTab === 'support' || initialTab === 'profile'
      ? initialTab
      : 'orders';

  const [activeTab, setActiveTab] = useState<AccountTab>(validInitial);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    customerOrders[0]?.id ?? null
  );

  // Address form
  const [addingAddr, setAddingAddr] = useState(false);
  const [addrLabel, setAddrLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [line1, setLine1] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locality, setLocality] = useState(settings.serviceableLocalities[0] || 'Rajpur Road');
  const [pincode, setPincode] = useState('248001');

  // Support state
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [ticketMessages, setTicketMessages] = useState<SupportMessage[]>([]);
  const [replyBody, setReplyBody] = useState('');
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketCategory, setTicketCategory] = useState<TicketCategory>('order');
  const [ticketOrderId, setTicketOrderId] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  // Profile state
  const [profileName, setProfileName] = useState(profile?.displayName || '');
  const [profilePhone, setProfilePhone] = useState(profile?.phone || '');
  const [profileLocality, setProfileLocality] = useState(profile?.locality || 'Rajpur Road');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (profile) {
      setProfileName(profile.displayName);
      setProfilePhone(profile.phone || '');
      setProfileLocality(profile.locality || 'Rajpur Road');
    }
  }, [profile]);

  useEffect(() => {
    if (!selectedTicket) {
      setTicketMessages([]);
      return;
    }
    return subscribeTicketMessages(
      selectedTicket.id,
      selectedTicket.userId,
      profile?.role === 'owner',
      setTicketMessages
    );
  }, [selectedTicket, profile?.role]);

  if (!firebaseUser || !profile) return null;

  const handleCancelOrder = async (order: Order) => {
    if (!canTransitionOrder('customer', order.status, 'cancelled')) return;
    try {
      await updateOrderStatus({
        order,
        nextStatus: 'cancelled',
        nextDeliveryStatus: 'cancelled',
        nextPaymentStatus: 'void',
        actor: { uid: profile.uid, displayName: profile.displayName, role: 'customer' },
        note: 'Cancelled by customer',
      });
      showToast(`Order ${order.orderNumber} cancelled.`, 'info');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to cancel order.', 'error');
    }
  };

  const handleCreateAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!BLUEPRINT_PATTERNS.pincode.test(pincode.trim())) {
      showToast('Pincode must be 6 digits.', 'error');
      return;
    }
    try {
      await saveAddress(firebaseUser.uid, {
        label: addrLabel.trim() || 'Home',
        recipientName: recipientName.trim() || profile.displayName,
        phone: phone.trim(),
        line1: line1.trim(),
        landmark: landmark.trim(),
        locality,
        city: 'Dehradun',
        pincode: pincode.trim(),
        isDefault: userAddresses.length === 0,
      });
      setAddingAddr(false);
      setLine1('');
      setLandmark('');
      showToast('Address added.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not save address.', 'error');
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (ticketSubject.trim().length < 3 || !ticketMessage.trim()) {
      showToast('Please enter a subject and message.', 'error');
      return;
    }
    try {
      await createSupportTicket({
        user: profile,
        subject: ticketSubject.trim(),
        category: ticketCategory,
        orderId: ticketOrderId || undefined,
        initialMessage: ticketMessage.trim(),
      });
      setNewTicketOpen(false);
      setTicketSubject('');
      setTicketMessage('');
      setTicketOrderId('');
      showToast('Support ticket submitted.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create ticket.', 'error');
    }
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyBody.trim()) return;
    try {
      await postSupportMessage({
        ticket: selectedTicket,
        sender: profile,
        body: replyBody.trim(),
      });
      setReplyBody('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to send reply.', 'error');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateUserProfile({
        displayName: profileName.trim() || profile.displayName,
        phone: profilePhone.trim(),
        locality: profileLocality,
      });
      showToast('Profile updated.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const tabs: { id: AccountTab; label: string; Icon: typeof Package }[] = [
    { id: 'orders', label: `Orders (${customerOrders.length})`, Icon: Package },
    { id: 'addresses', label: `Addresses (${userAddresses.length})`, Icon: MapPin },
    { id: 'support', label: `Support (${customerTickets.length})`, Icon: MessageSquare },
    { id: 'profile', label: 'Profile & Settings', Icon: User },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
          My Account
        </h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {profile.displayName} · {profile.email}
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6 border-b border-[var(--border-hairline)]">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
              activeTab === id
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {customerOrders.length === 0 ? (
            <EmptyState
              icon={<Package className="h-5 w-5" />}
              title="No orders placed yet"
              description="Explore fresh fruits, vegetables, dairy, and daily staples for doorstep Cash on Delivery in Dehradun."
              action={
                <button
                  type="button"
                  onClick={onGoToShop}
                  className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  Start Shopping
                </button>
              }
            />
          ) : (
            customerOrders.map((order) => {
              const isOpen = expandedOrderId === order.id;
              const meta = ORDER_STATUS_META[order.status];
              const canCancel = canTransitionOrder('customer', order.status, 'cancelled');
              return (
                <div
                  key={order.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setExpandedOrderId(isOpen ? null : order.id)}
                    className="w-full px-5 py-4 flex flex-wrap items-center justify-between gap-4 text-left hover:bg-[var(--bg-surface-subtle)]/60"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono-num text-sm font-bold text-[var(--text-primary)]">
                          {order.orderNumber}
                        </span>
                        <StatusLabel label={meta.label} tone={meta.tone} />
                      </div>
                      <p className="mt-1 text-xs text-[var(--text-muted)]">
                        {new Date(order.createdAt).toLocaleString('en-IN', {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}{' '}
                        · {order.items.length} items · Cash on Delivery
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="font-mono-num text-base font-bold text-[var(--text-primary)]">
                        {formatINR(order.totalAmount)}
                      </span>
                      {isOpen ? (
                        <ChevronUp className="h-4 w-4 text-[var(--text-muted)]" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-[var(--text-muted)]" />
                      )}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-2 border-t border-[var(--border-hairline)] space-y-5">
                      <OrderTimeline order={order} />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                        <div>
                          <h3 className="text-xs font-semibold text-[var(--text-secondary)] mb-2">
                            Items Ordered
                          </h3>
                          <ul className="divide-y divide-[var(--border-hairline)]">
                            {order.items.map((item) => (
                              <li
                                key={item.productId}
                                className="py-2 flex justify-between gap-2 text-xs"
                              >
                                <span className="text-[var(--text-primary)]">
                                  {item.quantity} × {item.name} ({item.unit})
                                </span>
                                <span className="font-mono-num font-medium text-[var(--text-primary)]">
                                  {formatINR(item.lineTotal)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-3 text-xs">
                          <div>
                            <h3 className="font-semibold text-[var(--text-secondary)] mb-1">
                              Delivery Address
                            </h3>
                            <p className="text-[var(--text-primary)]">
                              {order.deliveryAddress.recipientName} ({order.deliveryAddress.phone})
                            </p>
                            <p className="text-[var(--text-secondary)]">
                              {order.deliveryAddress.line1}, {order.deliveryAddress.locality},{' '}
                              {order.deliveryAddress.city} - {order.deliveryAddress.pincode}
                            </p>
                          </div>

                          {order.assignedPartnerName && (
                            <div>
                              <h3 className="font-semibold text-[var(--text-secondary)] mb-0.5">
                                Delivery Partner
                              </h3>
                              <p className="text-[var(--text-primary)]">
                                {order.assignedPartnerName}
                              </p>
                            </div>
                          )}

                          {canCancel && (
                            <div className="pt-2">
                              <button
                                type="button"
                                onClick={() => handleCancelOrder(order)}
                                className="rounded-lg border border-[var(--border-hairline)] px-3.5 py-1.5 text-xs font-semibold text-[var(--status-danger-text)] hover:bg-[var(--status-danger-bg)]"
                              >
                                Cancel Order
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ADDRESSES TAB */}
      {activeTab === 'addresses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
              Saved Delivery Addresses
            </h2>
            <button
              type="button"
              onClick={() => setAddingAddr((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              {addingAddr ? 'Cancel' : 'New Address'}
            </button>
          </div>

          {addingAddr && (
            <form
              onSubmit={handleCreateAddress}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3.5"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={addrLabel}
                  onChange={(e) => setAddrLabel(e.target.value)}
                  placeholder="Label (Home / Work)"
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Recipient Name"
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit Mobile"
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={line1}
                  onChange={(e) => setLine1(e.target.value)}
                  placeholder="House / Street Address"
                  className="sm:col-span-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <select
                  value={locality}
                  onChange={(e) => setLocality(e.target.value)}
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                >
                  {settings.serviceableLocalities.map((loc) => (
                    <option key={loc} value={loc}>
                      {loc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="Landmark (optional)"
                  className="sm:col-span-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                  placeholder="248001"
                  className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Save Address
              </button>
            </form>
          )}

          {userAddresses.length === 0 ? (
            <EmptyState
              icon={<MapPin className="h-5 w-5" />}
              title="No saved addresses"
              description="Add a Dehradun delivery address for faster checkout."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {userAddresses.map((addr) => (
                <div
                  key={addr.id}
                  className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 flex justify-between gap-4"
                >
                  <div className="text-sm">
                    <p className="font-semibold text-[var(--text-primary)]">
                      {addr.label} · {addr.recipientName}
                    </p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">
                      {addr.line1}
                      {addr.landmark ? `, ${addr.landmark}` : ''}, {addr.locality}, {addr.city} -{' '}
                      {addr.pincode}
                    </p>
                    <p className="mt-1 text-xs font-mono-num text-[var(--text-muted)]">
                      {addr.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteAddress(addr.id);
                      showToast('Address removed.', 'info');
                    }}
                    aria-label={`Delete ${addr.label} address`}
                    className="self-start p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger-text)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUPPORT TAB */}
      {activeTab === 'support' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
                Support Tickets
              </h2>
              <button
                type="button"
                onClick={() => setNewTicketOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                <Plus className="h-3.5 w-3.5" />
                New Ticket
              </button>
            </div>

            {newTicketOpen && (
              <form
                onSubmit={handleCreateTicket}
                className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4 space-y-3"
              >
                <input
                  type="text"
                  required
                  value={ticketSubject}
                  onChange={(e) => setTicketSubject(e.target.value)}
                  placeholder="Subject (e.g. Missing item in delivery)"
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <select
                    value={ticketCategory}
                    onChange={(e) => setTicketCategory(e.target.value as TicketCategory)}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="order">Order Issue</option>
                    <option value="delivery">Delivery</option>
                    <option value="quality">Product Quality</option>
                    <option value="account">Account</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={ticketOrderId}
                    onChange={(e) => setTicketOrderId(e.target.value)}
                    className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-xs text-[var(--text-primary)]"
                  >
                    <option value="">Related Order (optional)</option>
                    {customerOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.orderNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  rows={3}
                  required
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Describe how our Dehradun support team can help..."
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                >
                  Submit Ticket
                </button>
              </form>
            )}

            {customerTickets.length === 0 ? (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="No support tickets"
                description="Need help with an order or delivery? Open a ticket and our local support team will reply."
              />
            ) : (
              <div className="space-y-2.5">
                {customerTickets.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelectedTicket(t)}
                    className={`w-full text-left rounded-xl border p-4 transition-colors ${
                      selectedTicket?.id === t.id
                        ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                        : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono-num text-xs font-semibold text-[var(--text-muted)]">
                        {t.ticketNumber}
                      </span>
                      <StatusLabel
                        label={t.status.replace('_', ' ')}
                        tone={t.status === 'resolved' || t.status === 'closed' ? 'success' : 'warning'}
                      />
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                      {t.subject}
                    </p>
                    <p className="mt-0.5 text-xs text-[var(--text-muted)] capitalize">
                      {t.category} · Priority: {t.priority}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-7">
            {selectedTicket ? (
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] flex flex-col h-[480px]">
                <div className="px-5 py-4 border-b border-[var(--border-hairline)]">
                  <p className="font-mono-num text-xs text-[var(--text-muted)]">
                    {selectedTicket.ticketNumber}
                  </p>
                  <h3 className="font-display text-base font-semibold text-[var(--text-primary)]">
                    {selectedTicket.subject}
                  </h3>
                </div>
                <div className="flex-1 overflow-y-auto p-5 space-y-3">
                  {ticketMessages.map((msg) => {
                    const isSelf = msg.senderId === profile.uid;
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[82%] rounded-xl px-4 py-2.5 text-sm ${
                            isSelf
                              ? 'bg-[var(--brand-primary)] text-white'
                              : 'bg-[var(--bg-surface-subtle)] text-[var(--text-primary)] border border-[var(--border-hairline)]'
                          }`}
                        >
                          <p className="text-[11px] opacity-80 mb-1">
                            {msg.senderName} · {msg.senderRole}
                          </p>
                          <p className="leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {selectedTicket.status !== 'closed' && (
                  <form
                    onSubmit={handleSendReply}
                    className="p-3 border-t border-[var(--border-hairline)] flex gap-2"
                  >
                    <input
                      type="text"
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write a reply..."
                      className="flex-1 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                    <button
                      type="submit"
                      aria-label="Send support reply"
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
                    >
                      <Send className="h-3.5 w-3.5" />
                      Send
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <EmptyState
                icon={<MessageSquare className="h-5 w-5" />}
                title="Select a ticket to view messages"
                description="Choose any ticket on the left to read responses from FinEase Support or send a follow-up."
              />
            )}
          </div>
        </div>
      )}

      {/* PROFILE & THEME TAB */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Account Details Form */}
          <form
            onSubmit={handleSaveProfile}
            className="lg:col-span-7 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden"
          >
            <div className="px-6 py-5 border-b border-[var(--border-hairline)]">
              <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                Account Details
              </h2>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Keep your contact details and default Dehradun delivery zone up to date.
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prof-name"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                  >
                    Full Name
                  </label>
                  <input
                    id="prof-name"
                    type="text"
                    required
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full h-10 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prof-email"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                  >
                    Email Address
                  </label>
                  <input
                    id="prof-email"
                    type="email"
                    value={profile.email}
                    disabled
                    className="w-full h-10 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] px-3.5 text-sm text-[var(--text-muted)] cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="prof-phone"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                  >
                    Phone Number
                  </label>
                  <input
                    id="prof-phone"
                    type="tel"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="10-digit mobile number"
                    className="w-full h-10 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3.5 text-sm font-mono-num text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="prof-loc"
                    className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5"
                  >
                    Default Dehradun Locality
                  </label>
                  <div className="relative">
                    <select
                      id="prof-loc"
                      value={profileLocality}
                      onChange={(e) => setProfileLocality(e.target.value)}
                      className="w-full h-10 appearance-none rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-3.5 pr-9 text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                    >
                      {settings.serviceableLocalities.map((loc) => (
                        <option key={loc} value={loc}>
                          {loc}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      aria-hidden="true"
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-[var(--bg-surface-subtle)]/50 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)]">
                Changes sync immediately to your FinEase profile.
              </p>
              <button
                type="submit"
                disabled={savingProfile}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--brand-primary)] px-5 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60 whitespace-nowrap shrink-0 transition-colors"
              >
                {savingProfile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>

          {/* Right Column: Appearance Theme & Account Summary */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[var(--border-hairline)]">
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  Appearance Theme
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                  Synced automatically with your FinEase profile across devices.
                </p>
              </div>
              <div className="p-6 flex items-center justify-between gap-4 flex-wrap">
                <span className="text-xs font-medium text-[var(--text-secondary)]">
                  Display Mode
                </span>
                <ThemeSwitcher />
              </div>
            </div>

            <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden">
              <div className="px-6 py-4 border-b border-[var(--border-hairline)]">
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  Account Summary
                </h2>
              </div>
              <dl className="divide-y divide-[var(--border-hairline)] px-6 text-sm">
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-xs text-[var(--text-secondary)]">Account Role</dt>
                  <dd className="text-xs font-semibold capitalize text-[var(--text-primary)]">
                    {profile.role.replace('_', ' ')}
                  </dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-xs text-[var(--text-secondary)]">Email Status</dt>
                  <dd>
                    <StatusLabel
                      label={firebaseUser.emailVerified ? 'Verified' : 'Unverified'}
                      tone={firebaseUser.emailVerified ? 'success' : 'warning'}
                    />
                  </dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-xs text-[var(--text-secondary)]">Orders Placed</dt>
                  <dd className="font-mono-num text-xs font-semibold text-[var(--text-primary)]">
                    {customerOrders.length}
                  </dd>
                </div>
                <div className="py-3 flex items-center justify-between gap-4">
                  <dt className="text-xs text-[var(--text-secondary)]">Saved Addresses</dt>
                  <dd className="font-mono-num text-xs font-semibold text-[var(--text-primary)]">
                    {userAddresses.length}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
