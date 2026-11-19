import { useEffect, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Boxes,
  Building2,
  ClipboardList,
  FileBarChart,
  FolderTree,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  ShoppingBag,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useStoreData } from '../../contexts/StoreDataContext';
import { useToast } from '../../contexts/ToastContext';
import { FinEaseLogo } from '../ui/FinEaseLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import {
  seedStarterCatalogToFirestore,
  subscribeAllOrders,
  subscribeAllTickets,
  subscribeAllUsers,
  subscribeAuditLogs,
  subscribeDeliveryAssignments,
  subscribeDeliveryPartners,
  subscribeExpenses,
  subscribeInventoryLogs,
  subscribeSuppliers,
} from '../../lib/firestoreService';
import {
  AdminExpensesPanel,
  AdminFinancePanel,
  AdminOverviewPanel,
} from './AdminOverviewFinance';
import {
  AdminCategoriesPanel,
  AdminInventoryPanel,
  AdminProductsPanel,
  AdminSuppliersPanel,
} from './AdminCatalogModules';
import {
  AdminCustomersPanel,
  AdminDeliveryAssignmentsPanel,
  AdminDeliveryPartnersPanel,
  AdminOrdersPanel,
} from './AdminOrdersDeliveryModules';
import {
  AdminAuditLogsPanel,
  AdminCouponsPanel,
  AdminReportsPanel,
  AdminSettingsPanel,
  AdminSupportPanel,
} from './AdminBusinessModules';
import type {
  AuditLog,
  DeliveryAssignment,
  DeliveryPartner,
  Expense,
  InventoryLog,
  Order,
  Supplier,
  SupportTicket,
  UserProfile,
} from '../../types';

type AdminModule =
  | 'overview'
  | 'orders'
  | 'products'
  | 'categories'
  | 'customers'
  | 'inventory'
  | 'suppliers'
  | 'delivery_partners'
  | 'delivery_assignments'
  | 'finance'
  | 'expenses'
  | 'coupons'
  | 'support'
  | 'reports'
  | 'audit_logs'
  | 'settings';

const NAV_ITEMS: { id: AdminModule; label: string; Icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', Icon: ShoppingBag },
  { id: 'products', label: 'Products', Icon: Package },
  { id: 'categories', label: 'Categories', Icon: FolderTree },
  { id: 'customers', label: 'Customers', Icon: Users },
  { id: 'inventory', label: 'Inventory', Icon: Boxes },
  { id: 'suppliers', label: 'Suppliers', Icon: Building2 },
  { id: 'delivery_partners', label: 'Delivery Partners', Icon: Truck },
  { id: 'delivery_assignments', label: 'Assignments', Icon: ClipboardList },
  { id: 'finance', label: 'Finance', Icon: BarChart3 },
  { id: 'expenses', label: 'Expenses', Icon: Receipt },
  { id: 'coupons', label: 'Coupons', Icon: Tag },
  { id: 'support', label: 'Support', Icon: MessageSquare },
  { id: 'reports', label: 'Reports', Icon: FileBarChart },
  { id: 'audit_logs', label: 'Activity Logs', Icon: Activity },
  { id: 'settings', label: 'Settings', Icon: Settings },
];

export function AdminDashboard({ onExit }: { onExit: () => void }) {
  const { profile } = useAuth();
  const { categories, products, coupons, settings, isCatalogSeededInFirestore } = useStoreData();
  const { showToast } = useToast();

  const [activeModule, setActiveModule] = useState<AdminModule>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [partners, setPartners] = useState<DeliveryPartner[]>([]);
  const [assignments, setAssignments] = useState<DeliveryAssignment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const unsubs = [
      subscribeAllOrders(setOrders),
      subscribeAllUsers(setUsers),
      subscribeInventoryLogs(setInventoryLogs),
      subscribeSuppliers(setSuppliers),
      subscribeDeliveryPartners(setPartners),
      subscribeDeliveryAssignments(setAssignments),
      subscribeExpenses(setExpenses),
      subscribeAllTickets(setTickets),
      subscribeAuditLogs(setAuditLogs),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  if (!profile) return null;

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await seedStarterCatalogToFirestore({
        uid: profile.uid,
        displayName: profile.displayName,
        role: profile.role,
      });
      showToast(
        `Seeded ${res.categories} categories, ${res.products} products, and ${res.coupons} coupons to Firestore.`,
        'success'
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Seeding failed.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  const activeNavMeta = NAV_ITEMS.find((i) => i.id === activeModule) || NAV_ITEMS[0];

  const renderSidebarLinks = (collapsed: boolean) => (
    <nav aria-label="Admin navigation" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
      {NAV_ITEMS.map(({ id, label, Icon }) => {
        const active = activeModule === id;
        return (
          <button
            key={id}
            type="button"
            title={collapsed ? label : undefined}
            onClick={() => {
              setActiveModule(id);
              setMobileNavOpen(false);
            }}
            className={`w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen flex bg-[var(--bg-canvas)]">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col border-r border-[var(--border-hairline)] bg-[var(--bg-sidebar)] shrink-0 transition-[width] duration-150 ${
          sidebarCollapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--border-hairline)]">
          <FinEaseLogo size="sm" showWordmark={!sidebarCollapsed} />
          <button
            type="button"
            onClick={() => setSidebarCollapsed((c) => !c)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-surface-subtle)] hover:text-[var(--text-primary)]"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {renderSidebarLinks(sidebarCollapsed)}

        <div className="p-3 border-t border-[var(--border-hairline)]">
          <button
            type="button"
            onClick={onExit}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          >
            <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
            {!sidebarCollapsed && <span>Storefront</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden flex bg-[var(--bg-overlay)]"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setMobileNavOpen(false);
          }}
        >
          <div className="w-64 h-full flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border-hairline)]">
            <div className="h-16 px-4 flex items-center justify-between border-b border-[var(--border-hairline)]">
              <FinEaseLogo size="sm" />
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close sidebar"
                className="p-1.5 text-[var(--text-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {renderSidebarLinks(false)}
          </div>
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-30 h-16 px-4 sm:px-6 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open admin menu"
              className="lg:hidden p-1.5 rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="truncate">
              <p className="text-[11px] text-[var(--text-muted)]">FinEase Owner Console</p>
              <h1 className="font-display text-base font-bold text-[var(--text-primary)] truncate">
                {activeNavMeta.label}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <ThemeSwitcher compact />
            <button
              type="button"
              onClick={onExit}
              className="lg:hidden inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Shop
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1400px] w-full mx-auto">
          {activeModule === 'overview' && (
            <AdminOverviewPanel
              orders={orders}
              products={products}
              users={users}
              expenses={expenses}
              isCatalogSeeded={isCatalogSeededInFirestore}
              seeding={seeding}
              onSeedCatalog={handleSeed}
            />
          )}
          {activeModule === 'orders' && (
            <AdminOrdersPanel orders={orders} partners={partners} actor={profile} />
          )}
          {activeModule === 'products' && (
            <AdminProductsPanel products={products} categories={categories} actor={profile} />
          )}
          {activeModule === 'categories' && (
            <AdminCategoriesPanel categories={categories} actor={profile} />
          )}
          {activeModule === 'customers' && (
            <AdminCustomersPanel users={users} orders={orders} />
          )}
          {activeModule === 'inventory' && (
            <AdminInventoryPanel
              products={products}
              inventoryLogs={inventoryLogs}
              actor={profile}
            />
          )}
          {activeModule === 'suppliers' && (
            <AdminSuppliersPanel suppliers={suppliers} actor={profile} />
          )}
          {activeModule === 'delivery_partners' && (
            <AdminDeliveryPartnersPanel partners={partners} orders={orders} actor={profile} />
          )}
          {activeModule === 'delivery_assignments' && (
            <AdminDeliveryAssignmentsPanel
              orders={orders}
              partners={partners}
              assignments={assignments}
              actor={profile}
            />
          )}
          {activeModule === 'finance' && (
            <AdminFinancePanel orders={orders} expenses={expenses} />
          )}
          {activeModule === 'expenses' && (
            <AdminExpensesPanel expenses={expenses} actor={profile} />
          )}
          {activeModule === 'coupons' && (
            <AdminCouponsPanel coupons={coupons} actor={profile} />
          )}
          {activeModule === 'support' && (
            <AdminSupportPanel tickets={tickets} actor={profile} />
          )}
          {activeModule === 'reports' && (
            <AdminReportsPanel
              orders={orders}
              products={products}
              users={users}
              expenses={expenses}
              assignments={assignments}
            />
          )}
          {activeModule === 'audit_logs' && <AdminAuditLogsPanel logs={auditLogs} />}
          {activeModule === 'settings' && (
            <AdminSettingsPanel settings={settings} users={users} actor={profile} />
          )}
        </main>
      </div>
    </div>
  );
}
