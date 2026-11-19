import React, { useState } from 'react';
import { Pencil, Plus, Sliders, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { StatusLabel } from '../ui/StatusLabel';
import { useToast } from '../../contexts/ToastContext';
import { PRODUCT_IMAGE_PRESETS } from '../../data/dehradunCatalog';
import {
  adjustProductInventory,
  deleteCategory,
  deleteProduct,
  deleteSupplier,
  saveCategory,
  saveProduct,
  saveSupplier,
} from '../../lib/firestoreService';
import { formatINR } from '../../utils/commerce';
import type {
  Category,
  InventoryChangeType,
  InventoryLog,
  Product,
  Supplier,
  UserProfile,
} from '../../types';

export function AdminProductsPanel({
  products,
  categories,
  actor,
}: {
  products: Product[];
  categories: Category[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || 'cat_fruits');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [unit, setUnit] = useState('1 kg');
  const [stock, setStock] = useState('25');
  const [minStock, setMinStock] = useState('8');
  const [imageUrl, setImageUrl] = useState(PRODUCT_IMAGE_PRESETS[0].url);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isBestSeller, setIsBestSeller] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setCategoryId(categories[0]?.id || 'cat_fruits');
    setSku(`FE-ITEM-${Math.floor(100 + Math.random() * 899)}`);
    setPrice('');
    setDiscountPrice('');
    setUnit('1 kg');
    setStock('25');
    setMinStock('8');
    setImageUrl(PRODUCT_IMAGE_PRESETS[0].url);
    setIsFeatured(false);
    setIsBestSeller(false);
    setIsActive(true);
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setCategoryId(p.categoryId);
    setSku(p.sku);
    setPrice(String(p.price));
    setDiscountPrice(p.discountPrice ? String(p.discountPrice) : '');
    setUnit(p.unit);
    setStock(String(p.stock));
    setMinStock(String(p.minStockThreshold));
    setImageUrl(p.imageUrl);
    setIsFeatured(p.isFeatured);
    setIsBestSeller(p.isBestSeller);
    setIsActive(p.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const cat = categories.find((c) => c.id === categoryId);
    if (!name.trim() || Number(price) <= 0) {
      showToast('Enter product name and valid price.', 'error');
      return;
    }
    setSaving(true);
    try {
      await saveProduct(
        {
          name: name.trim(),
          description: description.trim() || `${name.trim()} delivered fresh by FinEase Dehradun.`,
          categoryId,
          categoryName: cat?.name || 'General',
          sku: sku.trim().toUpperCase(),
          price: Number(price),
          discountPrice: discountPrice ? Number(discountPrice) : null,
          unit: unit.trim(),
          stock: Number(stock),
          minStockThreshold: Number(minStock),
          imageUrl: imageUrl.trim() || PRODUCT_IMAGE_PRESETS[0].url,
          isFeatured,
          isBestSeller,
          isActive,
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role },
        editing?.id
      );
      showToast(editing ? 'Product updated.' : 'Product created.', 'success');
      setModalOpen(false);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save product.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const filtered = products.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.sku.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, SKU, or category..."
          className="w-full sm:w-72 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
        />
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
        >
          <Plus className="h-4 w-4" />
          Add Product
        </button>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium text-right">Price</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {filtered.map((p) => (
              <tr key={p.id} className="hover:bg-[var(--bg-surface-subtle)]/50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      referrerPolicy="no-referrer"
                      className="h-10 w-10 rounded-md object-cover border border-[var(--border-hairline)] shrink-0"
                    />
                    <div>
                      <p className="font-medium text-[var(--text-primary)]">{p.name}</p>
                      <p className="text-xs text-[var(--text-muted)]">{p.unit}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono-num text-xs text-[var(--text-secondary)]">
                  {p.sku}
                </td>
                <td className="px-4 py-3 text-xs text-[var(--text-secondary)]">{p.categoryName}</td>
                <td className="px-4 py-3 text-right font-mono-num">
                  <span className="font-semibold text-[var(--text-primary)]">
                    {formatINR(p.discountPrice ?? p.price)}
                  </span>
                  {p.discountPrice && (
                    <span className="block text-[11px] text-[var(--text-muted)] line-through">
                      {formatINR(p.price)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-mono-num font-semibold text-[var(--text-primary)]">
                  {p.stock}
                </td>
                <td className="px-4 py-3">
                  <StatusLabel
                    label={p.isActive ? 'Active' : 'Inactive'}
                    tone={p.isActive ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    aria-label={`Edit ${p.name}`}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteProduct(p, {
                        uid: actor.uid,
                        displayName: actor.displayName,
                        role: actor.role,
                      });
                      showToast(`Deleted ${p.name}.`, 'info');
                    }}
                    aria-label={`Delete ${p.name}`}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger-text)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Product' : 'Add New Product'}
        maxWidthClass="max-w-xl"
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Product Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Category
              </label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Description
            </label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                SKU
              </label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value.toUpperCase())}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-xs font-mono-num text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Unit
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                MRP (₹)
              </label>
              <input
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Sale Price (₹)
              </label>
              <input
                type="number"
                min={1}
                value={discountPrice}
                onChange={(e) => setDiscountPrice(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Stock Quantity
              </label>
              <input
                type="number"
                min={0}
                required
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Low-Stock Threshold
              </label>
              <input
                type="number"
                min={0}
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Studio Product Image
            </label>
            <select
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
            >
              {PRODUCT_IMAGE_PRESETS.map((preset) => (
                <option key={preset.url} value={preset.url}>
                  {preset.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4 pt-1 text-xs text-[var(--text-secondary)]">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="accent-[var(--brand-primary)]"
              />
              Active in Catalog
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="accent-[var(--brand-primary)]"
              />
              Featured on Homepage
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isBestSeller}
                onChange={(e) => setIsBestSeller(e.target.checked)}
                className="accent-[var(--brand-primary)]"
              />
              Best Seller
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[var(--border-hairline)]">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-[var(--border-hairline)] px-4 py-2 text-xs font-medium text-[var(--text-secondary)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function AdminCategoriesPanel({
  categories,
  actor,
}: {
  categories: Category[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState(PRODUCT_IMAGE_PRESETS[0].url);
  const [sortOrder, setSortOrder] = useState('11');
  const [editing, setEditing] = useState<Category | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    try {
      await saveCategory(
        {
          name: name.trim(),
          description: description.trim(),
          imageUrl,
          sortOrder: Number(sortOrder) || 0,
          isActive: editing ? editing.isActive : true,
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role },
        editing?.id
      );
      setName('');
      setDescription('');
      setEditing(null);
      showToast(editing ? 'Category updated.' : 'Category created.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save category.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3"
      >
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          {editing ? `Edit Category: ${editing.name}` : 'Add Category'}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Category Name"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <select
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            {PRODUCT_IMAGE_PRESETS.map((p) => (
              <option key={p.url} value={p.url}>
                {p.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="Order"
              className="w-20 rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-2 py-2 text-sm font-mono-num text-[var(--text-primary)]"
            />
            <button
              type="submit"
              className="flex-1 rounded-lg bg-[var(--brand-primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
            >
              {editing ? 'Update' : 'Add'}
            </button>
          </div>
        </div>
      </form>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Slug</th>
              <th className="px-4 py-3 font-medium text-right">Order</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {categories.map((cat) => (
              <tr key={cat.id}>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{cat.name}</td>
                <td className="px-4 py-3 font-mono-num text-xs text-[var(--text-muted)]">{cat.slug}</td>
                <td className="px-4 py-3 text-right font-mono-num text-xs">{cat.sortOrder}</td>
                <td className="px-4 py-3">
                  <StatusLabel
                    label={cat.isActive ? 'Active' : 'Hidden'}
                    tone={cat.isActive ? 'success' : 'neutral'}
                  />
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(cat);
                      setName(cat.name);
                      setDescription(cat.description || '');
                      setImageUrl(cat.imageUrl);
                      setSortOrder(String(cat.sortOrder));
                    }}
                    aria-label={`Edit category ${cat.name}`}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteCategory(cat, {
                        uid: actor.uid,
                        displayName: actor.displayName,
                        role: actor.role,
                      });
                      showToast(`Deleted ${cat.name}.`, 'info');
                    }}
                    aria-label={`Delete category ${cat.name}`}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger-text)]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminInventoryPanel({
  products,
  inventoryLogs,
  actor,
}: {
  products: Product[];
  inventoryLogs: InventoryLog[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [target, setTarget] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const [minThreshold, setMinThreshold] = useState('');
  const [changeType, setChangeType] = useState<InventoryChangeType>('restock');
  const [reason, setReason] = useState('');

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target || reason.trim().length < 2) return;
    try {
      await adjustProductInventory({
        product: target,
        newStock: Number(newStock),
        minStockThreshold: Number(minThreshold),
        changeType,
        reason: reason.trim(),
        actor: { uid: actor.uid, displayName: actor.displayName, role: actor.role },
      });
      showToast(`Updated inventory for ${target.name}.`, 'success');
      setTarget(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Inventory update failed.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border-hairline)] text-xs text-[var(--text-muted)]">
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">SKU</th>
              <th className="px-4 py-3 font-medium text-right">Stock</th>
              <th className="px-4 py-3 font-medium text-right">Min Threshold</th>
              <th className="px-4 py-3 font-medium">Health</th>
              <th className="px-4 py-3 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-hairline)]">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-[var(--text-primary)]">{p.name}</td>
                <td className="px-4 py-3 font-mono-num text-xs text-[var(--text-muted)]">{p.sku}</td>
                <td className="px-4 py-3 font-mono-num text-right font-semibold">{p.stock}</td>
                <td className="px-4 py-3 font-mono-num text-right text-[var(--text-muted)]">
                  {p.minStockThreshold}
                </td>
                <td className="px-4 py-3">
                  {p.stock === 0 ? (
                    <StatusLabel label="Out of Stock" tone="danger" />
                  ) : p.stock <= p.minStockThreshold ? (
                    <StatusLabel label="Low Stock" tone="warning" />
                  ) : (
                    <StatusLabel label="Healthy" tone="success" />
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => {
                      setTarget(p);
                      setNewStock(String(p.stock));
                      setMinThreshold(String(p.minStockThreshold));
                      setReason('');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg border border-[var(--border-hairline)] px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-surface-subtle)]"
                  >
                    <Sliders className="h-3.5 w-3.5" />
                    Adjust
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <h3 className="font-display text-sm font-semibold text-[var(--text-primary)] mb-3">
          Immutable Stock Movement History ({inventoryLogs.length})
        </h3>
        {inventoryLogs.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)]">No inventory logs recorded yet.</p>
        ) : (
          <div className="divide-y divide-[var(--border-hairline)] text-xs">
            {inventoryLogs.slice(0, 25).map((log) => (
              <div key={log.id} className="py-2.5 flex flex-wrap justify-between gap-2">
                <div>
                  <span className="font-semibold text-[var(--text-primary)]">{log.productName}</span>
                  <span className="text-[var(--text-muted)]"> · {log.changeType.replace('_', ' ')} · {log.reason}</span>
                </div>
                <span className="font-mono-num text-[var(--text-secondary)]">
                  {log.previousStock} → {log.newStock} ({log.quantityDelta >= 0 ? '+' : ''}
                  {log.quantityDelta}) · {log.performedByName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`Adjust Inventory — ${target?.name ?? ''}`}
      >
        <form onSubmit={handleAdjust} className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                New Stock
              </label>
              <input
                type="number"
                min={0}
                required
                value={newStock}
                onChange={(e) => setNewStock(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Min Threshold
              </label>
              <input
                type="number"
                min={0}
                required
                value={minThreshold}
                onChange={(e) => setMinThreshold(e.target.value)}
                className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm font-mono-num text-[var(--text-primary)]"
              />
            </div>
          </div>
          <select
            value={changeType}
            onChange={(e) => setChangeType(e.target.value as InventoryChangeType)}
            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          >
            <option value="restock">Replenishment / Restock</option>
            <option value="adjustment">Manual Audit Adjustment</option>
            <option value="spoilage">Spoilage / Write-Off</option>
          </select>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Reason for adjustment (required)"
            className="w-full rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button
            type="submit"
            className="w-full rounded-lg bg-[var(--brand-primary)] py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Commit Stock Change
          </button>
        </form>
      </Modal>
    </div>
  );
}

export function AdminSuppliersPanel({
  suppliers,
  actor,
}: {
  suppliers: Supplier[];
  actor: UserProfile;
}) {
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [productsText, setProductsText] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    try {
      await saveSupplier(
        {
          name: name.trim(),
          contactPerson: contactPerson.trim() || 'Dispatch Desk',
          phone: phone.trim(),
          productsSupplied: productsText
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          notes: notes.trim(),
          isActive: true,
        },
        { uid: actor.uid, displayName: actor.displayName, role: actor.role }
      );
      setName('');
      setContactPerson('');
      setPhone('');
      setProductsText('');
      setNotes('');
      showToast('Supplier added.', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save supplier.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 space-y-3"
      >
        <h2 className="font-display text-sm font-semibold text-[var(--text-primary)]">
          Add Dehradun / Regional Supplier
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Supplier Company Name"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            type="text"
            required
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="Contact Person"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            type="tel"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={productsText}
            onChange={(e) => setProductsText(e.target.value)}
            placeholder="Products supplied (comma-separated)"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery cadence / settlement notes"
            className="rounded-lg border border-[var(--border-hairline)] bg-[var(--bg-input)] px-3 py-2 text-sm text-[var(--text-primary)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-[var(--brand-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--brand-primary-hover)]"
          >
            Add Supplier
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suppliers.map((s) => (
          <div
            key={s.id}
            className="rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5 flex justify-between gap-4"
          >
            <div className="space-y-1 text-xs">
              <p className="text-sm font-semibold text-[var(--text-primary)]">{s.name}</p>
              <p className="text-[var(--text-secondary)]">
                {s.contactPerson} · <span className="font-mono-num">{s.phone}</span>
              </p>
              {s.productsSupplied.length > 0 && (
                <p className="text-[var(--text-muted)]">
                  Supplies: {s.productsSupplied.join(', ')}
                </p>
              )}
              {s.notes && <p className="text-[var(--text-muted)]">{s.notes}</p>}
            </div>
            <button
              type="button"
              onClick={async () => {
                await deleteSupplier(s.id);
                showToast('Supplier removed.', 'info');
              }}
              aria-label={`Delete supplier ${s.name}`}
              className="self-start p-1.5 text-[var(--text-muted)] hover:text-[var(--status-danger-text)]"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
