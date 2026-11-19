import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  MapPin,
  Plus,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { useStoreData } from '../../contexts/StoreDataContext';
import { useToast } from '../../contexts/ToastContext';
import { placeCodOrderTransaction, saveAddress } from '../../lib/firestoreService';
import {
  BLUEPRINT_PATTERNS,
  calculateCartSummary,
  formatINR,
  generateSafeId,
  getEffectivePrice,
  validateCartStock,
} from '../../utils/commerce';
import type { Address, Order } from '../../types';

interface CheckoutViewProps {
  onBackToShop: () => void;
  onOrderComplete: (order: Order) => void;
  onOpenAuth: () => void;
}

export function CheckoutView({
  onBackToShop,
  onOrderComplete,
  onOpenAuth,
}: CheckoutViewProps) {
  const { firebaseUser, profile, resendVerificationEmail } = useAuth();
  const { items, couponCode, clearCart } = useCart();
  const { products, coupons, settings, userAddresses, selectedLocality } = useStoreData();
  const { showToast } = useToast();

  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showNewAddress, setShowNewAddress] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);
  const [idempotencyKey] = useState(() => generateSafeId('idem'));

  // New Address Form State
  const [addrLabel, setAddrLabel] = useState('Home');
  const [recipientName, setRecipientName] = useState(profile?.displayName || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [line1, setLine1] = useState('');
  const [landmark, setLandmark] = useState('');
  const [locality, setLocality] = useState(selectedLocality);
  const [pincode, setPincode] = useState('248001');
  const [savingAddr, setSavingAddr] = useState(false);

  const activeCoupon = couponCode
    ? coupons.find((c) => c.code.toUpperCase() === couponCode.toUpperCase())
    : null;
  const summary = calculateCartSummary(items, settings, activeCoupon);
  const stockErrors = useMemo(() => validateCartStock(items, products), [items, products]);

  const effectiveAddress: Address | undefined = useMemo(() => {
    if (selectedAddressId) {
      return userAddresses.find((a) => a.id === selectedAddressId);
    }
    return userAddresses.find((a) => a.isDefault) || userAddresses[0];
  }, [selectedAddressId, userAddresses]);

  const handleSaveNewAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setErrorMsg('');

    if (recipientName.trim().length < 2) {
      setErrorMsg('Recipient name must be at least 2 characters.');
      return;
    }
    if (!BLUEPRINT_PATTERNS.phone.test(phone.trim())) {
      setErrorMsg('Please enter a valid 10-digit phone number.');
      return;
    }
    if (line1.trim().length < 4) {
      setErrorMsg('Please enter your complete house / street address.');
      return;
    }
    if (!BLUEPRINT_PATTERNS.pincode.test(pincode.trim())) {
      setErrorMsg('Dehradun pincode must be exactly 6 digits (e.g. 248001).');
      return;
    }

    setSavingAddr(true);
    try {
      const newId = await saveAddress(firebaseUser.uid, {
        label: addrLabel.trim() || 'Home',
        recipientName: recipientName.trim(),
        phone: phone.trim(),
        line1: line1.trim(),
        landmark: landmark.trim(),
        locality,
        city: 'Dehradun',
        pincode: pincode.trim(),
        isDefault: userAddresses.length === 0,
      });
      setSelectedAddressId(newId);
      setShowNewAddress(false);
      setLine1('');
      setLandmark('');
      showToast('Delivery address saved.', 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not save address.');
    } finally {
      setSavingAddr(false);
    }
  };

  const handlePlaceOrder = async () => {
    setErrorMsg('');
    if (!firebaseUser || !profile) {
      onOpenAuth();
      return;
    }
    if (!firebaseUser.emailVerified) {
      setErrorMsg('Please verify your email address before placing an order. Check your inbox or click Resend Verification.');
      return;
    }
    if (items.length === 0) {
      setErrorMsg('Your basket is empty.');
      return;
    }
    if (!summary.meetsMinOrder) {
      setErrorMsg(`Minimum order value is ${formatINR(settings.minOrderAmount)}.`);
      return;
    }
    if (stockErrors.length > 0) {
      setErrorMsg(
        `Insufficient stock for ${stockErrors.map((e) => `${e.productName} (${e.available} left)`).join(', ')}.`
      );
      return;
    }
    if (!effectiveAddress) {
      setErrorMsg('Please select or add a Dehradun delivery address.');
      setShowNewAddress(true);
      return;
    }

    setSubmitting(true);
    try {
      const created = await placeCodOrderTransaction({
        user: profile,
        address: effectiveAddress,
        items,
        subtotal: summary.subtotal,
        discountAmount: summary.discountAmount,
        deliveryFee: summary.deliveryFee,
        totalAmount: summary.totalAmount,
        coupon: summary.discountAmount > 0 ? activeCoupon : null,
        notes: orderNotes,
        idempotencyKey,
      });
      clearCart();
      setConfirmedOrder(created);
      showToast(`Order ${created.orderNumber} placed successfully!`, 'success');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not place order. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-2xl px-4 sm:px-6 py-12">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
            Order Confirmed
          </h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Order{' '}
            <strong className="font-mono-num text-[var(--text-primary)]">
              {confirmedOrder.orderNumber}
            </strong>{' '}
            has been received by FinEase Dehradun. Keep{' '}
            <strong className="font-mono-num text-[var(--text-primary)]">
              {formatINR(confirmedOrder.totalAmount)}
            </strong>{' '}
            ready for Cash on Delivery.
          </p>

          <div className="mt-6 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] p-4 text-left text-xs space-y-1.5">
            <p className="font-semibold text-[var(--text-primary)]">Delivering to:</p>
            <p className="text-[var(--text-secondary)]">
              {confirmedOrder.deliveryAddress.recipientName} · {confirmedOrder.deliveryAddress.phone}
            </p>
            <p className="text-[var(--text-secondary)]">
              {confirmedOrder.deliveryAddress.line1}, {confirmedOrder.deliveryAddress.locality},{' '}
              {confirmedOrder.deliveryAddress.city} - {confirmedOrder.deliveryAddress.pincode}
            </p>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
            <button
              type="button"
              onClick={() => onOrderComplete(confirmedOrder)}
              className="rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              Track Live Order Status
            </button>
            <button
              type="button"
              onClick={onBackToShop}
              className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-5 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
            >
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-8">
      <button
        type="button"
        onClick={onBackToShop}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Catalog
      </button>

      <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)] mb-6">
        Checkout
      </h1>

      {!firebaseUser ? (
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center max-w-lg mx-auto">
          <h2 className="font-display text-lg font-semibold text-[var(--text-primary)]">
            Sign in to complete your order
          </h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Sign in with Google or Email to save your Dehradun delivery address and track live order
            updates. Your basket items are safely preserved.
          </p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="mt-5 rounded-lg bg-[var(--brand-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Sign In / Create Account
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Address & Payment */}
          <div className="lg:col-span-7 space-y-6">
            {!firebaseUser.emailVerified && (
              <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--status-warning-bg)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs text-[var(--status-warning-text)]">
                  <strong>Email verification required:</strong> Please verify {firebaseUser.email} to
                  submit orders securely.
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await resendVerificationEmail();
                    showToast('Verification email resent.', 'info');
                  }}
                  className="rounded-lg bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] border border-[var(--border-hairline)] whitespace-nowrap shrink-0"
                >
                  Resend Email
                </button>
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="rounded-lg bg-[var(--status-danger-bg)] px-4 py-3 text-sm text-[var(--status-danger-text)] flex items-start gap-2.5"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Delivery Address Selection */}
            <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--brand-primary-text)]" />
                  <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                    1. Dehradun Delivery Address
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewAddress((v) => !v)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-primary-text)] hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {showNewAddress ? 'Cancel' : 'Add Address'}
                </button>
              </div>

              {userAddresses.length > 0 && !showNewAddress && (
                <div className="space-y-3">
                  {userAddresses.map((addr) => {
                    const selected = effectiveAddress?.id === addr.id;
                    return (
                      <label
                        key={addr.id}
                        className={`block cursor-pointer rounded-lg border p-4 transition-colors ${
                          selected
                            ? 'border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]'
                            : 'border-[var(--border-hairline)] hover:border-[var(--border-strong)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="deliveryAddress"
                            checked={selected}
                            onChange={() => setSelectedAddressId(addr.id)}
                            className="mt-1 accent-[var(--brand-primary)]"
                          />
                          <div className="text-sm">
                            <p className="font-semibold text-[var(--text-primary)]">
                              {addr.label} · {addr.recipientName}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {addr.line1}
                              {addr.landmark ? `, near ${addr.landmark}` : ''}, {addr.locality},{' '}
                              {addr.city} - {addr.pincode}
                            </p>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-mono-num">
                              {addr.phone}
                            </p>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}

              {(showNewAddress || userAddresses.length === 0) && (
                <form onSubmit={handleSaveNewAddress} className="space-y-3.5 mt-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="chk-label" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Address Label
                      </label>
                      <input
                        id="chk-label"
                        type="text"
                        required
                        value={addrLabel}
                        onChange={(e) => setAddrLabel(e.target.value)}
                        placeholder="Home / Office"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="chk-name" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Recipient Name
                      </label>
                      <input
                        id="chk-name"
                        type="text"
                        required
                        value={recipientName}
                        onChange={(e) => setRecipientName(e.target.value)}
                        placeholder="Full name"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="chk-phone" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Mobile Number
                      </label>
                      <input
                        id="chk-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="9837012345"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="chk-locality" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Dehradun Locality
                      </label>
                      <select
                        id="chk-locality"
                        value={locality}
                        onChange={(e) => setLocality(e.target.value)}
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      >
                        {settings.serviceableLocalities.map((loc) => (
                          <option key={loc} value={loc}>
                            {loc}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="chk-line1" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      House / Flat No., Building & Street
                    </label>
                    <input
                      id="chk-line1"
                      type="text"
                      required
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      placeholder="14/2 Lane 3, Near Pacific Mall"
                      className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="chk-landmark" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Landmark (Optional)
                      </label>
                      <input
                        id="chk-landmark"
                        type="text"
                        value={landmark}
                        onChange={(e) => setLandmark(e.target.value)}
                        placeholder="Opposite Post Office"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
                      />
                    </div>
                    <div>
                      <label htmlFor="chk-pincode" className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                        Pincode
                      </label>
                      <input
                        id="chk-pincode"
                        type="text"
                        required
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        placeholder="248001"
                        className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={savingAddr}
                    className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-60"
                  >
                    {savingAddr ? 'Saving...' : 'Save Delivery Address'}
                  </button>
                </form>
              )}
            </section>

            {/* Payment Method (COD Only) */}
            <section className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
              <div className="flex items-center gap-2 mb-3">
                <Banknote className="h-4 w-4 text-[var(--brand-primary-text)]" />
                <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
                  2. Payment Method
                </h2>
              </div>

              <div className="rounded-lg border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] p-4 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-[var(--brand-primary-text)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">
                    Cash on Delivery (COD)
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                    Pay in cash directly to your FinEase delivery partner upon receiving your order.
                    Zero online transaction fees.
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="chk-notes"
                  className="block text-xs font-medium text-[var(--text-secondary)] mb-1"
                >
                  Delivery Instructions (Optional)
                </label>
                <textarea
                  id="chk-notes"
                  rows={2}
                  maxLength={350}
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  placeholder="Call on arrival, leave at main gate, etc."
                  className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
                />
              </div>
            </section>
          </div>

          {/* Right Column: Order Summary */}
          <aside className="lg:col-span-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sticky top-24">
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)] pb-3 border-b border-[var(--border-hairline)]">
              Order Summary ({summary.itemCount} items)
            </h2>

            <div className="divide-y divide-[var(--border-hairline)] max-h-72 overflow-y-auto my-3">
              {items.map((item) => (
                <div key={item.productId} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--text-primary)] truncate">{item.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {item.quantity} × {formatINR(getEffectivePrice(item))} · {item.unit}
                    </p>
                  </div>
                  <span className="font-mono-num font-medium text-[var(--text-primary)] shrink-0">
                    {formatINR(getEffectivePrice(item) * item.quantity)}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-[var(--border-hairline)] space-y-2 text-sm">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Item Subtotal</span>
                <span className="font-mono-num">{formatINR(summary.subtotal)}</span>
              </div>
              {summary.discountAmount > 0 && (
                <div className="flex justify-between text-[var(--status-success-text)]">
                  <span>Coupon ({couponCode})</span>
                  <span className="font-mono-num">−{formatINR(summary.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Delivery Fee</span>
                <span className="font-mono-num">
                  {summary.deliveryFee === 0 ? 'Free' : formatINR(summary.deliveryFee)}
                </span>
              </div>
              <div className="pt-2.5 border-t border-[var(--border-hairline)] flex justify-between text-base font-bold text-[var(--text-primary)]">
                <span>Total Payable (COD)</span>
                <span className="font-mono-num">{formatINR(summary.totalAmount)}</span>
              </div>
            </div>

            <button
              type="button"
              disabled={submitting || items.length === 0}
              onClick={handlePlaceOrder}
              className="mt-5 w-full rounded-lg bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50"
            >
              {submitting ? 'Placing Order...' : `Place COD Order · ${formatINR(summary.totalAmount)}`}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
