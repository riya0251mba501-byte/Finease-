import { useState, useEffect } from 'react';
import { Minus, Plus, ShieldCheck, Truck } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ProductImage } from '../ui/ProductImage';
import { useCart } from '../../contexts/CartContext';
import { formatINR, getDiscountPercent, getEffectivePrice } from '../../utils/commerce';
import type { Product } from '../../types';

export function ProductDetailModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const { addToCart } = useCart();
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
  }, [product?.id]);

  if (!product) return null;

  const effectivePrice = getEffectivePrice(product);
  const discountPct = getDiscountPercent(product.price, product.discountPrice);
  const outOfStock = !product.isActive || product.stock <= 0;

  return (
    <Modal
      open={Boolean(product)}
      onClose={onClose}
      title={product.name}
      subtitle={`${product.categoryName} · ${product.unit} · SKU ${product.sku}`}
      maxWidthClass="max-w-2xl"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          aspectClass="aspect-[4/3]"
          className="rounded-lg border border-[var(--border-hairline)]"
        />

        <div className="flex flex-col">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono-num text-2xl font-bold text-[var(--text-primary)]">
              {formatINR(effectivePrice)}
            </span>
            {discountPct > 0 && (
              <>
                <span className="font-mono-num text-sm text-[var(--text-muted)] line-through">
                  {formatINR(product.price)}
                </span>
                <span className="text-xs font-semibold text-[var(--brand-primary-text)]">
                  {discountPct}% off
                </span>
              </>
            )}
          </div>

          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Inclusive of all taxes · Pack size: {product.unit}
          </p>

          <p className="mt-4 text-sm text-[var(--text-secondary)] leading-relaxed">
            {product.description}
          </p>

          <div className="mt-4 text-xs font-medium">
            {outOfStock ? (
              <span className="text-[var(--status-danger-text)]">Currently out of stock</span>
            ) : (
              <span className="text-[var(--status-success-text)]">
                In stock ({product.stock} available in Dehradun store)
              </span>
            )}
          </div>

          {!outOfStock && (
            <div className="mt-5 flex items-center gap-3">
              <div className="inline-flex items-center rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-l-lg"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="font-mono-num min-w-[2.5rem] text-center text-sm font-semibold text-[var(--text-primary)]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  aria-label="Increase quantity"
                  className="px-3 py-2 text-[var(--text-primary)] hover:bg-[var(--bg-surface)] rounded-r-lg"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  addToCart(product, quantity);
                  onClose();
                }}
                className="flex-1 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
              >
                Add to Basket · {formatINR(effectivePrice * quantity)}
              </button>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-[var(--border-hairline)] space-y-2 text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-[var(--brand-primary-text)] shrink-0" />
              <span>Express doorstep delivery across Dehradun localities</span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[var(--brand-primary-text)] shrink-0" />
              <span>Pay safely via Cash on Delivery after inspecting your order</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
