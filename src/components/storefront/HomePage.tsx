import React, { useState } from 'react';
import { ArrowRight, MapPin, Search, Clock, Banknote, Leaf } from 'lucide-react';
import { useStoreData } from '../../contexts/StoreDataContext';
import { HERO_IMAGE_URL } from '../../data/dehradunCatalog';
import { ProductCard } from './ProductCard';
import { ProductImage } from '../ui/ProductImage';
import { FinEaseLogo } from '../ui/FinEaseLogo';
import { formatINR } from '../../utils/commerce';
import type { AppView, Product } from '../../types';

interface HomePageProps {
  onNavigate: (view: AppView, opts?: { categoryId?: string; searchQuery?: string }) => void;
  onInspectProduct: (product: Product) => void;
}

export function HomePage({ onNavigate, onInspectProduct }: HomePageProps) {
  const { categories, products, settings, selectedLocality, setSelectedLocality } = useStoreData();
  const [heroSearch, setHeroSearch] = useState('');

  const activeCategories = categories.filter((c) => c.isActive);
  const activeProducts = products.filter((p) => p.isActive);
  const featuredProducts = activeProducts.filter((p) => p.isFeatured).slice(0, 4);
  const bestSellers = activeProducts.filter((p) => p.isBestSeller).slice(0, 4);

  const handleHeroSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNavigate('shop', { searchQuery: heroSearch.trim() });
  };

  return (
    <div className="bg-[var(--bg-canvas)]">
      {/* Section 1: Editorial Split Hero */}
      <section className="border-b border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-[var(--text-secondary)]">
                <span>Dehradun</span>
                <span aria-hidden="true">·</span>
                <span>{settings.estimatedDeliveryMinutes}-min delivery</span>
                <span aria-hidden="true">·</span>
                <span>Cash on Delivery</span>
              </div>

              <h1 className="mt-4 font-display text-3xl sm:text-4xl lg:text-[2.85rem] font-bold tracking-tight text-[var(--text-primary)] leading-[1.12] [text-wrap:balance]">
                Your Daily Essentials, All in One Place.
              </h1>

              <p className="mt-4 max-w-xl text-base text-[var(--text-secondary)] leading-relaxed">
                Morning-harvested Himalayan produce, chilled A2 dairy, aged Dehradun basmati, and
                everyday household essentials delivered straight to your doorstep.
              </p>

              {/* Locality Selector + Search Bar */}
              <form
                onSubmit={handleHeroSearchSubmit}
                className="mt-7 flex flex-col sm:flex-row gap-2.5"
              >
                <div className="relative sm:w-48 shrink-0">
                  <MapPin
                    className="h-4 w-4 text-[var(--brand-primary-text)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <select
                    aria-label="Select Dehradun delivery locality"
                    value={selectedLocality}
                    onChange={(e) => setSelectedLocality(e.target.value)}
                    className="w-full h-11 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-3 text-sm font-medium text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
                  >
                    {settings.serviceableLocalities.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative flex-1">
                  <Search
                    className="h-4 w-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={heroSearch}
                    onChange={(e) => setHeroSearch(e.target.value)}
                    placeholder="Search apples, A2 milk, basmati rice..."
                    aria-label="Search groceries and essentials"
                    className="w-full h-11 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-10 pr-4 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  className="h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-semibold text-white hover:bg-[var(--brand-primary-hover)] whitespace-nowrap shrink-0"
                >
                  <span>Shop Now</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Free delivery on orders above{' '}
                <span className="font-mono-num font-medium text-[var(--text-secondary)]">
                  {formatINR(settings.freeDeliveryThreshold)}
                </span>{' '}
                · Use code <span className="font-mono-num font-semibold text-[var(--brand-primary-text)]">WELCOME50</span> for ₹50 off orders over ₹250
              </p>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[260px] lg:min-h-[380px] overflow-hidden rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface-subtle)]">
                <img
                  src={HERO_IMAGE_URL}
                  alt="Curated FinEase grocery delivery box with Himalayan apples, fresh spinach, A2 milk, sourdough bread, and Dehradun basmati rice"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Delivery Promise Strip (full width row below hero split) */}
          <div className="mt-10 pt-8 border-t border-[var(--border-hairline)] grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-[var(--brand-primary-text)] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Hyperlocal {settings.estimatedDeliveryMinutes}-Minute Dispatch
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Direct fulfillment across {settings.serviceableLocalities.length} Dehradun localities from our local hub.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Leaf className="h-5 w-5 text-[var(--brand-primary-text)] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Foothills Farm-Direct Quality
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Daily morning procurement from Uttarakhand orchards, A2 dairies, and heritage rice mills.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Banknote className="h-5 w-5 text-[var(--brand-primary-text)] shrink-0 mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Simple Cash on Delivery
                </h2>
                <p className="mt-0.5 text-xs text-[var(--text-secondary)] leading-relaxed">
                  Inspect your fresh basket at the door and settle easily with cash. Zero hidden charges.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Category Directory */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Shop by Category
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Ten curated aisles covering every kitchen and home need.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className="text-sm font-semibold text-[var(--brand-primary-text)] hover:underline whitespace-nowrap shrink-0"
          >
            View full catalog
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onNavigate('shop', { categoryId: cat.id })}
              className="group text-left rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-hidden hover:border-[var(--brand-primary)] transition-colors"
            >
              <ProductImage
                src={cat.imageUrl}
                alt={cat.name}
                aspectClass="aspect-[4/3]"
                className="w-full"
              />
              <div className="px-3.5 py-3">
                <p className="font-display text-sm font-semibold text-[var(--text-primary)] truncate group-hover:text-[var(--brand-primary-text)]">
                  {cat.name}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Section 3: Featured Products */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-[var(--border-hairline)]">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Featured Dehradun Essentials
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Handpicked daily staples and fresh morning arrivals.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('shop')}
            className="text-sm font-semibold text-[var(--brand-primary-text)] hover:underline whitespace-nowrap shrink-0"
          >
            Browse all {activeProducts.length} items
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onInspect={onInspectProduct} />
          ))}
        </div>
      </section>

      {/* Section 4: Household Best Sellers */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 border-t border-[var(--border-hairline)]">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
              Most Reordered by Households
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Everyday favorites stocked fresh every morning.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} onInspect={onInspectProduct} />
          ))}
        </div>
      </section>

      {/* Clean Footer */}
      <footer className="mt-12 border-t border-[var(--border-hairline)] bg-[var(--bg-surface)]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <FinEaseLogo size="md" />
              <p className="mt-3 max-w-sm text-sm text-[var(--text-secondary)] leading-relaxed">
                Your Daily Essentials, All in One Place. Hyperlocal grocery and household essentials
                delivery built for {settings.city}.
              </p>
              <p className="mt-3 text-xs text-[var(--text-muted)]">
                Support: {settings.supportEmail || 'support@finease.in'} · {settings.supportPhone || '+91 135 274 8820'}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
                Dehradun Delivery Zones
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {settings.serviceableLocalities.slice(0, 8).join(' · ')}
              </p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-[var(--text-primary)] mb-3">
                Quick Links
              </h3>
              <div className="flex flex-col gap-2 text-xs text-[var(--text-secondary)]">
                <button type="button" onClick={() => onNavigate('shop')} className="text-left hover:text-[var(--text-primary)]">
                  Browse Catalog
                </button>
                <button type="button" onClick={() => onNavigate('account')} className="text-left hover:text-[var(--text-primary)]">
                  Track Orders
                </button>
                <button type="button" onClick={() => onNavigate('account')} className="text-left hover:text-[var(--text-primary)]">
                  Customer Support
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-[var(--border-hairline)] flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-[var(--text-muted)]">
            <p>© {new Date().getFullYear()} FinEase Essentials Pvt. Ltd. · Dehradun, Uttarakhand.</p>
            <p>Cash on Delivery · Free delivery above {formatINR(settings.freeDeliveryThreshold)}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
