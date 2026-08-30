import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, onChildAdded, push as dbPush, ref, set as dbSet, type Database } from "firebase/database";
import { FIREBASE_CONFIG } from "./firebaseConfig";
import type { AuctionEvent } from "../types";

let app: FirebaseApp | null = null;
let db: Database | null = null;

export function isSyncConfigured(): boolean {
  return FIREBASE_CONFIG != null;
}

function getDb(): Database | null {
  if (!FIREBASE_CONFIG) return null;
  if (!db) {
    app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
  }
  return db;
}

function eventsPath(roomCode: string): string {
  return `rooms/${roomCode}/events`;
}

export function pushEventToRoom(roomCode: string, event: AuctionEvent): void {
  const database = getDb();
  if (!database) return;
  // chiave = event.id: idempotente, un evento riscritto due volte non duplica nulla
  void dbSet(ref(database, `${eventsPath(roomCode)}/${event.id}`), event);
}

/**
 * Si iscrive alla stanza: `onEvent` viene chiamato per ogni evento già presente (storico,
 * in ordine di scrittura) e poi per ogni nuovo evento che arriva da qualsiasi dispositivo,
 * incluso il proprio (lo store deduplica per id).
 */
export function subscribeToRoom(roomCode: string, onEvent: (event: AuctionEvent) => void): () => void {
  const database = getDb();
  if (!database) return () => {};
  const eventsRef = ref(database, eventsPath(roomCode));
  const unsubscribe = onChildAdded(eventsRef, (snapshot) => {
    const event = snapshot.val() as AuctionEvent | null;
    if (event) onEvent(event);
  });
  return () => unsubscribe();
}

/** Solo per generare un codice stanza leggibile suggerito, mai per garantire unicità crittografica. */
export function suggestRoomCode(): string {
  const database = getDb();
  if (database) {
    const key = dbPush(ref(database, "rooms")).key;
    if (key) return key.replace(/[^a-zA-Z0-9]/g, "").slice(-8).toLowerCase();
  }
  return Math.random().toString(36).slice(2, 10);
}
