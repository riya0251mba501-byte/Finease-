import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShieldAlert, Lock, ArrowLeft } from 'lucide-react';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ToastProvider, useToast } from './contexts/ToastContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CartProvider, useCart } from './contexts/CartContext';
import { StoreDataProvider } from './contexts/StoreDataContext';
import { Navbar } from './components/storefront/Navbar';
import { HomePage } from './components/storefront/HomePage';
import { ShopPage } from './components/storefront/ShopPage';
import { CartDrawer } from './components/storefront/CartDrawer';
import { ProductDetailModal } from './components/storefront/ProductDetailModal';
import { CheckoutView } from './components/storefront/CheckoutView';
import { CustomerDashboard } from './components/storefront/CustomerDashboard';
import { AuthModal } from './components/auth/AuthModal';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { StoreManagerDashboard } from './components/operations/StoreManagerDashboard';
import { DeliveryPartnerDashboard } from './components/operations/DeliveryPartnerDashboard';
import { canAccessWorkspace } from './utils/workflow';
import type { AppView, Product, ThemeMode } from './types';

function ThemeProfileSyncBridge({
  persistThemeRef,
}: {
  persistThemeRef: React.MutableRefObject<((mode: ThemeMode) => void) | null>;
}) {
  const { firebaseUser, updateUserProfile } = useAuth();

  useEffect(() => {
    persistThemeRef.current = (mode: ThemeMode) => {
      if (!firebaseUser) return;
      updateUserProfile({ themePreference: mode }).catch(() => {
        // Non-blocking: local preference remains saved
      });
    };
    return () => {
      persistThemeRef.current = null;
    };
  }, [firebaseUser, updateUserProfile, persistThemeRef]);

  return null;
}

function AuthWithThemeBridge({
  children,
  persistThemeRef,
}: {
  children: React.ReactNode;
  persistThemeRef: React.MutableRefObject<((mode: ThemeMode) => void) | null>;
}) {
  const { applyRemoteTheme } = useTheme();
  return (
    <AuthProvider onProfileThemeLoaded={applyRemoteTheme}>
      <ThemeProfileSyncBridge persistThemeRef={persistThemeRef} />
      {children}
    </AuthProvider>
  );
}

function WorkspaceAccessGuard({
  title,
  message,
  authenticated,
  onOpenAuth,
  onReturnHome,
}: {
  title: string;
  message: string;
  authenticated: boolean;
  onOpenAuth: () => void;
  onReturnHome: () => void;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-surface)] p-8 text-center shadow-[var(--shadow-sm)]">
        <div className="mx-auto h-12 w-12 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-default)] flex items-center justify-center text-[var(--status-warning)]">
          {authenticated ? <ShieldAlert className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
        </div>
        <h1 className="mt-4 font-display text-xl font-bold text-[var(--text-primary)]">{title}</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">{message}</p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          {!authenticated && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full sm:w-auto px-4 py-2.5 rounded-lg bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-hover)] text-[var(--brand-on-primary)] text-sm font-medium transition-colors"
            >
              Sign In
            </button>
          )}
          <button
            type="button"
            onClick={onReturnHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)] text-sm font-medium text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Return to Storefront
          </button>
        </div>
      </div>
    </div>
  );
}

function FinEaseShell() {
  const { firebaseUser, profile, authReady } = useAuth();
  const { setDrawerOpen } = useCart();
  const { showToast } = useToast();

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [shopCategoryId, setShopCategoryId] = useState<string>('all');
  const [shopSearchQuery, setShopSearchQuery] = useState<string>('');
  const [accountTab, setAccountTab] = useState<string>('orders');
  const [inspectedProduct, setInspectedProduct] = useState<Product | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleNavigate = useCallback(
    (
      view: AppView,
      opts?: { categoryId?: string; searchQuery?: string; accountTab?: string }
    ) => {
      if (view === 'admin' || view === 'store_manager' || view === 'delivery_partner') {
        if (!profile || !canAccessWorkspace(profile.role, view)) {
          showToast('You do not have permission to open that workspace.', 'error');
          if (!firebaseUser) {
            setAuthModalOpen(true);
          }
          return;
        }
      }

      if (opts?.categoryId !== undefined) {
        setShopCategoryId(opts.categoryId);
      } else if (view === 'shop' && opts?.searchQuery === undefined) {
        setShopCategoryId('all');
      }

      if (opts?.searchQuery !== undefined) {
        setShopSearchQuery(opts.searchQuery);
      } else if (view === 'shop' && opts?.categoryId !== undefined) {
        setShopSearchQuery('');
      }

      if (opts?.accountTab) {
        setAccountTab(opts.accountTab);
      }

      setCurrentView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [firebaseUser, profile, showToast]
  );

  // Protect operations workspaces if the user signs out while inside one
  useEffect(() => {
    if (!authReady) return;
    if (
      (currentView === 'admin' ||
        currentView === 'store_manager' ||
        currentView === 'delivery_partner') &&
      (!profile || !canAccessWorkspace(profile.role, currentView))
    ) {
      setCurrentView('home');
    }
  }, [authReady, currentView, profile]);

  // Dedicated full-bleed operations workspaces (role-gated)
  if (currentView === 'admin') {
    if (profile && canAccessWorkspace(profile.role, 'admin')) {
      return <AdminDashboard onExit={() => handleNavigate('home')} />;
    }
    return (
      <WorkspaceAccessGuard
        title="Owner Access Required"
        message="The Owner Admin Console is restricted to verified FinEase owner accounts."
        authenticated={Boolean(firebaseUser)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onReturnHome={() => handleNavigate('home')}
      />
    );
  }

  if (currentView === 'store_manager') {
    if (profile && canAccessWorkspace(profile.role, 'store_manager')) {
      return <StoreManagerDashboard onExit={() => handleNavigate('home')} />;
    }
    return (
      <WorkspaceAccessGuard
        title="Store Manager Access Required"
        message="This fulfillment workspace is restricted to assigned Store Managers and Owners."
        authenticated={Boolean(firebaseUser)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onReturnHome={() => handleNavigate('home')}
      />
    );
  }

  if (currentView === 'delivery_partner') {
    if (profile && canAccessWorkspace(profile.role, 'delivery_partner')) {
      return <DeliveryPartnerDashboard onExit={() => handleNavigate('home')} />;
    }
    return (
      <WorkspaceAccessGuard
        title="Delivery Partner Access Required"
        message="This dispatch console is restricted to active FinEase Delivery Partners."
        authenticated={Boolean(firebaseUser)}
        onOpenAuth={() => setAuthModalOpen(true)}
        onReturnHome={() => handleNavigate('home')}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <Navbar
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenAuth={() => setAuthModalOpen(true)}
      />

      <main className="flex-1">
        {currentView === 'home' && (
          <HomePage
            onNavigate={handleNavigate}
            onInspectProduct={(product) => setInspectedProduct(product)}
          />
        )}

        {currentView === 'shop' && (
          <ShopPage
            key={`${shopCategoryId}::${shopSearchQuery}`}
            initialCategoryId={shopCategoryId}
            initialSearch={shopSearchQuery}
            onInspectProduct={(product) => setInspectedProduct(product)}
          />
        )}

        {currentView === 'checkout' && (
          <CheckoutView
            onBackToShop={() => handleNavigate('shop')}
            onOrderComplete={() => {
              setAccountTab('orders');
              setCurrentView('account');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenAuth={() => setAuthModalOpen(true)}
          />
        )}

        {currentView === 'account' &&
          (firebaseUser ? (
            <CustomerDashboard
              key={accountTab}
              initialTab={accountTab}
              onGoToShop={() => handleNavigate('shop')}
            />
          ) : (
            <WorkspaceAccessGuard
              title="Sign in to view your account"
              message="Track your Dehradun grocery deliveries, manage saved addresses, and reach customer support once signed in."
              authenticated={false}
              onOpenAuth={() => setAuthModalOpen(true)}
              onReturnHome={() => handleNavigate('home')}
            />
          ))}
      </main>

      <CartDrawer
        onProceedToCheckout={() => {
          setDrawerOpen(false);
          handleNavigate('checkout');
        }}
      />

      <ProductDetailModal
        product={inspectedProduct}
        onClose={() => setInspectedProduct(null)}
      />

      <AuthModal open={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}

export default function App() {
  const persistThemeRef = useRef<((mode: ThemeMode) => void) | null>(null);

  const handlePersistTheme = useCallback((mode: ThemeMode) => {
    persistThemeRef.current?.(mode);
  }, []);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <ThemeProvider onPersistTheme={handlePersistTheme}>
          <AuthWithThemeBridge persistThemeRef={persistThemeRef}>
            <StoreDataProvider>
              <CartProvider>
                <FinEaseShell />
              </CartProvider>
            </StoreDataProvider>
          </AuthWithThemeBridge>
        </ThemeProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
