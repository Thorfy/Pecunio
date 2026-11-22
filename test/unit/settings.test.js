import { beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createFakeChrome } from '../helpers/fake-chrome.js';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts);

beforeEach(() => {
    evt.cleanup();
});

const settingsWith = async (local) => {
    globalThis.chrome = createFakeChrome({ local });
    const settings = new Settings();
    await settings.waitForInitialization();
    return settings;
};

describe('Settings', () => {
    test('charge les réglages connus depuis chrome.storage.local', async () => {
        const settings = await settingsWith({ startDate: '2024-01-01', isBlurry: true, autreCle: 'x' });
        expect(settings.getSetting('startDate')).toBe('2024-01-01');
        expect(settings.getAllSettings()).toEqual({ startDate: '2024-01-01', isBlurry: true });
        expect(settings.hasSetting('isBlurry')).toBe(true);
        expect(settings.hasSetting('endDate')).toBe(false);
        expect(settings.getSettingWithDefault('endDate', '2024-12-31')).toBe('2024-12-31');
    });

    test('getAllSettings renvoie une copie', async () => {
        const settings = await settingsWith({ startDate: '2024-01-01' });
        settings.getAllSettings().startDate = 'modifié';
        expect(settings.getSetting('startDate')).toBe('2024-01-01');
    });

    test('setSettings enregistre, recharge et prévient', async () => {
        const settings = await settingsWith({});
        const updated = vi.fn();
        evt.listen('settings_updated', updated);
        await settings.setSettings({ startDate: '2024-02-01', accountsSelected: [101] });
        expect(chrome.storage.local._data).toMatchObject({ startDate: '2024-02-01', accountsSelected: [101] });
        expect(settings.getSetting('accountsSelected')).toEqual([101]);
        expect(updated).toHaveBeenCalled();
    });

    test('setSettings refuse les valeurs de mauvais type', async () => {
        const settings = await settingsWith({});
        await settings.setSettings({ accountsSelected: 101, isBlurry: 'oui', noEndDate: 'non', endDate: '2024-03-01' });
        expect(chrome.storage.local._data).toEqual({ endDate: '2024-03-01' });
    });

    test('setSetting et removeSetting', async () => {
        const settings = await settingsWith({});
        await settings.setSetting('chartType', 'line');
        expect(settings.getSetting('chartType')).toBe('line');
        await settings.removeSetting('chartType');
        expect(settings.getSetting('chartType')).toBeUndefined();
        expect(chrome.storage.local._data.chartType).toBeUndefined();
    });

    test('lecture impossible → valeurs par défaut et erreur remontée', async () => {
        globalThis.chrome = createFakeChrome();
        chrome.storage.local.get.mockImplementation((_keys, cb) => {
            chrome.runtime.lastError = { message: 'stockage indisponible' };
            cb({});
            chrome.runtime.lastError = undefined;
        });
        const settings = new Settings();
        await expect(settings.waitForInitialization()).rejects.toThrow('stockage indisponible');
        expect(settings.getSetting('accounts')).toEqual([]);
    });

    test('lecture avant initialisation : avertissement', () => {
        const settings = new Settings();
        expect(settings.getSetting('startDate')).toBeNull();
        expect(console.warn).toHaveBeenCalled();
    });

    // --- B13 ------------------------------------------------------------
    test('B13 — effacer les réglages ne touche ni au cache, ni aux catégories masquées, ni au rapport', async () => {
        const settings = await settingsWith({
            startDate: '2024-01-01',
            noEndDate: true,
            Logement: true,
            pecunio_report_params: {},
            cache_data_transactions: [],
        });
        await settings.clearAllSettings();
        expect(chrome.storage.local._data).toEqual({ Logement: true, pecunio_report_params: {}, cache_data_transactions: [] });
        expect(settings.getAllSettings()).toEqual({});
    });

    test('B13 — le cache de l\'API ne fait pas partie des réglages', async () => {
        const settings = await settingsWith({ startDate: '2024-01-01', cache_data_transactions: [1, 2], cache_time_transactions: 1 });
        expect(settings.getAllSettings()).toEqual({ startDate: '2024-01-01' });
    });
});

describe('Config', () => {
    test('clés de cache', () => {
        expect(Config.getCacheKey('transactions')).toBe('cache_data_transactions');
        expect(Config.getCacheTimeKey('accounts')).toBe('cache_time_accounts');
    });

    test('catégories d\'exception', () => {
        expect(Config.isExceptionCategory(326)).toBe(true);
        expect(Config.isExceptionCategory(188)).toBe(false);
    });

    test('noms de mois', () => {
        expect(Config.getMonthName(1)).toBe('Jan');
        expect(Config.getFullMonthName(12)).toBe('December');
        expect(Config.getMonthName(13)).toBe('');
        expect(Config.getFullMonthName(-1)).toBe('');
    });

    test('moyenne du premier jeu de données (annotation des graphiques)', () => {
        expect(Config.calculateAverage({ chart: { data: { datasets: [{ data: [1, 2, 3] }] } } })).toBe(2);
    });

    test('URL des ressources de l\'extension', () => {
        expect(Config.getAssetURL('ICON')).toBe('chrome-extension://pecunio-test/asset/icon.png');
    });

    test('isBlurry lit l\'état global du masquage', () => {
        window.__pecunioIsBlurry = true;
        expect(Config.isBlurry()).toBe(true);
        window.__pecunioIsBlurry = false;
        expect(Config.isBlurry()).toBe(false);
    });

    test('toDateInputValue : date invalide → aujourd\'hui', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date('2024-03-15T12:00:00Z'));
        expect(Config.toDateInputValue('pas une date')).toBe('2024-03-15');
        expect(Config.toDateInputValue('2024-01-31')).toBe('2024-01-31');
    });

    // --- B9 ----------------------------------------------------------------
    test('B9 — la date du jour est correcte juste après minuit, quel que soit le fuseau', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2024, 2, 15, 0, 30)); // 15 mars, 00h30 heure locale
        expect(Config.toDateInputValue(null)).toBe('2024-03-15');
        expect(Config.toDateInputValue(new Date(2024, 2, 15))).toBe('2024-03-15');
    });
});
