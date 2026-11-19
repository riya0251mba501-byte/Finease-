import type { Expense, Order } from '../types';

export interface ActualFinancialSummary {
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  grossRevenue: number;
  deliveredRevenue: number;
  averageOrderValue: number;
  totalExpenses: number;
  estimatedVariableCost: number;
  estimatedContribution: number;
  netOperatingPosition: number;
  grossMarginPercent: number;
}

export interface ForecastScenarioInput {
  id: 'conservative' | 'base' | 'ambitious';
  label: string;
  description: string;
  aov: number;
  variableCostPerOrder: number;
  fixedMonthlyCosts: number;
  customers: number;
  purchasesPerCustomer: number;
}

export interface ForecastScenarioResult extends ForecastScenarioInput {
  monthlyOrders: number;
  contributionPerOrder: number;
  monthlyRevenue: number;
  monthlyVariableCosts: number;
  monthlyGrossContribution: number;
  monthlyNetProfit: number;
  grossMarginPercent: number;
  breakEvenOrders: number;
  annualizedRevenue: number;
  annualizedNetProfit: number;
}

// Exact planning assumptions specified in Section 10 (Hypothetical Forecast Models)
export const FORECAST_SCENARIO_INPUTS: ForecastScenarioInput[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Initial Dehradun neighborhood launch with cautious order frequency.',
    aov: 250,
    variableCostPerOrder: 210,
    fixedMonthlyCosts: 15000,
    customers: 60,
    purchasesPerCustomer: 1.5,
  },
  {
    id: 'base',
    label: 'Base',
    description: 'Steady recurring households across core Rajpur Road & Vasant Vihar zones.',
    aov: 300,
    variableCostPerOrder: 240,
    fixedMonthlyCosts: 15000,
    customers: 100,
    purchasesPerCustomer: 2,
  },
  {
    id: 'ambitious',
    label: 'Ambitious',
    description: 'High repeat weekly basket adoption across expanded Dehradun localities.',
    aov: 350,
    variableCostPerOrder: 270,
    fixedMonthlyCosts: 20000,
    customers: 200,
    purchasesPerCustomer: 2.5,
  },
];

export function calculateForecastScenario(input: ForecastScenarioInput): ForecastScenarioResult {
  const monthlyOrders = Math.round(input.customers * input.purchasesPerCustomer);
  const contributionPerOrder = input.aov - input.variableCostPerOrder;
  const monthlyRevenue = monthlyOrders * input.aov;
  const monthlyVariableCosts = monthlyOrders * input.variableCostPerOrder;
  const monthlyGrossContribution = monthlyOrders * contributionPerOrder;
  const monthlyNetProfit = monthlyGrossContribution - input.fixedMonthlyCosts;
  const grossMarginPercent = input.aov > 0 ? Math.round((contributionPerOrder / input.aov) * 1000) / 10 : 0;
  const breakEvenOrders =
    contributionPerOrder > 0 ? Math.ceil(input.fixedMonthlyCosts / contributionPerOrder) : 0;

  return {
    ...input,
    monthlyOrders,
    contributionPerOrder,
    monthlyRevenue,
    monthlyVariableCosts,
    monthlyGrossContribution,
    monthlyNetProfit,
    grossMarginPercent,
    breakEvenOrders,
    annualizedRevenue: monthlyRevenue * 12,
    annualizedNetProfit: monthlyNetProfit * 12,
  };
}

export function getAllForecastScenarios(): ForecastScenarioResult[] {
  return FORECAST_SCENARIO_INPUTS.map(calculateForecastScenario);
}

/**
 * Computes real operational financials strictly from actual Firestore orders and expenses.
 * Never fabricates transactions when orders/expenses are empty.
 */
export function calculateActualFinancials(
  orders: Order[],
  expenses: Expense[],
  variableCostRatio = 0.8
): ActualFinancialSummary {
  const totalOrders = orders.length;
  const deliveredOrdersList = orders.filter((o) => o.status === 'delivered');
  const cancelledOrders = orders.filter((o) => o.status === 'cancelled').length;
  const activeOrders = orders.filter((o) => o.status !== 'cancelled');
  const pendingOrders = activeOrders.filter((o) => o.status !== 'delivered').length;

  const grossRevenue = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const deliveredRevenue = deliveredOrdersList.reduce((sum, o) => sum + o.totalAmount, 0);
  const averageOrderValue = activeOrders.length > 0 ? Math.round(grossRevenue / activeOrders.length) : 0;
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  const estimatedVariableCost = Math.round(deliveredRevenue * variableCostRatio);
  const estimatedContribution = deliveredRevenue - estimatedVariableCost;
  const netOperatingPosition = deliveredRevenue - totalExpenses;
  const grossMarginPercent =
    deliveredRevenue > 0 ? Math.round((estimatedContribution / deliveredRevenue) * 1000) / 10 : 0;

  return {
    totalOrders,
    deliveredOrders: deliveredOrdersList.length,
    pendingOrders,
    cancelledOrders,
    grossRevenue,
    deliveredRevenue,
    averageOrderValue,
    totalExpenses,
    estimatedVariableCost,
    estimatedContribution,
    netOperatingPosition,
    grossMarginPercent,
  };
}

export interface MonthlyTrendPoint {
  month: string;
  revenue: number;
  orders: number;
  expenses: number;
}

export function buildActualMonthlyTrend(orders: Order[], expenses: Expense[]): MonthlyTrendPoint[] {
  const buckets = new Map<string, MonthlyTrendPoint>();

  const toMonthKey = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Unknown';
    return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  };

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const key = toMonthKey(order.createdAt);
    const entry = buckets.get(key) ?? { month: key, revenue: 0, orders: 0, expenses: 0 };
    entry.revenue += order.totalAmount;
    entry.orders += 1;
    buckets.set(key, entry);
  }

  for (const exp of expenses) {
    const key = toMonthKey(exp.expenseDate || exp.createdAt);
    const entry = buckets.get(key) ?? { month: key, revenue: 0, orders: 0, expenses: 0 };
    entry.expenses += exp.amount;
    buckets.set(key, entry);
  }

  return Array.from(buckets.values());
}
