/**
 * Evt - Émetteur d'événements en mémoire, propre à une page (content script,
 * popup ou rapport). Voir js/core/events.js pour l'instance partagée.
 *
 * Remplace l'ancienne implémentation à base de CustomEvent sur `document`
 * (bug B15) : la page Bankin ne peut plus ni voir ni déclencher les
 * événements de Pecunio, `removeListener` fonctionne, et un événement déjà
 * émis n'est plus rejoué aux écouteurs ajoutés ensuite.
 *
 * Événements utilisés :
 * - `data_loaded` : DataManager a chargé les données (cache ou API) ;
 * - `settings_reloaded` : Settings a relu les préférences.
 */
import { Logger } from './Logger.js';

export class Evt {
    /** @type {Map<string, Set<{ callback: Function, once: boolean }>>} */
    #listeners = new Map();

    /**
     * Écoute un événement.
     * @param {string} eventName
     * @param {(data: unknown) => void} callback reçoit les données passées à dispatch
     * @param {{ once?: boolean }} [options] `once` : écouteur retiré après le premier appel
     * @returns {() => void} fonction qui retire l'écouteur
     */
    listen(eventName, callback, { once = false } = {}) {
        if (!eventName || typeof callback !== 'function') {
            Logger.error('[Evt] Paramètres invalides pour listen :', eventName);
            return () => {};
        }
        if (!this.#listeners.has(eventName)) this.#listeners.set(eventName, new Set());
        const entry = { callback, once };
        this.#listeners.get(eventName).add(entry);
        return () => this.#listeners.get(eventName)?.delete(entry);
    }

    /**
     * Retire un écouteur.
     * @param {string} eventName
     * @param {Function} callback
     */
    removeListener(eventName, callback) {
        const entries = this.#listeners.get(eventName);
        if (!entries) return;
        for (const entry of entries) {
            if (entry.callback === callback) entries.delete(entry);
        }
    }

    /**
     * Émet un événement : les écouteurs sont appelés immédiatement, dans l'ordre
     * d'ajout. L'erreur d'un écouteur n'empêche pas les suivants d'être appelés.
     * @param {string} eventName
     * @param {unknown} [data]
     */
    dispatch(eventName, data) {
        if (!eventName) {
            Logger.error('[Evt] Nom d\'événement invalide');
            return;
        }
        const entries = this.#listeners.get(eventName);
        if (!entries) return;
        for (const entry of [...entries]) {
            if (entry.once) entries.delete(entry);
            try {
                entry.callback(data);
            } catch (error) {
                Logger.error(`[Evt] Erreur dans un écouteur de « ${eventName} » :`, error);
            }
        }
    }

    /** Nombre d'écouteurs d'un événement. */
    listenerCount(eventName) {
        return this.#listeners.get(eventName)?.size ?? 0;
    }

    /** Retire tous les écouteurs (tests). */
    cleanup() {
        this.#listeners.clear();
    }
}
