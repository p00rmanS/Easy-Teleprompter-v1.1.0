import { getFirebaseAuth, getFirebaseDb } from "../firebase";
import type { UserProfile } from "../types";

export async function signIn(email: string, password: string): Promise<void> {
  const [{ signInWithEmailAndPassword }, auth] = await Promise.all([import("firebase/auth"), getFirebaseAuth()]);
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutUser(): Promise<void> {
  const [{ signOut }, auth] = await Promise.all([import("firebase/auth"), getFirebaseAuth()]);
  await signOut(auth);
}

export async function fetchProfile(uid: string): Promise<UserProfile | null> {
  const [{ ref, get }, db] = await Promise.all([import("firebase/database"), getFirebaseDb()]);
  const snapshot = await get(ref(db, `v1/users/${uid}`));
  if (!snapshot.exists()) return null;
  const value = snapshot.val();
  if (!value?.employeeId || !value?.venueId || !value?.role) return null;
  return { uid, email: value.email ?? "", displayName: value.displayName ?? value.email ?? "Team member", employeeId: value.employeeId, venueId: value.venueId, role: value.role };
}

export async function touchLastLogin(uid: string): Promise<void> {
  const [{ ref, update, serverTimestamp }, db] = await Promise.all([import("firebase/database"), getFirebaseDb()]);
  await update(ref(db, `v1/users/${uid}`), { lastLoginAt: serverTimestamp() });
}
