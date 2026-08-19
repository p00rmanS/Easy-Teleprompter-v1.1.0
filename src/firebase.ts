import type { FirebaseApp } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Database } from "firebase/database";

const CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(CONFIG.apiKey && CONFIG.authDomain && CONFIG.databaseURL && CONFIG.projectId && CONFIG.appId);
}

let appPromise: Promise<FirebaseApp> | null = null;
let authPromise: Promise<Auth> | null = null;
let dbPromise: Promise<Database> | null = null;

async function getApp(): Promise<FirebaseApp> {
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp }) => initializeApp(CONFIG));
  }
  return appPromise;
}

export async function getFirebaseAuth(): Promise<Auth> {
  if (!authPromise) {
    authPromise = (async () => {
      const [app, { getAuth, connectAuthEmulator }] = await Promise.all([getApp(), import("firebase/auth")]);
      const auth = getAuth(app);
      if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
        connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
      }
      return auth;
    })();
  }
  return authPromise;
}

export async function getFirebaseDb(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const [app, { getDatabase, connectDatabaseEmulator }] = await Promise.all([getApp(), import("firebase/database")]);
      const db = getDatabase(app);
      if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
        connectDatabaseEmulator(db, "localhost", 9000);
      }
      return db;
    })();
  }
  return dbPromise;
}
