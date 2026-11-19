import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import type { CartItem, Product } from '../types';

const CART_STORAGE_KEY = 'finease-cart-v1';

interface CartContextValue {
  items: CartItem[];
  couponCode: string;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  setCouponCode: (code: string) => void;
  addToCart: (product: Product, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  getItemQuantity: (productId: string) => number;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

function readLocalCart(): { items: CartItem[]; couponCode: string } {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [], couponCode: '' };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      couponCode: typeof parsed.couponCode === 'string' ? parsed.couponCode : '',
    };
  } catch {
    return { items: [], couponCode: '' };
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, authReady } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<CartItem[]>(() => readLocalCart().items);
  const [couponCode, setCouponCodeState] = useState<string>(() => readLocalCart().couponCode);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Sync from Firestore when user logs in
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    let cancelled = false;
    async function loadRemoteCart() {
      try {
        const snap = await getDoc(doc(db, 'carts', firebaseUser!.uid));
        if (cancelled) return;
        if (snap.exists()) {
          const data = snap.data();
          const remoteItems: CartItem[] = Array.isArray(data.items) ? data.items : [];
          if (remoteItems.length > 0) {
            setItems((local) => (local.length > 0 ? local : remoteItems));
          }
          if (typeof data.couponCode === 'string' && data.couponCode) {
            setCouponCodeState((prev) => prev || data.couponCode);
          }
        }
      } catch {
        // non-fatal fallback to local cart
      }
    }
    void loadRemoteCart();
    return () => {
      cancelled = true;
    };
  }, [authReady, firebaseUser]);

  // Persist locally and to Firestore if authenticated
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items, couponCode }));
    } catch {
      // ignore storage errors
    }

    if (authReady && firebaseUser) {
      const ref = doc(db, 'carts', firebaseUser.uid);
      void setDoc(ref, {
        userId: firebaseUser.uid,
        items: items.slice(0, 50),
        couponCode: couponCode.slice(0, 32),
        updatedAt: serverTimestamp(),
      }).catch(() => {
        // ignore transient offline cart sync errors
      });
    }
  }, [items, couponCode, authReady, firebaseUser]);

  const addToCart = useCallback(
    (product: Product, quantity = 1) => {
      if (!product.isActive || product.stock <= 0) {
        showToast(`${product.name} is currently out of stock.`, 'error');
        return;
      }
      const safeQty = Math.max(1, Math.floor(quantity));
      setItems((prev) => {
        const existing = prev.find((i) => i.productId === product.id);
        if (existing) {
          const nextQty = Math.min(product.stock, existing.quantity + safeQty);
          if (nextQty === existing.quantity) {
            showToast(`Only ${product.stock} in stock for ${product.name}.`, 'info');
            return prev;
          }
          return prev.map((i) =>
            i.productId === product.id
              ? { ...i, quantity: nextQty, maxStock: product.stock, price: product.price, discountPrice: product.discountPrice }
              : i
          );
        }
        return [
          ...prev,
          {
            productId: product.id,
            name: product.name,
            unit: product.unit,
            sku: product.sku,
            price: product.price,
            discountPrice: product.discountPrice ?? null,
            quantity: Math.min(product.stock, safeQty),
            imageUrl: product.imageUrl,
            maxStock: product.stock,
          },
        ];
      });
      showToast(`Added ${product.name} to basket`, 'success');
    },
    [showToast]
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setItems((prev) => prev.filter((i) => i.productId !== productId));
        return;
      }
      setItems((prev) =>
        prev.map((item) => {
          if (item.productId !== productId) return item;
          const clamped = Math.min(item.maxStock, Math.floor(quantity));
          if (quantity > item.maxStock) {
            showToast(`Maximum available stock (${item.maxStock}) reached for ${item.name}.`, 'info');
          }
          return { ...item, quantity: Math.max(1, clamped) };
        })
      );
    },
    [showToast]
  );

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCouponCodeState('');
  }, []);

  const setCouponCode = useCallback((code: string) => {
    setCouponCodeState(code.toUpperCase().trim());
  }, []);

  const getItemQuantity = useCallback(
    (productId: string) => items.find((i) => i.productId === productId)?.quantity ?? 0,
    [items]
  );

  return (
    <CartContext.Provider
      value={{
        items,
        couponCode,
        isDrawerOpen,
        setDrawerOpen,
        setCouponCode,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        getItemQuantity,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
