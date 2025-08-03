/**
 * Evt - Gestionnaire d'événements centralisé
 * Responsable de la communication entre les différents composants de l'extension
 */
class Evt {
    constructor() {
        this._eventDispatched = {};
        this._key = 'Event_';
        this._listeners = new Map();
        this._debugMode = false; // Peut être activé pour le debug
    }

    /**
     * Écoute un événement
     * @param {string} eventName - Nom de l'événement
     * @param {Function} callback - Fonction à exécuter
     * @param {boolean} once - Si true, l'écouteur ne s'exécute qu'une fois
     * @param {boolean} useChromeMessaging - Si true, utilise chrome.runtime.sendMessage
     */
    listen(eventName, callback, once = false, useChromeMessaging = false) {
        if (!eventName || typeof callback !== 'function') {
            console.error('[Evt] Invalid parameters for listen:', { eventName, callback });
            return;
        }

        const fullEventName = this._key + eventName;
        
        // Vérifier si l'événement a déjà été dispatché
        if (this._eventDispatched[eventName]) {
            this._log('Event already dispatched, executing callback immediately:', eventName);
            try {
                callback();
            } catch (error) {
                console.error('[Evt] Error in immediate callback for event:', eventName, error);
            }
            return;
        }

        // Stocker l'écouteur pour pouvoir le supprimer plus tard
        if (!this._listeners.has(fullEventName)) {
            this._listeners.set(fullEventName, []);
        }
        this._listeners.get(fullEventName).push({ callback, once });

        // Ajouter l'écouteur DOM
        const domCallback = (event) => {
            try {
                callback(event);
                
                // Supprimer l'écouteur si once = true
                if (once) {
                    this._removeListener(fullEventName, callback);
                }
            } catch (error) {
                console.error('[Evt] Error in event callback for event:', eventName, error);
            }
        };

        document.addEventListener(fullEventName, domCallback, { once });

        this._log('Listener added for event:', eventName);
    }

    /**
     * Dispatch un événement
     * @param {string} eventName - Nom de l'événement
     * @param {boolean} useChromeMessaging - Si true, utilise chrome.runtime.sendMessage
     * @param {any} data - Données à passer avec l'événement
     */
    dispatch(eventName, useChromeMessaging = false, data = null) {
        if (!eventName) {
            console.error('[Evt] Invalid event name for dispatch');
            return;
        }

        this._eventDispatched[eventName] = true;
        const fullEventName = this._key + eventName;
        
        this._log('Dispatching event:', eventName, data);

        try {
            // Créer un événement personnalisé avec des données
            const customEvent = new CustomEvent(fullEventName, {
                detail: data,
                bubbles: true,
                cancelable: true
            });

            document.dispatchEvent(customEvent);
        } catch (error) {
            console.error('[Evt] Error dispatching event:', eventName, error);
        }
    }

    /**
     * Supprime un écouteur spécifique
     * @param {string} eventName - Nom de l'événement
     * @param {Function} callback - Fonction à supprimer
     */
    removeListener(eventName, callback) {
        const fullEventName = this._key + eventName;
        this._removeListener(fullEventName, callback);
    }

    /**
     * Supprime tous les écouteurs d'un événement
     * @param {string} eventName - Nom de l'événement
     */
    removeAllListeners(eventName) {
        const fullEventName = this._key + eventName;
        this._listeners.delete(fullEventName);
        this._log('All listeners removed for event:', eventName);
    }

    /**
     * Vérifie si un événement a des écouteurs
     * @param {string} eventName - Nom de l'événement
     * @returns {boolean}
     */
    hasListeners(eventName) {
        const fullEventName = this._key + eventName;
        return this._listeners.has(fullEventName) && this._listeners.get(fullEventName).length > 0;
    }

    /**
     * Retourne le nombre d'écouteurs pour un événement
     * @param {string} eventName - Nom de l'événement
     * @returns {number}
     */
    getListenerCount(eventName) {
        const fullEventName = this._key + eventName;
        return this._listeners.has(fullEventName) ? this._listeners.get(fullEventName).length : 0;
    }

    /**
     * Active le mode debug
     */
    enableDebug() {
        this._debugMode = true;
        console.log('[Evt] Debug mode enabled');
    }

    /**
     * Désactive le mode debug
     */
    disableDebug() {
        this._debugMode = false;
        console.log('[Evt] Debug mode disabled');
    }

    /**
     * Nettoie tous les écouteurs et événements dispatchés
     */
    cleanup() {
        this._listeners.clear();
        this._eventDispatched = {};
        this._log('Cleanup completed');
    }

    /**
     * Méthode privée pour supprimer un écouteur
     */
    _removeListener(fullEventName, callback) {
        if (!this._listeners.has(fullEventName)) {
            return;
        }

        const listeners = this._listeners.get(fullEventName);
        const index = listeners.findIndex(listener => listener.callback === callback);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            this._log('Listener removed for event:', fullEventName.replace(this._key, ''));
        }
    }

    /**
     * Méthode privée pour les logs de debug
     */
    _log(...args) {
        if (this._debugMode) {
            console.log('[Evt]', ...args);
        }
    }

    /**
     * Retourne les statistiques des événements
     */
    getStats() {
        const stats = {
            totalEvents: Object.keys(this._eventDispatched).length,
            totalListeners: 0,
            eventsWithListeners: 0
        };

        for (const [eventName, listeners] of this._listeners) {
            stats.totalListeners += listeners.length;
            if (listeners.length > 0) {
                stats.eventsWithListeners++;
            }
        }

        return stats;
    }
}
