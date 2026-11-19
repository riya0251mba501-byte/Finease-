import type { CartItem, Coupon, PlatformSettings, Product } from '../types';

// Blueprint-synchronized validation patterns (verbatim from firebase-blueprint.json)
export const BLUEPRINT_PATTERNS = {
  id: /^[a-zA-Z0-9_-]{1,128}$/,
  slug: /^[a-z0-9-]{2,80}$/,
  sku: /^[A-Z0-9-]{2,48}$/,
  couponCode: /^[A-Z0-9_-]{3,32}$/,
  pincode: /^[0-9]{6}$/,
  phone: /^[0-9+\-\s]{10,20}$/,
} as const;

export function sanitizeText(value: string, maxLength: number): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function generateSafeId(prefix: string): string {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
}

export function generateOrderNumber(): string {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `FE-${num}`;
}

export function generateTicketNumber(): string {
  const num = Math.floor(10000 + Math.random() * 90000);
  return `SUP-${num}`;
}

export function getEffectivePrice(product: Pick<Product, 'price' | 'discountPrice'>): number {
  if (
    typeof product.discountPrice === 'number' &&
    product.discountPrice > 0 &&
    product.discountPrice < product.price
  ) {
    return product.discountPrice;
  }
  return product.price;
}

export function getDiscountPercent(price: number, discountPrice?: number | null): number {
  if (!discountPrice || discountPrice <= 0 || discountPrice >= price) return 0;
  return Math.round(((price - discountPrice) / price) * 100);
}

export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: safe % 1 === 0 ? 0 : 2,
  }).format(safe);
}

export interface CouponValidationResult {
  valid: boolean;
  discountAmount: number;
  reason?: string;
}

export function validateCoupon(
  coupon: Coupon | null | undefined,
  subtotal: number,
  now: Date = new Date()
): CouponValidationResult {
  if (!coupon) {
    return { valid: false, discountAmount: 0, reason: 'Coupon code not found.' };
  }
  if (!coupon.isActive) {
    return { valid: false, discountAmount: 0, reason: 'This coupon is no longer active.' };
  }
  const expiry = new Date(coupon.expiresAt);
  if (Number.isNaN(expiry.getTime()) || expiry.getTime() < now.getTime()) {
    return { valid: false, discountAmount: 0, reason: 'This coupon has expired.' };
  }
  if (coupon.usedCount >= coupon.usageLimit) {
    return { valid: false, discountAmount: 0, reason: 'Coupon usage limit has been reached.' };
  }
  if (subtotal < coupon.minOrderValue) {
    return {
      valid: false,
      discountAmount: 0,
      reason: `Minimum order of ${formatINR(coupon.minOrderValue)} required.`,
    };
  }

  let discount = 0;
  if (coupon.discountType === 'fixed') {
    discount = coupon.discountValue;
  } else {
    discount = Math.round((subtotal * coupon.discountValue) / 100);
    if (coupon.maxDiscount && coupon.maxDiscount > 0) {
      discount = Math.min(discount, coupon.maxDiscount);
    }
  }

  discount = Math.max(0, Math.min(discount, subtotal));
  return { valid: true, discountAmount: discount };
}

export interface CartSummary {
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  freeDeliveryRemaining: number;
  meetsMinOrder: boolean;
}

export function calculateCartSummary(
  items: CartItem[],
  settings: Pick<PlatformSettings, 'deliveryFee' | 'freeDeliveryThreshold' | 'minOrderAmount'>,
  coupon?: Coupon | null,
  now: Date = new Date()
): CartSummary {
  const itemCount = items.reduce((sum, item) => sum + Math.max(0, item.quantity), 0);
  const subtotal = items.reduce((sum, item) => {
    const unitPrice = getEffectivePrice(item);
    return sum + unitPrice * Math.max(0, item.quantity);
  }, 0);

  const couponResult = coupon ? validateCoupon(coupon, subtotal, now) : { valid: false, discountAmount: 0 };
  const discountAmount = couponResult.valid ? couponResult.discountAmount : 0;
  const discountedSubtotal = Math.max(0, subtotal - discountAmount);

  const deliveryFee =
    subtotal === 0
      ? 0
      : discountedSubtotal >= settings.freeDeliveryThreshold
        ? 0
        : settings.deliveryFee;

  const totalAmount = Math.max(0, subtotal - discountAmount + deliveryFee);
  const freeDeliveryRemaining =
    subtotal === 0
      ? settings.freeDeliveryThreshold
      : Math.max(0, settings.freeDeliveryThreshold - discountedSubtotal);

  return {
    itemCount,
    subtotal,
    discountAmount,
    deliveryFee,
    totalAmount,
    freeDeliveryRemaining,
    meetsMinOrder: subtotal >= settings.minOrderAmount,
  };
}

export interface StockValidationError {
  productId: string;
  productName: string;
  requested: number;
  available: number;
}

export function validateCartStock(
  items: CartItem[],
  products: Product[]
): StockValidationError[] {
  const productMap = new Map(products.map((p) => [p.id, p]));
  const errors: StockValidationError[] = [];

  for (const item of items) {
    const product = productMap.get(item.productId);
    if (!product || !product.isActive) {
      errors.push({
        productId: item.productId,
        productName: item.name,
        requested: item.quantity,
        available: 0,
      });
      continue;
    }
    if (item.quantity <= 0 || !Number.isInteger(item.quantity) || item.quantity > product.stock) {
      errors.push({
        productId: item.productId,
        productName: product.name,
        requested: item.quantity,
        available: product.stock,
      });
    }
  }
  return errors;
}

export function buildCsvContent(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (cell: string | number | boolean | null | undefined): string => {
    const str = cell === null || cell === undefined ? '' : String(cell);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}

export function triggerCsvDownload(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const csv = buildCsvContent(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
