import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { ACCOUNTS, AUTH_HEADERS, CATEGORIES, apiPage, jsonResponse, sampleTransactions, tx } from '../fixtures/bankin.js';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts);

const DOMAIN = 'https://sync.bankin.com';

/** DataManager sans passer par le constructeur (qui ouvre un port et attend l'auth). */
const authenticatedManager = () => {
    const dm = Object.create(DataManager.prototype);
    dm.authHeader = { ...AUTH_HEADERS };
    dm.cachedData = {};
    return dm;
};

/**
 * Faux fetch piloté par une table URL → réponses successives.
 * Une réponse peut être un objet `jsonResponse(...)` ou une Error (échec réseau).
 */
const mockFetch = (routes) => {
    const calls = {};
    globalThis.fetch = vi.fn(async (url) => {
        const path = url.replace(DOMAIN, '');
        calls[path] = (calls[path] ?? 0) + 1;
        const queue = routes[path];
        if (!queue) throw new Error(`URL inattendue : ${url}`);
        const response = Array.isArray(queue) ? queue[Math.min(calls[path] - 1, queue.length - 1)] : queue;
        if (response instanceof Error) throw response;
        return response;
    });
    return calls;
};

beforeEach(() => {
    evt.cleanup();
});

describe('DataManager._fetchPaginatedData', () => {
    test('suit la pagination et envoie les en-têtes d\'authentification', async () => {
        mockFetch({
            '/v2/transactions?limit=500': jsonResponse(apiPage([tx({ id: 1 }), tx({ id: 2 })], '/v2/transactions?after=2&limit=500')),
            '/v2/transactions?after=2&limit=500': jsonResponse(apiPage([tx({ id: 3 })])),
        });
        const data = await authenticatedManager()._fetchPaginatedData('/v2/transactions?limit=500', [], 3, 0);
        expect(data.map((t) => t.id)).toEqual([1, 2, 3]);
        expect(fetch).toHaveBeenCalledWith(`${DOMAIN}/v2/transactions?limit=500`, expect.objectContaining({ headers: AUTH_HEADERS }));
    });

    test('sans authentification → AuthenticationError', async () => {
        const dm = authenticatedManager();
        dm.authHeader = null;
        await expect(dm._fetchPaginatedData('/v2/accounts', [])).rejects.toBeInstanceOf(AuthenticationError);
    });

    test.each([401, 403])('HTTP %i → AuthenticationError, sans nouvel essai', async (status) => {
        const calls = mockFetch({ '/v2/accounts': jsonResponse({}, status) });
        await expect(authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 3, 0)).rejects.toBeInstanceOf(AuthenticationError);
        expect(calls['/v2/accounts']).toBe(1);
    });

    test('erreur 500 puis succès → nouvel essai', async () => {
        const calls = mockFetch({ '/v2/accounts': [jsonResponse({}, 500), jsonResponse(apiPage(ACCOUNTS))] });
        const data = await authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 3, 0);
        expect(data).toHaveLength(2);
        expect(calls['/v2/accounts']).toBe(2);
    });

    test('erreur réseau persistante → APIError après 3 nouveaux essais', async () => {
        const calls = mockFetch({ '/v2/accounts': new Error('offline') });
        await expect(authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 3, 0)).rejects.toBeInstanceOf(APIError);
        expect(calls['/v2/accounts']).toBe(4);
    });

    test('réponse sans resources ni pagination → ValidationError', async () => {
        mockFetch({ '/v2/accounts': jsonResponse({ foo: 1 }) });
        await expect(authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 0, 0)).rejects.toBeInstanceOf(ValidationError);
    });

    // --- B3 -------------------------------------------------------------
    test('B3 — une erreur 404 n\'est pas retentée', async () => {
        const calls = mockFetch({ '/v2/accounts': jsonResponse({}, 404) });
        await expect(authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 3, 0)).rejects.toBeInstanceOf(APIError);
        expect(calls['/v2/accounts']).toBe(1);
    });

    test('B3 — une page en échec est retentée seule : aucune transaction en double', async () => {
        const calls = mockFetch({
            '/v2/transactions?limit=500': jsonResponse(apiPage([tx({ id: 1 }), tx({ id: 2 })], '/v2/transactions?page=2')),
            '/v2/transactions?page=2': [new Error('coupure'), jsonResponse({}, 503), jsonResponse(apiPage([tx({ id: 3 })]))],
        });
        const data = await authenticatedManager()._fetchPaginatedData('/v2/transactions?limit=500', [], 3, 0);
        expect(data.map((t) => t.id)).toEqual([1, 2, 3]);
        expect(calls['/v2/transactions?limit=500']).toBe(1);
        expect(calls['/v2/transactions?page=2']).toBe(3);
    });

    test('B3 — une page définitivement en échec fait échouer le chargement (pas de données partielles)', async () => {
        mockFetch({
            '/v2/transactions?limit=500': jsonResponse(apiPage([tx({ id: 1 })], '/v2/transactions?page=2')),
            '/v2/transactions?page=2': new Error('coupure'),
        });
        await expect(authenticatedManager()._fetchPaginatedData('/v2/transactions?limit=500', [], 2, 0)).rejects.toBeInstanceOf(APIError);
    });

    test('B3 — erreur 429 (trop de requêtes) retentée', async () => {
        const calls = mockFetch({ '/v2/accounts': [jsonResponse({}, 429), jsonResponse(apiPage(ACCOUNTS))] });
        await authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 3, 0);
        expect(calls['/v2/accounts']).toBe(2);
    });

    test('délai entre les tentatives croissant', async () => {
        vi.useFakeTimers();
        const calls = mockFetch({ '/v2/accounts': [new Error('a'), new Error('b'), jsonResponse(apiPage(ACCOUNTS))] });
        const pending = authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 3, 100);
        await vi.advanceTimersByTimeAsync(99);
        expect(calls['/v2/accounts']).toBe(1);
        await vi.advanceTimersByTimeAsync(1);
        expect(calls['/v2/accounts']).toBe(2);
        await vi.advanceTimersByTimeAsync(200);
        await expect(pending).resolves.toHaveLength(2);
    });

    test('réponse JSON vide → ValidationError', async () => {
        mockFetch({ '/v2/accounts': jsonResponse(null) });
        await expect(authenticatedManager()._fetchPaginatedData('/v2/accounts', [], 0, 0)).rejects.toBeInstanceOf(ValidationError);
    });
});

/** Cache de test : instance CacheStore sur le faux chrome.storage. */
const cacheWith = async (local = {}) => {
    Object.assign(chrome.storage.local._data, local);
    const store = new CacheStore();
    await store.waitForInitialization();
    return store;
};

describe('DataManager — validation et cache', () => {
    test('_validateFetchedData garde les éléments valides', () => {
        const dm = authenticatedManager();
        expect(dm._validateFetchedData([tx({ id: 1 }), { id: 2 }], 'transactions').map((t) => t.id)).toEqual([1]);
        expect(dm._validateFetchedData(CATEGORIES, 'categories')).toHaveLength(4);
        expect(dm._validateFetchedData(ACCOUNTS, 'accounts')).toHaveLength(2);
        expect(dm._validateFetchedData([1], 'inconnu')).toEqual([1]);
    });

    test('_validateFetchedData : tout invalide → ValidationError', () => {
        expect(() => authenticatedManager()._validateFetchedData([{ id: 1 }], 'accounts')).toThrow(ValidationError);
    });

    test('_fetchDataFromAPI : type inconnu → ValidationError', async () => {
        await expect(authenticatedManager()._fetchDataFromAPI('budgets')).rejects.toBeInstanceOf(ValidationError);
    });

    test('_loadDataWithCache : cache récent utilisé sans appel réseau', async () => {
        const dm = authenticatedManager();
        dm.cacheStore = await cacheWith({ cache_data_accounts: ACCOUNTS, cache_time_accounts: Date.now() });
        globalThis.fetch = vi.fn();
        const data = await dm._loadDataWithCache('accounts');
        expect(data).toHaveLength(2);
        expect(fetch).not.toHaveBeenCalled();
    });

    test('_loadDataWithCache : cache invalide → appel API', async () => {
        const dm = authenticatedManager();
        dm.cacheStore = await cacheWith({ cache_data_accounts: [{ id: 1 }], cache_time_accounts: Date.now() });
        mockFetch({ '/v2/accounts?limit=500': jsonResponse(apiPage(ACCOUNTS)) });
        expect(await dm._loadDataWithCache('accounts')).toHaveLength(2);
    });

    test('_loadDataWithCache : cache périmé → appel API puis mise en cache', async () => {
        const dm = authenticatedManager();
        dm.cacheStore = await cacheWith({ cache_data_accounts: ACCOUNTS, cache_time_accounts: Date.now() - 10 * 60 * 1000 });
        mockFetch({ '/v2/accounts?limit=500': jsonResponse(apiPage(ACCOUNTS)) });
        await dm._loadDataWithCache('accounts');
        expect(chrome.storage.local._data.cache_data_accounts).toEqual(ACCOUNTS);
        expect(dm.cacheStore.isFresh('accounts')).toBe(true);
    });

    test('B13 — le cache ne passe plus par les réglages', async () => {
        const dm = authenticatedManager();
        dm.cacheStore = await cacheWith();
        globalThis.settingClass = { setSettings: vi.fn(), getSetting: vi.fn() };
        mockFetch({ '/v2/accounts?limit=500': jsonResponse(apiPage(ACCOUNTS)) });
        await dm._loadDataWithCache('accounts');
        expect(settingClass.setSettings).not.toHaveBeenCalled();
        expect(settingClass.getSetting).not.toHaveBeenCalled();
    });

    test('refreshData vide le cache puis recharge tout', async () => {
        const dm = authenticatedManager();
        dm.cacheStore = await cacheWith({ cache_data_accounts: [{ id: 9, name: 'ancien' }], cache_time_accounts: Date.now() });
        dm.initializationPromise = Promise.resolve();
        mockFetch({
            '/v2/transactions?limit=500': jsonResponse(apiPage(sampleTransactions())),
            '/v2/categories?limit=200': jsonResponse(apiPage(CATEGORIES)),
            '/v2/accounts?limit=500': jsonResponse(apiPage(ACCOUNTS)),
        });
        const data = await dm.refreshData();
        expect(data.accounts).toEqual(ACCOUNTS);
    });
});

describe('DataManager — authentification au démarrage', () => {
    test('attend les en-têtes du service worker puis charge les données', async () => {
        mockFetch({
            '/v2/transactions?limit=500': jsonResponse(apiPage(sampleTransactions())),
            '/v2/categories?limit=200': jsonResponse(apiPage(CATEGORIES)),
            '/v2/accounts?limit=500': jsonResponse(apiPage(ACCOUNTS)),
        });
        const loaded = vi.fn();
        evt.listen('data_loaded', loaded);

        const dm = new DataManager({ cacheStore: await cacheWith() });
        const [port] = chrome.runtime.connectedPorts;
        port.onMessage.dispatch({ data: { Authorization: 'x' } }); // incomplet : ignoré
        port.onMessage.dispatch({ data: AUTH_HEADERS });
        const data = await dm.waitForInitialization();

        expect(data.transactions).toHaveLength(13);
        expect(dm.getCachedData().accounts).toHaveLength(2);
        expect(loaded).toHaveBeenCalled();
        expect(chrome.storage.local._data.cache_data_transactions).toHaveLength(13);
    });

    test('pas d\'en-têtes en 10 s → AuthenticationError', async () => {
        vi.useFakeTimers();
        const dm = new DataManager();
        const result = dm.waitForInitialization().catch((e) => e);
        await vi.advanceTimersByTimeAsync(10_000);
        expect(await result).toBeInstanceOf(AuthenticationError);
    });

    test('port déconnecté → AuthenticationError', async () => {
        const dm = new DataManager();
        chrome.runtime.connectedPorts[0].onDisconnect.dispatch();
        await expect(dm.waitForInitialization()).rejects.toBeInstanceOf(AuthenticationError);
    });

    test('refreshData sans authentification → AuthenticationError', async () => {
        const dm = authenticatedManager();
        dm.authHeader = null;
        dm.initializationPromise = Promise.resolve();
        await expect(dm.refreshData()).rejects.toBeInstanceOf(AuthenticationError);
    });
});

describe('DataManager — fonctions de regroupement', () => {
    test('createCategoryLookup : sous-catégorie → nom du parent', () => {
        const lookup = authenticatedManager().createCategoryLookup(CATEGORIES);
        expect(lookup.get(189)).toBe('Alimentation & Restau.');
        expect(lookup.size).toBe(11); // 4 parents + 7 sous-catégories
    });

    test('organizeTransactionsByCategory : transaction rangée dans sa catégorie et son parent', () => {
        const map = authenticatedManager().organizeTransactionsByCategory(sampleTransactions(), CATEGORIES);
        expect(map.get(188).map((t) => t.id)).toEqual([3, 9, 13]);
        expect(map.get(168).map((t) => t.id)).toEqual([3, 4, 9, 10, 13]);
    });

    test('filterTransactions : comptes et catégories d\'exception', () => {
        const kept = authenticatedManager().filterTransactions(sampleTransactions(), { accountsSelected: [101] });
        expect(kept.map((t) => t.id)).not.toContain(5);
        expect(kept.map((t) => t.id)).not.toContain(6);
    });

    // --- B9 ----------------------------------------------------------------
    test('B9 — filterTransactions inclut le jour de début, quel que soit le fuseau', () => {
        const kept = authenticatedManager().filterTransactions([tx({ id: 1, date: '2024-03-15' })], {
            startDate: '2024-03-15',
            endDate: '2024-03-31',
        });
        expect(kept.map((t) => t.id)).toEqual([1]);
    });
});
