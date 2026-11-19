import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartSummary,
  validateCoupon,
  validateCartStock,
  buildCsvContent,
  BLUEPRINT_PATTERNS,
} from './commerce';
import {
  canTransitionOrder,
  canTransitionDelivery,
  canAccessWorkspace,
  getNextDeliveryStep,
} from './workflow';
import {
  getAllForecastScenarios,
  calculateActualFinancials,
} from './finance';
import type { CartItem, Coupon, Product } from '../types';

const sampleSettings = {
  deliveryFee: 29,
  freeDeliveryThreshold: 299,
  minOrderAmount: 99,
};

const sampleCart: CartItem[] = [
  {
    productId: 'prod_apples',
    name: 'Himalayan Red Apples',
    unit: '1 kg',
    sku: 'FE-FRU-001',
    price: 180,
    discountPrice: 155,
    quantity: 2,
    imageUrl: '/img/apples.jpg',
    maxStock: 20,
  },
];

const activeCoupon: Coupon = {
  id: 'cpn_welcome50',
  code: 'WELCOME50',
  discountType: 'fixed',
  discountValue: 50,
  minOrderValue: 250,
  usageLimit: 100,
  usedCount: 5,
  expiresAt: '2027-12-31T23:59:59.000Z',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

test('Cart math applies discount prices, coupon, and delivery threshold accurately', () => {
  // 2 x 155 = 310 subtotal; -50 coupon = 260 (< 299 free threshold) -> +29 delivery = 289
  const summaryWithCoupon = calculateCartSummary(
    sampleCart,
    sampleSettings,
    activeCoupon,
    new Date('2026-11-19T00:00:00.000Z')
  );
  assert.equal(summaryWithCoupon.itemCount, 2);
  assert.equal(summaryWithCoupon.subtotal, 310);
  assert.equal(summaryWithCoupon.discountAmount, 50);
  assert.equal(summaryWithCoupon.deliveryFee, 29);
  assert.equal(summaryWithCoupon.totalAmount, 289);
  assert.equal(summaryWithCoupon.meetsMinOrder, true);

  // Without coupon: 310 >= 299 -> free delivery (0)
  const summaryNoCoupon = calculateCartSummary(sampleCart, sampleSettings, null);
  assert.equal(summaryNoCoupon.deliveryFee, 0);
  assert.equal(summaryNoCoupon.totalAmount, 310);
});

test('Coupon validation rejects expired, over-limit, or under-minimum orders', () => {
  const underMin = validateCoupon(activeCoupon, 200, new Date('2026-11-19T00:00:00.000Z'));
  assert.equal(underMin.valid, false);

  const expired = validateCoupon(activeCoupon, 400, new Date('2028-01-01T00:00:00.000Z'));
  assert.equal(expired.valid, false);

  const maxed = validateCoupon(
    { ...activeCoupon, usedCount: 100 },
    400,
    new Date('2026-11-19T00:00:00.000Z')
  );
  assert.equal(maxed.valid, false);
});

test('Stock validation detects insufficient inventory and inactive products', () => {
  const products: Product[] = [
    {
      id: 'prod_apples',
      name: 'Himalayan Red Apples',
      description: 'Fresh Shimla apples',
      categoryId: 'cat_fruits',
      categoryName: 'Fruits',
      sku: 'FE-FRU-001',
      price: 180,
      discountPrice: 155,
      unit: '1 kg',
      stock: 1,
      minStockThreshold: 5,
      imageUrl: '/img/apples.jpg',
      isFeatured: true,
      isBestSeller: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ];
  const errors = validateCartStock(sampleCart, products);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].available, 1);
  assert.equal(errors[0].requested, 2);
});

test('Order lifecycle RBAC enforces strict role-gated state transitions', () => {
  // Customer can cancel while placed, cannot jump to delivered
  assert.equal(canTransitionOrder('customer', 'placed', 'cancelled'), true);
  assert.equal(canTransitionOrder('customer', 'placed', 'delivered'), false);
  assert.equal(canTransitionOrder('customer', 'out_for_delivery', 'cancelled'), false);

  // Store Manager can prepare and mark ready for pickup, cannot confirm or deliver
  assert.equal(canTransitionOrder('store_manager', 'confirmed', 'preparing'), true);
  assert.equal(canTransitionOrder('store_manager', 'preparing', 'ready_for_pickup'), true);
  assert.equal(canTransitionOrder('store_manager', 'out_for_delivery', 'delivered'), false);

  // Delivery Partner follows 5-step delivery transitions
  assert.equal(canTransitionDelivery('assigned', 'accepted'), true);
  assert.equal(canTransitionDelivery('assigned', 'delivered'), false);
  assert.equal(getNextDeliveryStep('out_for_delivery')?.nextDeliveryStatus, 'delivered');

  // Terminal orders cannot transition
  assert.equal(canTransitionOrder('owner', 'delivered', 'cancelled'), false);

  // Workspace RBAC isolation
  assert.equal(canAccessWorkspace('customer', 'admin'), false);
  assert.equal(canAccessWorkspace('store_manager', 'admin'), false);
  assert.equal(canAccessWorkspace('store_manager', 'store_manager'), true);
  assert.equal(canAccessWorkspace('delivery_partner', 'store_manager'), false);
  assert.equal(canAccessWorkspace('delivery_partner', 'delivery_partner'), true);
  assert.equal(canAccessWorkspace('owner', 'admin'), true);
});

test('Financial model computes exact Conservative, Base, and Ambitious hypothetical scenarios', () => {
  const [conservative, base, ambitious] = getAllForecastScenarios();

  // Conservative: 60 * 1.5 = 90 orders, AOV 250 -> ₹22,500 rev, ₹40 contrib -> ₹3,600 contrib - ₹15,000 fixed = -₹11,400
  assert.equal(conservative.monthlyOrders, 90);
  assert.equal(conservative.contributionPerOrder, 40);
  assert.equal(conservative.monthlyRevenue, 22500);
  assert.equal(conservative.monthlyNetProfit, -11400);
  assert.equal(conservative.breakEvenOrders, 375);

  // Base: 100 * 2 = 200 orders, AOV 300 -> ₹60,000 rev, ₹60 contrib -> ₹12,000 contrib - ₹15,000 fixed = -₹3,000
  assert.equal(base.monthlyOrders, 200);
  assert.equal(base.contributionPerOrder, 60);
  assert.equal(base.monthlyRevenue, 60000);
  assert.equal(base.monthlyNetProfit, -3000);
  assert.equal(base.breakEvenOrders, 250);

  // Ambitious: 200 * 2.5 = 500 orders, AOV 350 -> ₹175,000 rev, ₹80 contrib -> ₹40,000 contrib - ₹20,000 fixed = +₹20,000
  assert.equal(ambitious.monthlyOrders, 500);
  assert.equal(ambitious.contributionPerOrder, 80);
  assert.equal(ambitious.monthlyRevenue, 175000);
  assert.equal(ambitious.monthlyNetProfit, 20000);
  assert.equal(ambitious.breakEvenOrders, 250);

  // Empty actuals produce clean zeroes (never fabricated data)
  const emptyActuals = calculateActualFinancials([], []);
  assert.equal(emptyActuals.totalOrders, 0);
  assert.equal(emptyActuals.grossRevenue, 0);
  assert.equal(emptyActuals.averageOrderValue, 0);
});

test('Blueprint regexes and CSV builder sanitize edge cases', () => {
  assert.equal(BLUEPRINT_PATTERNS.pincode.test('248001'), true);
  assert.equal(BLUEPRINT_PATTERNS.pincode.test('24800'), false);
  assert.equal(BLUEPRINT_PATTERNS.sku.test('FE-STAP-001'), true);
  assert.equal(
    buildCsvContent(['Order', 'Note'], [['FE-1001', 'Call "Raj", gate 2']]),
    'Order,Note\nFE-1001,"Call ""Raj"", gate 2"'
  );
});
