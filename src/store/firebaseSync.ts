import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, onChildAdded, onValue, orderByChild, push as dbPush, query, ref, set as dbSet, type Database } from "firebase/database";
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
 * Svuota lo storico eventi della stanza su Firebase. Serve ad "Azzera asta": senza questo,
 * un dispositivo che si ricollega (o ricarica la pagina, che riaggancia da sola l'ultima
 * stanza) riceve di nuovo TUTTO lo storico via onChildAdded e resuscita le assegnazioni
 * cancellate solo in locale — l'azzeramento deve valere anche per la stanza condivisa.
 */
export function clearRoom(roomCode: string): void {
  const database = getDb();
  if (!database) return;
  void dbSet(ref(database, eventsPath(roomCode)), null);
}

/**
 * Si iscrive alla stanza: `onEvent` viene chiamato per ogni evento già presente (storico,
 * in ordine cronologico di `createdAt`) e poi per ogni nuovo evento che arriva da qualsiasi
 * dispositivo, incluso il proprio (lo store deduplica per id).
 *
 * La chiave su Firebase è `event.id` (un UUID casuale, per poter riscrivere lo stesso evento
 * senza duplicarlo), NON una push-key cronologica: senza `orderByChild("createdAt")`, Firebase
 * consegna i figli ordinati per chiave, cioè in ordine essenzialmente casuale rispetto a quando
 * sono davvero avvenuti. Per un dispositivo che si collega a metà asta e riceve tutto lo storico
 * in un colpo solo, questo bastava a mescolare l'ordine di replay — assign/unassign dello stesso
 * giocatore applicati fuori ordine generavano conflitti fasulli e, in alcuni casi, uno stato
 * finale sbagliato (non l'ultimo evento vero applicato per ultimo).
 */
export function subscribeToRoom(roomCode: string, onEvent: (event: AuctionEvent) => void): () => void {
  const database = getDb();
  if (!database) return () => {};
  const eventsRef = query(ref(database, eventsPath(roomCode)), orderByChild("createdAt"));
  const unsubscribe = onChildAdded(eventsRef, (snapshot) => {
    const event = snapshot.val() as AuctionEvent | null;
    if (event) onEvent(event);
  });
  return () => unsubscribe();
}

/**
 * Stato REALE della connessione al server Firebase (non "abbiamo provato ad iscriverci", che è
 * sempre vero appena si chiama subscribeToRoom). `.info/connected` è un path speciale gestito
 * dall'SDK stesso: cala a false appena la connessione cade (rete persa, scheda sospesa dal
 * sistema su mobile...) e torna true da sola alla riconnessione, senza bisogno di ricollegarsi
 * manualmente. Necessario perché la UI possa mostrare "connesso" solo quando è vero, non solo
 * quando ci si è iscritti una volta.
 */
export function subscribeToConnectionState(onChange: (connected: boolean) => void): () => void {
  const database = getDb();
  if (!database) return () => {};
  const connectedRef = ref(database, ".info/connected");
  const unsubscribe = onValue(connectedRef, (snapshot) => {
    onChange(snapshot.val() === true);
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
