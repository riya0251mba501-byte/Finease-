import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { auth, BOOTSTRAPPED_OWNER_EMAIL, db, googleProvider } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreError';
import { sanitizeText } from '../utils/commerce';
import type { ThemeMode, UserProfile, UserRole } from '../types';

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: UserProfile | null;
  authReady: boolean;
  authLoading: boolean;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (params: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (updates: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'locality' | 'themePreference'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getLocalTheme(): ThemeMode {
  try {
    const val = localStorage.getItem('finease-theme');
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {
    // ignore
  }
  return 'system';
}

async function resolveTrustedRole(user: FirebaseUser): Promise<UserRole> {
  if (
    user.emailVerified &&
    user.email?.toLowerCase() === BOOTSTRAPPED_OWNER_EMAIL.toLowerCase()
  ) {
    return 'owner';
  }
  try {
    const staffSnap = await getDoc(doc(db, 'staff_roles', user.uid));
    if (staffSnap.exists()) {
      const data = staffSnap.data();
      if (data.isActive && (data.role === 'owner' || data.role === 'store_manager' || data.role === 'delivery_partner')) {
        return data.role as UserRole;
      }
    }
  } catch {
    // non-staff users simply resolve to customer
  }
  return 'customer';
}

async function syncUserProfileDocument(user: FirebaseUser): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const trustedRole = await resolveTrustedRole(user);
  const nowIso = new Date().toISOString();

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data();
      const profile: UserProfile = {
        uid: user.uid,
        email: String(data.email || user.email || ''),
        displayName: String(data.displayName || user.displayName || 'FinEase Customer'),
        phone: typeof data.phone === 'string' ? data.phone : '',
        role: trustedRole !== 'customer' ? trustedRole : (data.role as UserRole) || 'customer',
        themePreference: (data.themePreference as ThemeMode) || getLocalTheme(),
        locality: typeof data.locality === 'string' ? data.locality : 'Rajpur Road',
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : nowIso,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : nowIso,
      };
      return profile;
    }

    const displayName = sanitizeText(user.displayName || user.email?.split('@')[0] || 'FinEase Customer', 120);
    const themePreference = getLocalTheme();
    const initialRole: UserRole = trustedRole === 'owner' ? 'owner' : 'customer';

    await setDoc(userRef, {
      uid: user.uid,
      email: sanitizeText(user.email || '', 200),
      displayName,
      phone: '',
      role: initialRole,
      themePreference,
      locality: 'Rajpur Road',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return {
      uid: user.uid,
      email: user.email || '',
      displayName,
      phone: '',
      role: initialRole,
      themePreference,
      locality: 'Rajpur Road',
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export function AuthProvider({
  children,
  onProfileThemeLoaded,
}: {
  children: React.ReactNode;
  onProfileThemeLoaded?: (theme: ThemeMode) => void;
}) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const synced = await syncUserProfileDocument(user);
          setProfile(synced);
          onProfileThemeLoaded?.(synced.themePreference);
        } catch (err) {
          console.error('Failed to sync user profile:', err);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, [onProfileThemeLoaded]);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    setAuthLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const registerWithEmail = useCallback(
    async ({
      displayName,
      email,
      password,
      phone,
    }: {
      displayName: string;
      email: string;
      password: string;
      phone?: string;
    }) => {
      setAuthLoading(true);
      try {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanName = sanitizeText(displayName, 120);
        await updateProfile(cred.user, { displayName: cleanName });
        const themePreference = getLocalTheme();
        await setDoc(doc(db, 'users', cred.user.uid), {
          uid: cred.user.uid,
          email: sanitizeText(email.trim(), 200),
          displayName: cleanName,
          phone: sanitizeText(phone ?? '', 24),
          role: 'customer',
          themePreference,
          locality: 'Rajpur Road',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        try {
          await sendEmailVerification(cred.user);
        } catch {
          // non-fatal if email verification rate limited
        }
        const synced = await syncUserProfileDocument(cred.user);
        setProfile(synced);
      } finally {
        setAuthLoading(false);
      }
    },
    []
  );

  const loginWithGoogle = useCallback(async () => {
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const sendResetEmail = useCallback(async (email: string) => {
    setAuthLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) return;
    await sendEmailVerification(auth.currentUser);
  }, []);

  const logout = useCallback(async () => {
    setAuthLoading(true);
    try {
      await signOut(auth);
      setProfile(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const updateUserProfile = useCallback(
    async (
      updates: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'locality' | 'themePreference'>>
    ) => {
      if (!firebaseUser) return;
      const path = `users/${firebaseUser.uid}`;
      try {
        const clean: Record<string, unknown> = { updatedAt: serverTimestamp() };
        if (updates.displayName !== undefined) clean.displayName = sanitizeText(updates.displayName, 120);
        if (updates.phone !== undefined) clean.phone = sanitizeText(updates.phone, 24);
        if (updates.locality !== undefined) clean.locality = sanitizeText(updates.locality, 120);
        if (updates.themePreference !== undefined) clean.themePreference = updates.themePreference;

        await updateDoc(doc(db, 'users', firebaseUser.uid), clean);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                ...updates,
                updatedAt: new Date().toISOString(),
              }
            : prev
        );
      } catch (error) {
        handleFirestoreError(error, OperationType.UPDATE, path);
      }
    },
    [firebaseUser]
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        profile,
        authReady,
        authLoading,
        loginWithEmail,
        registerWithEmail,
        loginWithGoogle,
        sendResetEmail,
        resendVerificationEmail,
        logout,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
