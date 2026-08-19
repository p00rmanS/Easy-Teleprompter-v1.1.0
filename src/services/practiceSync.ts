import type { DataSnapshot } from "firebase/database";
import type { PracticeResult } from "../core";
import type { CloudPracticeResult } from "../types";
import { getFirebaseDb } from "../firebase";

export type SyncContext = { venueId: string; employeeId: string; employeeName: string; uid: string; scriptId: string | null; scriptTitle: string };
export type Unsubscribe = () => void;

export function buildCloudPracticeResult(result: PracticeResult, ctx: SyncContext): CloudPracticeResult {
  return { ...result, ...ctx };
}

export async function syncPracticeResult(result: PracticeResult, ctx: SyncContext): Promise<void> {
  const cloudResult = buildCloudPracticeResult(result, ctx);
  const [{ ref, push, serverTimestamp }, db] = await Promise.all([import("firebase/database"), getFirebaseDb()]);
  await push(ref(db, `v1/practiceResults/${ctx.venueId}`), { ...cloudResult, syncedAt: serverTimestamp() });
}

function withId(resultId: string, result: CloudPracticeResult): CloudPracticeResult {
  return { ...result, resultId };
}

function flatten(snapshot: DataSnapshot, nested: boolean): CloudPracticeResult[] {
  const value = snapshot.val() ?? {};
  if (!nested) return Object.entries(value as Record<string, CloudPracticeResult>).map(([resultId, result]) => withId(resultId, result));
  return Object.values(value as Record<string, Record<string, CloudPracticeResult>>)
    .flatMap((venue) => Object.entries(venue ?? {}))
    .map(([resultId, result]) => withId(resultId, result));
}

async function subscribe(path: string, nested: boolean, onData: (results: CloudPracticeResult[]) => void): Promise<Unsubscribe> {
  const [{ ref, onValue, off }, db] = await Promise.all([import("firebase/database"), getFirebaseDb()]);
  const target = ref(db, path);
  const handler = (snapshot: DataSnapshot) => onData(flatten(snapshot, nested));
  onValue(target, handler);
  return () => off(target, "value", handler);
}

export function subscribeVenueResults(venueId: string, onData: (results: CloudPracticeResult[]) => void): Promise<Unsubscribe> {
  return subscribe(`v1/practiceResults/${venueId}`, false, onData);
}

export function subscribeAllResults(onData: (results: CloudPracticeResult[]) => void): Promise<Unsubscribe> {
  return subscribe("v1/practiceResults", true, onData);
}
