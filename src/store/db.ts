import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "asta-live";
const STORE_NAME = "state";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/** Adapter IndexedDB compatibile con `PersistStorage` di zustand (§3, §5.1.7 — offline dopo il primo load). */
export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const db = await getDb();
    const value = await db.get(STORE_NAME, name);
    return value ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    const db = await getDb();
    await db.put(STORE_NAME, value, name);
  },
  removeItem: async (name: string): Promise<void> => {
    const db = await getDb();
    await db.delete(STORE_NAME, name);
  },
};
