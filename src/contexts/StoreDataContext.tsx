import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PLATFORM_SETTINGS,
  DEHRADUN_LOCALITIES,
  STARTER_CATEGORIES,
  STARTER_COUPONS,
  STARTER_PRODUCTS,
} from '../data/dehradunCatalog';
import {
  subscribeCoupons,
  subscribeCustomerOrders,
  subscribeCustomerTickets,
  subscribePlatformSettings,
  subscribePublicCategories,
  subscribePublicProducts,
  subscribeUserAddresses,
} from '../lib/firestoreService';
import { useAuth } from './AuthContext';
import type { Address, Category, Coupon, Order, PlatformSettings, Product, SupportTicket } from '../types';

interface StoreDataContextValue {
  categories: Category[];
  products: Product[];
  coupons: Coupon[];
  settings: PlatformSettings;
  isCatalogSeededInFirestore: boolean;
  catalogLoading: boolean;
  selectedLocality: string;
  setSelectedLocality: (loc: string) => void;
  userAddresses: Address[];
  customerOrders: Order[];
  customerTickets: SupportTicket[];
}

const StoreDataContext = createContext<StoreDataContextValue | undefined>(undefined);

export function StoreDataProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, profile, authReady } = useAuth();
  const [firestoreCategories, setFirestoreCategories] = useState<Category[]>([]);
  const [firestoreProducts, setFirestoreProducts] = useState<Product[]>([]);
  const [firestoreCoupons, setFirestoreCoupons] = useState<Coupon[]>([]);
  const [firestoreSettings, setFirestoreSettings] = useState<PlatformSettings | null>(null);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const [selectedLocality, setSelectedLocality] = useState<string>(() => {
    try {
      return localStorage.getItem('finease-locality') || DEHRADUN_LOCALITIES[0];
    } catch {
      return DEHRADUN_LOCALITIES[0];
    }
  });

  const [userAddresses, setUserAddresses] = useState<Address[]>([]);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [customerTickets, setCustomerTickets] = useState<SupportTicket[]>([]);

  const isPrivilegedCatalogReader = profile?.role === 'owner' || profile?.role === 'store_manager';

  useEffect(() => {
    try {
      localStorage.setItem('finease-locality', selectedLocality);
    } catch {
      // ignore
    }
  }, [selectedLocality]);

  useEffect(() => {
    if (profile?.locality && DEHRADUN_LOCALITIES.includes(profile.locality)) {
      setSelectedLocality(profile.locality);
    }
  }, [profile?.locality]);

  // Public storefront listeners
  useEffect(() => {
    const unsubCats = subscribePublicCategories(
      profile?.role === 'owner',
      (items) => setFirestoreCategories(items),
      () => setCatalogLoaded(true)
    );
    const unsubProds = subscribePublicProducts(
      isPrivilegedCatalogReader,
      (items) => {
        setFirestoreProducts(items);
        setCatalogLoaded(true);
      },
      () => setCatalogLoaded(true)
    );
    const unsubCoupons = subscribeCoupons(
      profile?.role === 'owner',
      (items) => setFirestoreCoupons(items),
      () => {}
    );
    const unsubSettings = subscribePlatformSettings(
      (s) => setFirestoreSettings(s),
      () => {}
    );

    return () => {
      unsubCats();
      unsubProds();
      unsubCoupons();
      unsubSettings();
    };
  }, [profile?.role, isPrivilegedCatalogReader]);

  // Authenticated customer listeners
  useEffect(() => {
    if (!authReady || !firebaseUser) {
      setUserAddresses([]);
      setCustomerOrders([]);
      setCustomerTickets([]);
      return;
    }

    const unsubAddr = subscribeUserAddresses(firebaseUser.uid, setUserAddresses);
    const unsubOrders = subscribeCustomerOrders(firebaseUser.uid, setCustomerOrders);
    const unsubTickets = subscribeCustomerTickets(firebaseUser.uid, setCustomerTickets);

    return () => {
      unsubAddr();
      unsubOrders();
      unsubTickets();
    };
  }, [authReady, firebaseUser]);

  const isCatalogSeededInFirestore = firestoreProducts.length > 0;

  const value = useMemo<StoreDataContextValue>(() => {
    return {
      categories: firestoreCategories.length > 0 ? firestoreCategories : STARTER_CATEGORIES,
      products: firestoreProducts.length > 0 ? firestoreProducts : STARTER_PRODUCTS,
      coupons: firestoreCoupons.length > 0 ? firestoreCoupons : STARTER_COUPONS,
      settings: firestoreSettings ?? DEFAULT_PLATFORM_SETTINGS,
      isCatalogSeededInFirestore,
      catalogLoading: !catalogLoaded,
      selectedLocality,
      setSelectedLocality,
      userAddresses,
      customerOrders,
      customerTickets,
    };
  }, [
    firestoreCategories,
    firestoreProducts,
    firestoreCoupons,
    firestoreSettings,
    isCatalogSeededInFirestore,
    catalogLoaded,
    selectedLocality,
    userAddresses,
    customerOrders,
    customerTickets,
  ]);

  return <StoreDataContext.Provider value={value}>{children}</StoreDataContext.Provider>;
}

export function useStoreData() {
  const ctx = useContext(StoreDataContext);
  if (!ctx) throw new Error('useStoreData must be used within StoreDataProvider');
  return ctx;
}
