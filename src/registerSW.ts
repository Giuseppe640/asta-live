import { registerSW } from "virtual:pwa-register";

/**
 * Aggiorna sempre in automatico, senza chiedere conferma: appena un service worker nuovo è
 * pronto (dopo un deploy) ricarica la pagina da solo. Senza questo, il registerSW.js iniettato
 * di default registra il worker nuovo ma lascia in esecuzione quello vecchio finché l'utente
 * non ricarica due volte di sua iniziativa — un deploy sembrava "non arrivare mai".
 */
export function setupAutoUpdate() {
  const updateSW = registerSW({
    onNeedRefresh() {
      updateSW(true);
    },
  });
}
