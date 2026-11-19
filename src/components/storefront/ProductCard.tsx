import { Minus, Plus } from 'lucide-react';
import { ProductImage } from '../ui/ProductImage';
import { useCart } from '../../contexts/CartContext';
import { formatINR, getDiscountPercent, getEffectivePrice } from '../../utils/commerce';
import type { Product } from '../../types';

interface ProductCardProps {
  product: Product;
  onInspect: (product: Product) => void;
}

export function ProductCard({ product, onInspect }: ProductCardProps) {
  const { addToCart, updateQuantity, getItemQuantity } = useCart();
  const qtyInCart = getItemQuantity(product.id);
  const effectivePrice = getEffectivePrice(product);
  const discountPct = getDiscountPercent(product.price, product.discountPrice);
  const outOfStock = !product.isActive || product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= product.minStockThreshold;

  return (
    <article className="group flex flex-col rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden transition-transform duration-150 hover:-translate-y-0.5">
      <button
        type="button"
        onClick={() => onInspect(product)}
        aria-label={`View details for ${product.name}`}
        className="w-full text-left focus-visible:outline-none"
      >
        <ProductImage
          src={product.imageUrl}
          alt={product.name}
          aspectClass="aspect-[4/3]"
          className="w-full"
        />
      </button>

      <div className="flex flex-1 flex-col p-4">
        {/* Quiet unboxed metadata line */}
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <span className="truncate">{product.categoryName}</span>
          <span aria-hidden="true">·</span>
          <span className="whitespace-nowrap">{product.unit}</span>
          {discountPct > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[var(--brand-primary-text)] whitespace-nowrap">
                Save {discountPct}%
              </span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => onInspect(product)}
          className="mt-1.5 text-left font-display text-[15px] font-semibold text-[var(--text-primary)] leading-snug line-clamp-2 hover:text-[var(--brand-primary-text)]"
        >
          {product.name}
        </button>

        <div className="mt-1 text-xs">
          {outOfStock ? (
            <span className="text-[var(--status-danger-text)] font-medium">Out of stock</span>
          ) : lowStock ? (
            <span className="text-[var(--status-warning-text)] font-medium">
              Only {product.stock} left
            </span>
          ) : (
            <span className="text-[var(--text-muted)]">In stock</span>
          )}
        </div>

        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-1.5">
            <span className="font-mono-num text-base font-semibold text-[var(--text-primary)]">
              {formatINR(effectivePrice)}
            </span>
            {discountPct > 0 && (
              <span className="font-mono-num text-xs text-[var(--text-muted)] line-through">
                {formatINR(product.price)}
              </span>
            )}
          </div>

          {outOfStock ? (
            <button
              type="button"
              disabled
              className="rounded-lg border border-[var(--border-hairline)] px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] cursor-not-allowed whitespace-nowrap shrink-0"
            >
              Unavailable
            </button>
          ) : qtyInCart > 0 ? (
            <div className="inline-flex items-center rounded-lg border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)]">
              <button
                type="button"
                onClick={() => updateQuantity(product.id, qtyInCart - 1)}
                aria-label={`Decrease quantity of ${product.name}`}
                className="px-2 py-1.5 text-[var(--brand-primary-text)] hover:opacity-80"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="font-mono-num min-w-[1.5rem] text-center text-xs font-semibold text-[var(--brand-primary-text)]">
                {qtyInCart}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(product.id, qtyInCart + 1)}
                aria-label={`Increase quantity of ${product.name}`}
                className="px-2 py-1.5 text-[var(--brand-primary-text)] hover:opacity-80"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addToCart(product, 1)}
              aria-label={`Add ${product.name} to basket`}
              className="rounded-lg bg-[var(--brand-primary)] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] whitespace-nowrap shrink-0"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
