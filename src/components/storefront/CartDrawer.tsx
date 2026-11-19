import React, { useState } from 'react';
import { Minus, Plus, ShoppingBag, Tag, Trash2, X, ArrowRight } from 'lucide-react';
import { useCart } from '../../contexts/CartContext';
import { useStoreData } from '../../contexts/StoreDataContext';
import { useToast } from '../../contexts/ToastContext';
import {
  calculateCartSummary,
  formatINR,
  getEffectivePrice,
  validateCoupon,
} from '../../utils/commerce';

export function CartDrawer({
  onProceedToCheckout,
}: {
  onProceedToCheckout: () => void;
}) {
  const {
    items,
    couponCode,
    isDrawerOpen,
    setDrawerOpen,
    setCouponCode,
    updateQuantity,
    removeFromCart,
  } = useCart();
  const { coupons, settings } = useStoreData();
  const { showToast } = useToast();

  const [couponInput, setCouponInput] = useState(couponCode);
  const [couponError, setCouponError] = useState('');

  if (!isDrawerOpen) return null;

  const activeCoupon = couponCode
    ? coupons.find((c) => c.code.toUpperCase() === couponCode.toUpperCase())
    : null;
  const summary = calculateCartSummary(items, settings, activeCoupon);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError('');
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponCode('');
      return;
    }
    const found = coupons.find((c) => c.code.toUpperCase() === code);
    const validation = validateCoupon(found, summary.subtotal);
    if (!validation.valid) {
      setCouponError(validation.reason || 'Invalid coupon code.');
      return;
    }
    setCouponCode(code);
    showToast(`Coupon ${code} applied — saved ${formatINR(validation.discountAmount)}.`, 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[var(--bg-overlay)] backdrop-blur-[2px]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setDrawerOpen(false);
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Shopping basket"
    >
      <div className="w-full max-w-md h-full flex flex-col bg-[var(--bg-surface)] border-l border-[var(--border-hairline)] shadow-[var(--shadow-elevated)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-hairline)]">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="h-5 w-5 text-[var(--brand-primary-text)]" />
            <h2 className="font-display text-base font-semibold text-[var(--text-primary)]">
              Your Basket ({summary.itemCount})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close basket"
            className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Free Delivery Progress Notice */}
        {items.length > 0 && (
          <div className="px-5 py-2.5 bg-[var(--bg-surface-subtle)] border-b border-[var(--border-hairline)] text-xs text-[var(--text-secondary)]">
            {summary.freeDeliveryRemaining > 0 ? (
              <span>
                Add{' '}
                <strong className="font-mono-num text-[var(--text-primary)]">
                  {formatINR(summary.freeDeliveryRemaining)}
                </strong>{' '}
                more for free delivery in Dehradun.
              </span>
            ) : (
              <span className="font-medium text-[var(--status-success-text)]">
                You unlocked free delivery on this order.
              </span>
            )}
          </div>
        )}

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center py-12">
              <ShoppingBag className="h-10 w-10 text-[var(--text-muted)] opacity-50 mb-3" />
              <p className="font-display text-base font-semibold text-[var(--text-primary)]">
                Your basket is empty
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)] max-w-xs">
                Browse fresh produce, A2 milk, pantry staples, and home essentials.
              </p>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="mt-5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => {
              const unitPrice = getEffectivePrice(item);
              return (
                <div
                  key={item.productId}
                  className="flex gap-3.5 pb-4 border-b border-[var(--border-hairline)] last:border-b-0"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    referrerPolicy="no-referrer"
                    className="h-16 w-16 rounded-lg object-cover border border-[var(--border-hairline)] shrink-0 bg-[var(--bg-surface-subtle)]"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--text-primary)] leading-snug line-clamp-2">
                        {item.name}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.productId)}
                        aria-label={`Remove ${item.name} from basket`}
                        className="text-[var(--text-muted)] hover:text-[var(--status-danger-text)] p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">{item.unit}</p>
                    <div className="mt-2.5 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-md border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          aria-label={`Decrease quantity of ${item.name}`}
                          className="px-2 py-1 text-[var(--text-primary)]"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="font-mono-num min-w-[1.5rem] text-center text-xs font-semibold text-[var(--text-primary)]">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                          aria-label={`Increase quantity of ${item.name}`}
                          className="px-2 py-1 text-[var(--text-primary)]"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="font-mono-num text-sm font-semibold text-[var(--text-primary)]">
                        {formatINR(unitPrice * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Coupon + Totals */}
        {items.length > 0 && (
          <div className="border-t border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)] px-5 py-4 space-y-3.5">
            <form onSubmit={handleApplyCoupon} className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="h-3.5 w-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  placeholder="Coupon code (e.g. WELCOME50)"
                  aria-label="Coupon code"
                  className="w-full h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-8 pr-3 text-xs font-mono-num uppercase text-[var(--text-primary)] placeholder:normal-case placeholder:font-sans placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                />
              </div>
              {couponCode ? (
                <button
                  type="button"
                  onClick={() => {
                    setCouponCode('');
                    setCouponInput('');
                    setCouponError('');
                  }}
                  className="h-9 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="submit"
                  className="h-9 rounded-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                >
                  Apply
                </button>
              )}
            </form>
            {couponError && (
              <p className="text-xs text-[var(--status-danger-text)]">{couponError}</p>
            )}

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Subtotal</span>
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
              <div className="pt-2 border-t border-[var(--border-hairline)] flex justify-between text-sm font-semibold text-[var(--text-primary)]">
                <span>Total (Cash on Delivery)</span>
                <span className="font-mono-num">{formatINR(summary.totalAmount)}</span>
              </div>
            </div>

            {!summary.meetsMinOrder && (
              <p className="text-xs text-[var(--status-warning-text)]">
                Minimum order value is {formatINR(settings.minOrderAmount)}.
              </p>
            )}

            <button
              type="button"
              disabled={!summary.meetsMinOrder}
              onClick={() => {
                setDrawerOpen(false);
                onProceedToCheckout();
              }}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
