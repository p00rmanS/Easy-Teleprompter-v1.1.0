import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { User } from "firebase/auth";
import { getFirebaseAuth, isFirebaseConfigured } from "../firebase";
import { fetchProfile, signIn as authSignIn, signOutUser, touchLastLogin } from "./authService";
import type { UserProfile } from "../types";

type Status = "unavailable" | "loading" | "signed-out" | "signed-in";
type SignInResult = { ok: true } | { ok: false; reason: "invalid-credentials" | "not-provisioned" };
type AuthState = { status: Status; user: User | null; profile: UserProfile | null };

type AuthValue = AuthState & { signIn(email: string, password: string): Promise<SignInResult>; signOut(): Promise<void> };

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => ({ status: isFirebaseConfigured() ? "loading" : "unavailable", user: null, profile: null }));

  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const [{ onAuthStateChanged }, auth] = await Promise.all([import("firebase/auth"), getFirebaseAuth()]);
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (cancelled) return;
        if (!user) { setState({ status: "signed-out", user: null, profile: null }); return; }
        const profile = await fetchProfile(user.uid);
        if (cancelled) return;
        if (!profile) { setState({ status: "signed-out", user: null, profile: null }); signOutUser().catch(() => undefined); return; }
        setState({ status: "signed-in", user, profile });
      });
    })();
    return () => { cancelled = true; unsubscribe?.(); };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<SignInResult> => {
    try {
      await authSignIn(email, password);
    } catch {
      return { ok: false, reason: "invalid-credentials" };
    }
    const auth = await getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) return { ok: false, reason: "invalid-credentials" };
    const profile = await fetchProfile(user.uid);
    if (!profile) {
      await signOutUser();
      setState({ status: "signed-out", user: null, profile: null });
      return { ok: false, reason: "not-provisioned" };
    }
    touchLastLogin(user.uid).catch(() => undefined);
    setState({ status: "signed-in", user, profile });
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await signOutUser();
    setState({ status: "signed-out", user: null, profile: null });
  }, []);

  const value = useMemo<AuthValue>(() => ({ ...state, signIn, signOut }), [state, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
