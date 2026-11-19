import React, { useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Database, Plus, Trash2, AlertTriangle, TrendingUp } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { formatINR } from '../../utils/commerce';
import {
  buildActualMonthlyTrend,
  calculateActualFinancials,
  getAllForecastScenarios,
} from '../../utils/finance';
import { createExpense, deleteExpense } from '../../lib/firestoreService';
import { useToast } from '../../contexts/ToastContext';
import type {
  Expense,
  ExpenseCategory,
  Order,
  Product,
  UserProfile,
} from '../../types';

export function AdminOverviewPanel({
  orders,
  products,
  users,
  expenses,
  isCatalogSeeded,
  seeding,
  onSeedCatalog,
}: {
  orders: Order[];
  products: Product[];
  users: UserProfile[];
  expenses: Expense[];
  isCatalogSeeded: boolean;
  seeding: boolean;
  onSeedCatalog: () => void;
}) {
  const actuals = calculateActualFinancials(orders, expenses);
  const lowStockProducts = products.filter((p) => p.stock <= p.minStockThreshold);
  const monthlyTrend = buildActualMonthlyTrend(orders, expenses);

  // Actual category performance from real order line items
  const categoryRevenueMap = new Map<string, number>();
  const productCategoryLookup = new Map(products.map((p) => [p.id, p.categoryName]));
  for (const ord of orders) {
    if (ord.status === 'cancelled') continue;
    for (const item of ord.items) {
      const cat = productCategoryLookup.get(item.productId) || 'Other';
      categoryRevenueMap.set(cat, (categoryRevenueMap.get(cat) || 0) + item.lineTotal);
    }
  }
  const categoryPerformance = Array.from(categoryRevenueMap.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const activeCustomers = users.filter((u) => u.role === 'customer').length;

  return (
    <div className="space-y-6">
      {!isCatalogSeeded && (
        <div className="rounded-xl border border-[var(--brand-primary)] bg-[var(--brand-primary-soft)] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
              Initialize Dehradun Starter Catalog in Firestore
            </h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">
              Your Firestore database is connected and ready. Seed the 10 grocery categories, 13
              products, starter coupons, suppliers, and Dehradun store settings into Cloud Firestore.
            </p>
          </div>
          <button
            type="button"
            disabled={seeding}
            onClick={onSeedCatalog}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)] whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <Database className="h-4 w-4" />
            {seeding ? 'Seeding Firestore...' : 'Seed Starter Catalog'}
          </button>
        </div>
      )}

      {/* Primary KPI Grid — 100% Live Database Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">Total Revenue (Actual)</p>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
            {formatINR(actuals.grossRevenue)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Delivered: <span className="font-mono-num">{formatINR(actuals.deliveredRevenue)}</span>
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">Total Orders</p>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
            {actuals.totalOrders}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            {actuals.pendingOrders} active · {actuals.deliveredOrders} delivered · {actuals.cancelledOrders} cancelled
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">Average Order Value</p>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[var(--text-primary)]">
            {formatINR(actuals.averageOrderValue)}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Registered customers: <span className="font-mono-num">{activeCustomers}</span>
          </p>
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <p className="text-xs text-[var(--text-muted)]">Low-Stock Alerts</p>
          <p className="mt-1.5 font-mono-num text-2xl font-bold text-[var(--status-warning-text)]">
            {lowStockProducts.length}
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Out of <span className="font-mono-num">{products.length}</span> active SKUs
          </p>
        </div>
      </div>

      {/* Charts Row — Strictly Actual Firestore Data */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Actual Revenue & Order Trends
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Derived strictly from live Firestore orders and recorded expenses.
          </p>
          {monthlyTrend.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No transaction history yet"
              description="Revenue and order trend lines will populate automatically once customers place orders in Dehradun."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="month" stroke="var(--chart-axis)" fontSize={12} />
                  <YAxis stroke="var(--chart-axis)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="var(--chart-primary)" strokeWidth={2} />
                  <Line type="monotone" dataKey="expenses" name="Expenses (₹)" stroke="var(--chart-danger)" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)]">
            Category Performance (Actual)
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Sales revenue grouped by grocery category.
          </p>
          {categoryPerformance.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No category sales recorded"
              description="Category sales bars appear once orders are created."
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryPerformance}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="category" stroke="var(--chart-axis)" fontSize={11} />
                  <YAxis stroke="var(--chart-axis)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-surface-elevated)',
                      borderColor: 'var(--border-hairline)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="revenue" name="Sales (₹)" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Low Stock Inventory Alerts */}
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[var(--status-warning-text)]" />
          Inventory Alerts
        </h3>
        {lowStockProducts.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)]">
            All catalog SKUs are currently above their minimum stock threshold.
          </p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)]">
            {lowStockProducts.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <span className="font-medium text-[var(--text-primary)]">{p.name}</span>
                  <span className="text-[var(--text-muted)]"> · {p.sku}</span>
                </div>
                <span className="font-mono-num font-semibold text-[var(--status-warning-text)]">
                  {p.stock} left (min {p.minStockThreshold})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminFinancePanel({
  orders,
  expenses,
}: {
  orders: Order[];
  expenses: Expense[];
}) {
  const actuals = calculateActualFinancials(orders, expenses);
  const scenarios = getAllForecastScenarios();

  const forecastChartData = scenarios.map((s) => ({
    scenario: s.label,
    Revenue: s.monthlyRevenue,
    Contribution: s.monthlyGrossContribution,
    FixedCosts: s.fixedMonthlyCosts,
    NetProfit: s.monthlyNetProfit,
  }));

  return (
    <div className="space-y-8">
      {/* SECTION A: ACTUAL OPERATIONAL DATA */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
            Actual Business Performance (Live Firestore Data)
          </h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Calculated exclusively from real orders and recorded expenses in your database.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs text-[var(--text-muted)]">Delivered Revenue</p>
            <p className="mt-1 font-mono-num text-xl font-bold text-[var(--text-primary)]">
              {formatINR(actuals.deliveredRevenue)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs text-[var(--text-muted)]">Recorded Expenses</p>
            <p className="mt-1 font-mono-num text-xl font-bold text-[var(--status-danger-text)]">
              {formatINR(actuals.totalExpenses)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs text-[var(--text-muted)]">Est. Gross Contribution (20%)</p>
            <p className="mt-1 font-mono-num text-xl font-bold text-[var(--text-primary)]">
              {formatINR(actuals.estimatedContribution)}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
            <p className="text-xs text-[var(--text-muted)]">Net Operating Cash Position</p>
            <p
              className={`mt-1 font-mono-num text-xl font-bold ${
                actuals.netOperatingPosition >= 0
                  ? 'text-[var(--status-success-text)]'
                  : 'text-[var(--status-danger-text)]'
              }`}
            >
              {formatINR(actuals.netOperatingPosition)}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION B: HYPOTHETICAL FORECAST SCENARIOS */}
      <section className="space-y-4 pt-6 border-t border-[var(--border-hairline)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-[var(--text-primary)]">
              Hypothetical Monthly Forecast Scenarios (Planning Assumptions)
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              These figures are hypothetical unit-economics models for Dehradun launch planning — NOT
              actual transactions or realized revenue.
            </p>
          </div>
          <span className="text-xs font-semibold text-[var(--status-info-text)]">
            Hypothetical Model · Not Actual Revenue
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {scenarios.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3"
            >
              <div>
                <h3 className="font-display text-base font-bold text-[var(--text-primary)]">
                  {s.label} Scenario
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">{s.description}</p>
              </div>

              <div className="divide-y divide-[var(--border-hairline)] text-xs">
                <div className="py-1.5 flex justify-between">
                  <span className="text-[var(--text-muted)]">Customers × Frequency</span>
                  <span className="font-mono-num text-[var(--text-primary)]">
                    {s.customers} × {s.purchasesPerCustomer} = {s.monthlyOrders} orders/mo
                  </span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[var(--text-muted)]">AOV / Variable Cost</span>
                  <span className="font-mono-num text-[var(--text-primary)]">
                    {formatINR(s.aov)} / {formatINR(s.variableCostPerOrder)}
                  </span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[var(--text-muted)]">Contribution / Order</span>
                  <span className="font-mono-num font-semibold text-[var(--brand-primary-text)]">
                    {formatINR(s.contributionPerOrder)} ({s.grossMarginPercent}%)
                  </span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[var(--text-muted)]">Projected Monthly Revenue</span>
                  <span className="font-mono-num font-semibold text-[var(--text-primary)]">
                    {formatINR(s.monthlyRevenue)}
                  </span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[var(--text-muted)]">Fixed Monthly Costs</span>
                  <span className="font-mono-num text-[var(--text-primary)]">
                    {formatINR(s.fixedMonthlyCosts)}
                  </span>
                </div>
                <div className="py-1.5 flex justify-between">
                  <span className="text-[var(--text-muted)]">Break-Even Volume</span>
                  <span className="font-mono-num text-[var(--text-primary)]">
                    {s.breakEvenOrders} orders/mo
                  </span>
                </div>
                <div className="pt-2 flex justify-between text-sm font-bold">
                  <span className="text-[var(--text-primary)]">Projected Monthly Net</span>
                  <span
                    className={`font-mono-num ${
                      s.monthlyNetProfit >= 0
                        ? 'text-[var(--status-success-text)]'
                        : 'text-[var(--status-danger-text)]'
                    }`}
                  >
                    {formatINR(s.monthlyNetProfit)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
          <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-1">
            Hypothetical Scenario Comparison (Monthly ₹)
          </h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">
            Projected revenue, gross contribution, fixed costs, and net operating profit by scenario.
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="scenario" stroke="var(--chart-axis)" fontSize={12} />
                <YAxis stroke="var(--chart-axis)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderColor: 'var(--border-hairline)',
                    color: 'var(--text-primary)',
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Revenue" name="Projected Revenue (₹)" fill="var(--chart-primary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Contribution" name="Gross Contribution (₹)" fill="var(--chart-secondary)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="FixedCosts" name="Fixed Costs (₹)" fill="var(--chart-accent)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="NetProfit" name="Projected Net Profit (₹)" fill="var(--chart-danger)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AdminExpensesPanel({
  expenses,
  actor,
}: {
  expenses: Expense[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('inventory_procurement');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || Number(amount) <= 0) {
      showToast('Enter a valid expense title and positive amount.', 'error');
      return;
    }
    setSaving(true);
    try {
      await createExpense(
        {
          title: title.trim(),
          category,
          amount: Number(amount),
          expenseDate,
          notes: notes.trim(),
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role }
      );
      setTitle('');
      setAmount('');
      setNotes('');
      showToast('Expense recorded.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save expense.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-4"
      >
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Record Operational Expense
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Expense description"
            className="sm:col-span-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="inventory_procurement">Inventory Procurement</option>
            <option value="delivery_payout">Delivery Payout</option>
            <option value="store_rent">Store Rent</option>
            <option value="utilities">Utilities</option>
            <option value="packaging">Packaging</option>
            <option value="marketing">Marketing</option>
            <option value="staff_salary">Staff Salary</option>
            <option value="other">Other</option>
          </select>
          <input
            type="number"
            min={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Amount (₹)"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
          <input
            type="date"
            value={expenseDate}
            onChange={(e) => setExpenseDate(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional invoice / vendor note"
            className="sm:col-span-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            <Plus className="h-3.5 w-3.5" />
            {saving ? 'Saving...' : 'Add Expense'}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
        <div className="px-5 py-3.5 border-b border-[var(--border-hairline)] flex justify-between items-center text-sm">
          <span className="font-semibold text-[var(--text-primary)]">
            Expense Ledger ({expenses.length})
          </span>
          <span className="font-mono-num font-bold text-[var(--status-danger-text)]">
            Total: {formatINR(total)}
          </span>
        </div>
        {expenses.length === 0 ? (
          <p className="p-6 text-xs text-[var(--text-muted)] text-center">
            No expenses recorded yet.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-hairline)]">
              {expenses.map((exp) => (
                <tr key={exp.id}>
                  <td className="px-4 py-3 font-mono-num text-xs text-[var(--text-muted)]">
                    {exp.expenseDate}
                  </td>
                  <td className="px-4 py-3 font-medium text-[var(--text-primary)]">
                    {exp.title}
                    {exp.notes && (
                      <span className="block text-xs text-[var(--text-muted)]">{exp.notes}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-[var(--text-secondary)] capitalize">
                    {exp.category.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3 font-mono-num text-right font-semibold text-[var(--text-primary)]">
                    {formatINR(exp.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={async () => {
                        await deleteExpense(exp.id);
                        showToast('Expense removed.', 'info');
                      }}
                      aria-label={`Delete expense ${exp.title}`}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger-text)]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
