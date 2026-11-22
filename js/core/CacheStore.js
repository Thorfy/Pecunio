/**
 * CacheStore - Cache des données de l'API Bankin (transactions, catégories, comptes)
 *
 * Séparé des préférences utilisateur (Settings) pour que l'enregistrement d'un
 * réglage ne relise pas toutes les transactions, et que la réinitialisation
 * des réglages n'efface pas le cache (et inversement) (bug B13).
 * Clés chrome.storage inchangées : cache_data_* / cache_time_*.
 */
class CacheStore {
    static DATA_TYPES = ['transactions', 'categories', 'accounts'];

    static getAllKeys(dataTypes = CacheStore.DATA_TYPES) {
        return dataTypes.flatMap((type) => [Config.getCacheKey(type), Config.getCacheTimeKey(type)]);
    }

    constructor() {
        this.cache = {};
        this.isInitialized = false;
        this.initializationPromise = this.load()
            .catch((error) => {
                console.error('[CacheStore] Initialization failed:', error);
                this.cache = {};
            })
            .finally(() => {
                this.isInitialized = true;
            });
    }

    waitForInitialization() {
        return this.initializationPromise;
    }

    /** Relit le cache depuis chrome.storage.local. */
    async load() {
        this.cache = await chrome.storage.local.get(CacheStore.getAllKeys());
    }

    /**
     * @param {'transactions'|'categories'|'accounts'} dataType
     * @returns {any} données en cache ou null
     */
    get(dataType) {
        return this.cache[Config.getCacheKey(dataType)] ?? null;
    }

    /** @returns {number|null} horodatage de mise en cache */
    getTime(dataType) {
        const time = this.cache[Config.getCacheTimeKey(dataType)];
        return typeof time === 'number' ? time : null;
    }

    /** Le cache est-il présent et plus récent que `maxAgeMs` ? */
    isFresh(dataType, maxAgeMs = Config.API.CACHE_DURATION) {
        const time = this.getTime(dataType);
        return this.get(dataType) != null && time != null && Date.now() - time < maxAgeMs;
    }

    async set(dataType, data) {
        const payload = {
            [Config.getCacheKey(dataType)]: data,
            [Config.getCacheTimeKey(dataType)]: Date.now(),
        };
        await chrome.storage.local.set(payload);
        Object.assign(this.cache, payload);
    }

    async remove(dataType) {
        await this.clear([dataType]);
    }

    /** @param {string[]} [dataTypes] */
    async clear(dataTypes = CacheStore.DATA_TYPES) {
        const keys = CacheStore.getAllKeys(dataTypes);
        await chrome.storage.local.remove(keys);
        for (const key of keys) delete this.cache[key];
    }
}
