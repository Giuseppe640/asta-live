/**
 * Config del progetto Firebase per la stanza condivisa (§3 del piano: sync tra dispositivi).
 * Non è un segreto: la config web di Firebase è pensata per stare nel codice client-side,
 * la sicurezza è demandata alle regole del Realtime Database, non alla segretezza della chiave.
 *
 * Finché FIREBASE_CONFIG è null la sync è disattivata e l'app funziona solo in locale
 * (comportamento identico a prima) — vedi src/features/sync/SyncView.tsx.
 */
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  databaseURL: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

export const FIREBASE_CONFIG: FirebaseWebConfig | null = {
  apiKey: "AIzaSyB3UXV8K4dBZSSIeWq6EX8eOfOZMnnvCSU",
  authDomain: "astafanta-d1373.firebaseapp.com",
  databaseURL: "https://astafanta-d1373-default-rtdb.firebaseio.com",
  projectId: "astafanta-d1373",
  storageBucket: "astafanta-d1373.firebasestorage.app",
  messagingSenderId: "735232248990",
  appId: "1:735232248990:web:2cc04ef871d3a15cd6ff8f",
};
