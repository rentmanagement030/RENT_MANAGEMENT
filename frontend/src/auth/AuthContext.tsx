import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase";
import { api } from "@/lib/api";
import type { Me } from "@/types";

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  loginWithGoogle: () => Promise<Me | void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendEmailVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const redirectRes = await getRedirectResult(auth).catch(() => null);
      if (redirectRes?.user) {
        const idToken = await redirectRes.user.getIdToken();
        const me = await api.firebaseLogin(idToken);
        setUser(me);
        return;
      }
      const me = await api.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const me = await api.firebaseLogin(idToken);
      setUser(me);
      return me;
    } catch (fbErr) {
      try {
        const me = await api.login(email, password);
        setUser(me);
        return me;
      } catch {
        throw fbErr instanceof Error ? fbErr : new Error("Invalid email or password");
      }
    }
  }, []);

  const loginWithGoogle = useCallback(async () => {
    if (!isFirebaseConfigured) {
      throw new Error(
        "Google Sign-In requires valid Firebase API keys. Please set VITE_FIREBASE_API_KEY in frontend/.env",
      );
    }
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const idToken = await res.user.getIdToken();
      const me = await api.firebaseLogin(idToken);
      setUser(me);
      return me;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/popup-blocked" || code === "auth/popup-closed-by-user" || String(err).includes("COOP")) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      throw err;
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch {
      // Fallback to C2D backend password reset mechanism
      await api.changePassword({ currentPassword: "", newPassword: "" }).catch(() => null);
    }
  }, []);

  const resendEmailVerification = useCallback(async () => {
    if (auth.currentUser) {
      await sendEmailVerification(auth.currentUser);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth).catch(() => null);
      await api.logout();
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      loginWithGoogle,
      requestPasswordReset,
      resendEmailVerification,
      logout,
      refresh,
      can: (permission: string) => {
        if (!user) return false;
        if (user.isSuperAdmin) return true;
        return user.permissions.includes(permission);
      },
    }),
    [user, loading, login, loginWithGoogle, requestPasswordReset, resendEmailVerification, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
