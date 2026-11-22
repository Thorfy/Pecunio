/**
 * CategoryVisibility - Catégories masquées dans les graphiques
 *
 * La liste est stockée dans la préférence `hiddenCategories` (voir
 * SettingsSchema). Un clic dans la légende du graphique temporel la met à
 * jour ; le graphique de comparaison budget écoute ses changements.
 */

export const HIDDEN_CATEGORIES_KEY = 'hiddenCategories';

/**
 * Noms des catégories masquées.
 * @param {chrome.storage.StorageArea} [storage]
 * @returns {Promise<Set<string>>}
 */
export async function getHiddenCategories(storage = chrome.storage.local) {
    try {
        const stored = await storage.get(HIDDEN_CATEGORIES_KEY);
        const list = stored[HIDDEN_CATEGORIES_KEY];
        return new Set(Array.isArray(list) ? list.filter((name) => typeof name === 'string') : []);
    } catch (error) {
        console.warn('[CategoryVisibility] Lecture impossible :', error);
        return new Set();
    }
}

/**
 * Masque ou affiche une catégorie.
 * @param {string} name
 * @param {boolean} hidden
 * @param {chrome.storage.StorageArea} [storage]
 */
export async function setCategoryHidden(name, hidden, storage = chrome.storage.local) {
    const current = await getHiddenCategories(storage);
    if (current.has(name) === hidden) return;
    if (hidden) current.add(name);
    else current.delete(name);
    await storage.set({ [HIDDEN_CATEGORIES_KEY]: [...current].sort() });
}

/**
 * Appelle `callback` à chaque changement de la liste.
 * @param {() => void} callback
 * @returns {() => void} fonction de désabonnement
 */
export function watchHiddenCategories(callback) {
    /** @type {(changes: Record<string, chrome.storage.StorageChange>, areaName: string) => void} */
    const listener = (changes, areaName) => {
        if (areaName === 'local' && HIDDEN_CATEGORIES_KEY in changes) callback();
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
}
