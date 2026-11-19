import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, PackageX } from 'lucide-react';
import { useStoreData } from '../../contexts/StoreDataContext';
import { ProductCard } from './ProductCard';
import { EmptyState } from '../ui/EmptyState';
import { getEffectivePrice } from '../../utils/commerce';
import type { Product } from '../../types';

interface ShopPageProps {
  initialCategoryId?: string;
  initialSearch?: string;
  onInspectProduct: (product: Product) => void;
}

type SortOption = 'featured' | 'price_asc' | 'price_desc' | 'name_asc';

export function ShopPage({
  initialCategoryId = 'all',
  initialSearch = '',
  onInspectProduct,
}: ShopPageProps) {
  const { categories, products } = useStoreData();
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategoryId);
  const [searchQuery, setSearchQuery] = useState<string>(initialSearch);
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [inStockOnly, setInStockOnly] = useState(false);

  const activeCategories = categories.filter((c) => c.isActive);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = products.filter((p) => {
      if (!p.isActive) return false;
      if (selectedCategory !== 'all' && p.categoryId !== selectedCategory) return false;
      if (inStockOnly && p.stock <= 0) return false;
      if (q) {
        const hay = `${p.name} ${p.categoryName} ${p.description} ${p.sku}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'price_asc') return getEffectivePrice(a) - getEffectivePrice(b);
      if (sortBy === 'price_desc') return getEffectivePrice(b) - getEffectivePrice(a);
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      return Number(b.isFeatured) - Number(a.isFeatured) || Number(b.isBestSeller) - Number(a.isBestSeller);
    });
  }, [products, selectedCategory, searchQuery, sortBy, inStockOnly]);

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-[var(--border-hairline)]">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--text-primary)]">
            Daily Essentials Catalog
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Showing <span className="font-mono-num font-medium">{filteredProducts.length}</span>{' '}
            products available for Dehradun delivery.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative sm:w-64">
            <Search className="h-4 w-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products or SKU..."
              aria-label="Search catalog"
              className="w-full h-10 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--brand-primary)] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--text-muted)] shrink-0" />
            <select
              aria-label="Sort products"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="h-10 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 text-sm text-[var(--text-primary)] focus:border-[var(--brand-primary)] focus:outline-none"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="name_asc">Name: A to Z</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="py-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === 'all'
                ? 'bg-[var(--brand-primary)] text-white'
                : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            All Categories
          </button>
          {activeCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                selectedCategory === cat.id
                  ? 'bg-[var(--brand-primary)] text-white'
                  : 'bg-[var(--bg-surface)] border border-[var(--border-hairline)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-medium text-[var(--text-secondary)] cursor-pointer select-none whitespace-nowrap">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => setInStockOnly(e.target.checked)}
            className="rounded border-[var(--border-strong)] accent-[var(--brand-primary)]"
          />
          In stock only
        </label>
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyState
          icon={<PackageX className="h-5 w-5" />}
          title="No matching products"
          description="Try clearing your search term or switching to a different grocery category."
          action={
            <button
              type="button"
              onClick={() => {
                setSelectedCategory('all');
                setSearchQuery('');
                setInStockOnly(false);
              }}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              Reset Filters
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} onInspect={onInspectProduct} />
          ))}
        </div>
      )}
    </div>
  );
}
