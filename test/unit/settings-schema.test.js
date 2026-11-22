// Schéma des préférences, migration du stockage et catégories masquées.
import { describe, expect, test, vi } from 'vitest';
import { createFakeChrome } from '../helpers/fake-chrome.js';
import {
    CURRENT_VERSION,
    SETTING_NAMES,
    defaultSettings,
    isValidSetting,
    migrateSettings,
} from '../../js/core/SettingsSchema.js';
import { getHiddenCategories, setCategoryHidden, watchHiddenCategories } from '../../js/core/CategoryVisibility.js';

describe('SettingsSchema — schéma', () => {
    test('valeurs par défaut pour chaque préférence', () => {
        expect(defaultSettings()).toEqual({
            startDate: null,
            endDate: null,
            noEndDate: false,
            accountsSelected: null,
            isBlurry: false,
            chartType: 'bar',
            hiddenCategories: [],
        });
        expect(Object.keys(defaultSettings())).toEqual(SETTING_NAMES);
    });

    test('les valeurs par défaut sont des copies', () => {
        defaultSettings().hiddenCategories.push('Logement');
        expect(defaultSettings().hiddenCategories).toEqual([]);
    });

    test.each([
        ['startDate', '2024-01-31', true],
        ['startDate', null, true],
        ['startDate', '31/01/2024', false],
        ['endDate', 20240131, false],
        ['noEndDate', true, true],
        ['noEndDate', 'non', false],
        ['accountsSelected', [101, 102], true],
        ['accountsSelected', null, true],
        ['accountsSelected', 101, false],
        ['accountsSelected', ['101'], false],
        ['isBlurry', false, true],
        ['chartType', 'line', true],
        ['chartType', 'pie', false],
        ['hiddenCategories', ['Logement'], true],
        ['hiddenCategories', [1], false],
        ['accounts', [], false], // réglage supprimé (D14)
        ['inconnu', true, false],
    ])('%s = %j → valide : %s', (name, value, valid) => {
        expect(isValidSetting(name, value)).toBe(valid);
    });
});

describe('SettingsSchema — migration v1 → v2 (D14)', () => {
    const migrate = async (local) => {
        globalThis.chrome = createFakeChrome({ local });
        const result = await migrateSettings();
        return { result, data: chrome.storage.local._data };
    };

    test('visibilité des catégories regroupée dans hiddenCategories', async () => {
        const { result, data } = await migrate({
            Logement: true,
            'Alimentation & Restau.': false,
            Transports: true,
            accounts: [{ id: 1 }],
            startDate: '2024-01-01',
            isBlurry: true,
        });
        expect(result).toEqual({ migrated: true, from: 1, to: CURRENT_VERSION });
        expect(data).toEqual({
            startDate: '2024-01-01',
            isBlurry: true,
            hiddenCategories: ['Logement', 'Transports'],
            settings_version: 2,
        });
    });

    test('ne touche ni au cache, ni au rapport, ni aux autres données de l\'extension', async () => {
        const kept = {
            noEndDate: true,
            cache_data_transactions: [],
            cache_time_transactions: 1,
            pecunio_report_params: {},
            review_state: 'none',
            onboarding_done: true,
        };
        const { data } = await migrate({ ...kept, Logement: false });
        expect(data).toEqual({ ...kept, settings_version: 2 });
    });

    test('données des très anciennes versions effacées', async () => {
        const { data } = await migrate({
            transac: [{ id: 1 }],
            categ: [{ id: 2 }],
            accountsList: [{ id: 3 }],
            cache_data_transac: null,
            cache_data_categ: null,
            accounts: 'undefined',
        });
        expect(data).toEqual({ settings_version: 2 });
    });

    test('stockage neuf : seule la version est écrite', async () => {
        const { data } = await migrate({});
        expect(data).toEqual({ settings_version: 2 });
    });

    test('déjà migré : rien ne change', async () => {
        const local = { settings_version: 2, Logement: true, hiddenCategories: ['Banque'] };
        const { result, data } = await migrate(local);
        expect(result).toEqual({ migrated: false, from: 2, to: 2 });
        expect(data).toEqual(local);
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('deux appels (popup et onglet Bankin) : même résultat', async () => {
        globalThis.chrome = createFakeChrome({ local: { Logement: true } });
        await migrateSettings();
        await migrateSettings();
        expect(chrome.storage.local._data).toEqual({ hiddenCategories: ['Logement'], settings_version: 2 });
    });

    test('version illisible : traitée comme v1', async () => {
        const { result } = await migrate({ settings_version: 'v2', Logement: true });
        expect(result.from).toBe(1);
        expect(chrome.storage.local._data.settings_version).toBe(2);
    });
});

describe('CategoryVisibility', () => {
    test('aucune catégorie masquée par défaut', async () => {
        expect(await getHiddenCategories()).toEqual(new Set());
    });

    test('ignore une valeur stockée invalide', async () => {
        globalThis.chrome = createFakeChrome({ local: { hiddenCategories: ['Logement', 3] } });
        expect(await getHiddenCategories()).toEqual(new Set(['Logement']));
        chrome.storage.local._data.hiddenCategories = 'Logement';
        expect(await getHiddenCategories()).toEqual(new Set());
    });

    test('lecture impossible : aucune catégorie masquée', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('stockage indisponible'));
        expect(await getHiddenCategories()).toEqual(new Set());
    });

    test('masquer puis afficher une catégorie', async () => {
        await setCategoryHidden('Transports', true);
        await setCategoryHidden('Logement', true);
        expect(chrome.storage.local._data.hiddenCategories).toEqual(['Logement', 'Transports']);
        await setCategoryHidden('Logement', false);
        expect(chrome.storage.local._data.hiddenCategories).toEqual(['Transports']);
    });

    test('pas d\'écriture si rien ne change', async () => {
        await setCategoryHidden('Logement', false);
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('prévient des changements de la liste, et seulement d\'elle', async () => {
        const callback = vi.fn();
        const unwatch = watchHiddenCategories(callback);
        await setCategoryHidden('Logement', true);
        await chrome.storage.local.set({ startDate: '2024-01-01' });
        expect(callback).toHaveBeenCalledTimes(1);
        unwatch();
        await setCategoryHidden('Logement', false);
        expect(callback).toHaveBeenCalledTimes(1);
        expect(chrome.storage.onChanged.listenerCount).toBe(0);
    });
});
