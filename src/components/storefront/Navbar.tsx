import { useState } from 'react';
import {
  ShoppingBag,
  User,
  Menu,
  X,
  LayoutDashboard,
  ClipboardList,
  Truck,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { FinEaseLogo } from '../ui/FinEaseLogo';
import { ThemeSwitcher } from '../ui/ThemeSwitcher';
import { useAuth } from '../../contexts/AuthContext';
import { useCart } from '../../contexts/CartContext';
import { canAccessWorkspace } from '../../utils/workflow';
import type { AppView } from '../../types';

interface NavbarProps {
  currentView: AppView;
  onNavigate: (view: AppView, opts?: { categoryId?: string; accountTab?: string }) => void;
  onOpenAuth: () => void;
}

export function Navbar({ currentView, onNavigate, onOpenAuth }: NavbarProps) {
  const { profile, firebaseUser, logout } = useAuth();
  const { items, setDrawerOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);

  const navLinks: { label: string; view: AppView; accountTab?: string }[] = [
    { label: 'Home', view: 'home' },
    { label: 'Shop', view: 'shop' },
    { label: 'Orders', view: 'account', accountTab: 'orders' },
    { label: 'Support', view: 'account', accountTab: 'support' },
  ];

  const handleLinkClick = (view: AppView, accountTab?: string) => {
    setMobileMenuOpen(false);
    if (view === 'account' && !firebaseUser) {
      onOpenAuth();
      return;
    }
    onNavigate(view, { accountTab });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]/95 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          aria-label="FinEase Home"
          className="whitespace-nowrap shrink-0 focus-visible:outline-none rounded-md"
        >
          <FinEaseLogo size="md" />
        </button>

        {/* Zone 2: 4 Clean Single-Line Nav Links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          {navLinks.map((item) => {
            const isActive =
              item.view === currentView &&
              (item.view !== 'account' || !item.accountTab);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.view, item.accountTab)}
                className={`text-sm font-medium whitespace-nowrap shrink-0 pb-0.5 border-b-2 transition-colors ${
                  isActive
                    ? 'border-[var(--brand-primary)] text-[var(--text-primary)]'
                    : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme, Cart & Account Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="hidden sm:block">
            <ThemeSwitcher compact />
          </div>

          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={`Open basket, ${cartCount} items`}
            className="relative inline-flex items-center gap-2 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)] whitespace-nowrap shrink-0"
          >
            <ShoppingBag className="h-4 w-4 text-[var(--brand-primary-text)]" />
            <span className="hidden sm:inline">Basket</span>
            <span className="font-mono-num text-xs font-semibold text-[var(--brand-primary-text)]">
              {cartCount}
            </span>
          </button>

          {firebaseUser && profile ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileMenuOpen((v) => !v)}
                aria-expanded={profileMenuOpen}
                aria-label="Account menu"
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--brand-primary)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] whitespace-nowrap shrink-0"
              >
                <User className="h-4 w-4" />
                <span className="max-w-[110px] truncate hidden sm:inline">
                  {profile.displayName.split(' ')[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 opacity-80" />
              </button>

              {profileMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-60 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-elevated)] shadow-[var(--shadow-elevated)] py-1.5 z-50"
                  onMouseLeave={() => setProfileMenuOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-[var(--border-hairline)]">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">
                      {profile.displayName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] truncate">{profile.email}</p>
                    <p className="mt-1 text-xs font-medium text-[var(--brand-primary-text)] capitalize">
                      {profile.role.replace('_', ' ')}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setProfileMenuOpen(false);
                      onNavigate('account', { accountTab: 'orders' });
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                  >
                    <User className="h-4 w-4 text-[var(--text-muted)]" />
                    My Account & Orders
                  </button>

                  {canAccessWorkspace(profile.role, 'admin') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onNavigate('admin');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                    >
                      <LayoutDashboard className="h-4 w-4 text-[var(--brand-primary-text)]" />
                      Owner Dashboard
                    </button>
                  )}

                  {canAccessWorkspace(profile.role, 'store_manager') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onNavigate('store_manager');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                    >
                      <ClipboardList className="h-4 w-4 text-[var(--brand-primary-text)]" />
                      Store Manager Console
                    </button>
                  )}

                  {canAccessWorkspace(profile.role, 'delivery_partner') && (
                    <button
                      type="button"
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onNavigate('delivery_partner');
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                    >
                      <Truck className="h-4 w-4 text-[var(--brand-primary-text)]" />
                      Delivery Partner Console
                    </button>
                  )}

                  <div className="my-1 border-t border-[var(--border-hairline)]" />

                  <button
                    type="button"
                    onClick={async () => {
                      setProfileMenuOpen(false);
                      await logout();
                      onNavigate('home');
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm text-[var(--status-danger-text)] hover:bg-[var(--bg-surface-subtle)]"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--brand-primary-hover)] whitespace-nowrap shrink-0"
            >
              Sign In
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="md:hidden inline-flex items-center justify-center rounded-lg p-2 text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 py-4 space-y-3">
          <div className="flex flex-col gap-1">
            {navLinks.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.view, item.accountTab)}
                className="w-full text-left rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="pt-3 border-t border-[var(--border-hairline)] flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">Appearance</span>
            <ThemeSwitcher />
          </div>
        </div>
      )}
    </header>
  );
}
