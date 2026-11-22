import { describe, expect, test, vi } from 'vitest';
import { ACCOUNTS } from '../fixtures/bankin.js';
import { createFakeChrome } from '../helpers/fake-chrome.js';
import { CacheStore } from '../../js/core/CacheStore.js';

const storeWith = async (local) => {
    globalThis.chrome = createFakeChrome({ local });
    const store = new CacheStore();
    await store.waitForInitialization();
    return store;
};

describe('CacheStore', () => {
    test('charge uniquement les clés de cache', async () => {
        const store = await storeWith({ cache_data_accounts: ACCOUNTS, cache_time_accounts: 123, startDate: '2024-01-01' });
        expect(store.get('accounts')).toEqual(ACCOUNTS);
        expect(store.getTime('accounts')).toBe(123);
        expect(store.cache.startDate).toBeUndefined();
        expect(store.get('transactions')).toBeNull();
        expect(store.isInitialized).toBe(true);
    });

    test('fraîcheur du cache', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(1_000_000);
        const store = await storeWith({ cache_data_accounts: ACCOUNTS, cache_time_accounts: 1_000_000 - 60_000, cache_time_categories: 'x' });
        expect(store.isFresh('accounts')).toBe(true);
        expect(store.isFresh('accounts', 30_000)).toBe(false);
        expect(store.isFresh('transactions')).toBe(false);
        expect(store.getTime('categories')).toBeNull();
    });

    test('set enregistre les données et l\'heure', async () => {
        const store = await storeWith({});
        await store.set('accounts', ACCOUNTS);
        expect(chrome.storage.local._data.cache_data_accounts).toEqual(ACCOUNTS);
        expect(typeof chrome.storage.local._data.cache_time_accounts).toBe('number');
        expect(store.isFresh('accounts')).toBe(true);
    });

    test('remove et clear ne touchent qu\'aux types demandés', async () => {
        const store = await storeWith({
            cache_data_accounts: ACCOUNTS,
            cache_time_accounts: 1,
            cache_data_transactions: [],
            cache_time_transactions: 1,
            startDate: '2024-01-01',
        });
        await store.remove('accounts');
        expect(store.get('accounts')).toBeNull();
        expect(chrome.storage.local._data).toEqual({ cache_data_transactions: [], cache_time_transactions: 1, startDate: '2024-01-01' });
        await store.clear();
        expect(chrome.storage.local._data).toEqual({ startDate: '2024-01-01' });
    });

    test('lecture impossible : cache vide, initialisation terminée quand même', async () => {
        globalThis.chrome = createFakeChrome();
        chrome.storage.local.get.mockRejectedValueOnce(new Error('indisponible'));
        const store = new CacheStore();
        await store.waitForInitialization();
        expect(store.isInitialized).toBe(true);
        expect(store.get('accounts')).toBeNull();
    });
});
