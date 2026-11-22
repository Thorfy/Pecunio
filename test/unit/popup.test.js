// Popup de l'extension (entrypoints/popup) : période, comptes, export CSV et
// rapport PDF. Le HTML réel de la popup est chargé dans happy-dom ; les
// parcours complets sont couverts par les tests de bout en bout (e2e/).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { ACCOUNTS, CATEGORIES, sampleTransactions } from '../fixtures/bankin.js';
import { createFakeChrome } from '../helpers/fake-chrome.js';
import { Config } from '../../js/core/Config.js';
import { DateRange } from '../../js/core/DateRange.js';

const POPUP_BODY = readFileSync(resolve('entrypoints/popup/index.html'), 'utf8')
    .match(/<body>([\s\S]*)<\/body>/)[1]
    .replace(/<script[\s\S]*?<\/script>/g, '');

/** Cache des données de l'API, tel que l'écrit CacheStore. */
const cached = ({ transactions = sampleTransactions(), categories = CATEGORIES, accounts = ACCOUNTS } = {}) => ({
    [Config.getCacheKey('transactions')]: transactions,
    [Config.getCacheTimeKey('transactions')]: Date.now(),
    [Config.getCacheKey('categories')]: categories,
    [Config.getCacheTimeKey('categories')]: Date.now(),
    [Config.getCacheKey('accounts')]: accounts,
    [Config.getCacheTimeKey('accounts')]: Date.now(),
});

/**
 * Ouvre la popup : HTML, stockage initial, puis exécution de main.js.
 * @param {Record<string, unknown>} [local] contenu de chrome.storage.local
 * @param {{ pinned?: boolean }} [options] extension épinglée à la barre d'outils
 */
async function openPopup(local = {}, { pinned = true } = {}) {
    globalThis.chrome = createFakeChrome({ local: { settings_version: 2, ...local } });
    chrome.action.getUserSettings.mockResolvedValue({ isOnToolbar: pinned });
    document.body.innerHTML = POPUP_BODY;
    vi.resetModules();
    // main.js s'initialise sur DOMContentLoaded : on récupère son écouteur pour
    // l'appeler une fois (sans réveiller les popups des tests précédents) et
    // attendre la fin de l'initialisation.
    let init = null;
    const addEventListener = document.addEventListener.bind(document);
    const spy = vi.spyOn(document, 'addEventListener').mockImplementation((type, listener, options) => {
        if (type === 'DOMContentLoaded') init = listener;
        else addEventListener(type, listener, options);
    });
    await import('../../entrypoints/popup/main.js');
    spy.mockRestore();
    await init();
    return {
        $: (selector) => document.querySelector(selector),
        stored: () => chrome.storage.local._data,
    };
}

beforeEach(() => {
    // Absents de happy-dom
    window.alert = vi.fn();
    globalThis.Option ??= function Option(text = '', value = text, defaultSelected = false, selected = defaultSelected) {
        const option = document.createElement('option');
        option.textContent = text;
        option.value = String(value);
        option.defaultSelected = defaultSelected;
        option.selected = selected;
        return option;
    };
});

afterEach(() => {
    window.dispatchEvent(new Event('beforeunload')); // arrête la vérification de l'épinglage
    document.body.innerHTML = '';
});

describe('Popup — période', () => {
    test('par défaut : de la plus ancienne transaction à aujourd\'hui, enregistrée', async () => {
        const { $, stored } = await openPopup(cached());
        expect($('#startDate').value).toBe('2024-01-05');
        expect($('#endDate').value).toBe(DateRange.getTodayInputValue());
        expect(stored()).toMatchObject({ startDate: '2024-01-05', endDate: DateRange.getTodayInputValue() });
    });

    test('période enregistrée : reprise telle quelle', async () => {
        const { $ } = await openPopup({ ...cached(), startDate: '2024-02-01', endDate: '2024-02-29' });
        expect($('#startDate').value).toBe('2024-02-01');
        expect($('#endDate').value).toBe('2024-02-29');
        expect($('#endDate').disabled).toBe(false);
    });

    test('« jusqu\'à aujourd\'hui » : date de fin désactivée et mise à aujourd\'hui', async () => {
        const { $, stored } = await openPopup({ ...cached(), startDate: '2024-01-01', endDate: '2024-06-30' });
        $('#noEndDate').checked = true;
        $('#noEndDate').dispatchEvent(new Event('change'));
        expect($('#endDate').disabled).toBe(true);
        expect($('#endDate').value).toBe(DateRange.getTodayInputValue());
        await vi.waitFor(() => expect(stored()).toMatchObject({ noEndDate: true, endDate: DateRange.getTodayInputValue() }));
    });

    test('date modifiée : enregistrée quand le champ perd le focus', async () => {
        const { $, stored } = await openPopup(cached());
        $('#startDate').value = '2024-03-01';
        $('#startDate').dispatchEvent(new Event('blur'));
        await vi.waitFor(() => expect(stored().startDate).toBe('2024-03-01'));
    });
});

describe('Popup — comptes', () => {
    test('comptes du cache proposés, tous sélectionnés au premier passage', async () => {
        const { $, stored } = await openPopup(cached());
        const options = Array.from($('#accountsInput').options);
        expect(options.map((o) => o.textContent).sort()).toEqual(['Compte courant', 'Livret A']);
        expect(options.every((o) => o.selected)).toBe(true);
        expect(stored().accountsSelected).toEqual([101, 102]);
    });

    test('sélection enregistrée : reprise', async () => {
        const { $ } = await openPopup({ ...cached(), accountsSelected: [102] });
        const selected = Array.from($('#accountsInput').options).filter((o) => o.selected).map((o) => o.value);
        expect(selected).toEqual(['102']);
    });

    test('sans données : aucun compte proposé', async () => {
        const { $ } = await openPopup();
        expect($('#accountsInput').options.length).toBe(0);
    });
});

describe('Popup — export CSV', () => {
    test('exporte la période et les comptes choisis', async () => {
        const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
        const { $ } = await openPopup({ ...cached(), startDate: '2024-02-01', endDate: '2024-02-29', accountsSelected: [101] });
        $('#exportCsv').click();
        await vi.waitFor(() => expect(createObjectURL).toHaveBeenCalled());
        const csv = await createObjectURL.mock.calls[0][0].text();
        expect(csv).toContain('Loyer février');
        expect(csv).not.toContain('Loyer janvier');
        // Compte 102 (livret) exclu : son unique transaction est de janvier, mais
        // aucune ligne de ce compte ne doit apparaître
        expect(csv).not.toContain('Livret A');
        expect(window.alert).not.toHaveBeenCalled();
    });

    test('sans données : message, pas de fichier', async () => {
        const createObjectURL = vi.spyOn(URL, 'createObjectURL');
        const { $ } = await openPopup();
        $('#exportCsv').click();
        await vi.waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Aucune donnée')));
        expect(createObjectURL).not.toHaveBeenCalled();
    });

    test('période sans transaction : message, pas de fichier', async () => {
        const createObjectURL = vi.spyOn(URL, 'createObjectURL');
        const { $ } = await openPopup({ ...cached(), startDate: '2030-01-01', endDate: '2030-12-31' });
        $('#exportCsv').click();
        await vi.waitFor(() => expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Aucune transaction')));
        expect(createObjectURL).not.toHaveBeenCalled();
    });
});

describe('Popup — rapport PDF', () => {
    test('années des transactions proposées, mois « Toute l\'année » en premier', async () => {
        const { $ } = await openPopup(cached());
        expect(Array.from($('#pdfYear').options).map((o) => o.value)).toContain('2024');
        expect($('#pdfMonth').options[0].textContent).toBe('Toute l\'année');
    });

    test('prépare les données du rapport et ouvre sa page', async () => {
        const { $, stored } = await openPopup(cached());
        $('#pdfYear').value = '2024';
        $('#pdfMonth').value = '2';
        $('#exportPdf').click();
        await vi.waitFor(() => expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'chrome-extension://pecunio-test/report.html' }));
        const keys = Config.REPORT.STORAGE_KEYS;
        expect(stored()[keys.PARAMS]).toMatchObject({ startDate: '2024-02-01', endDate: '2024-02-29', pdfMonthLabel: 'Février' });
        expect(stored()[keys.MERGED].every((row) => row.date.startsWith('2024-02'))).toBe(true);
    });
});

describe('Pages de l\'extension — vie privée (U12)', () => {
    test.each(['entrypoints/popup/index.html', 'entrypoints/report/index.html'])(
        '%s ne charge aucune ressource externe (images, polices, scripts)',
        (file) => {
            const html = readFileSync(resolve(file), 'utf8');
            // Seuls les liens cliquables (<a href>) peuvent viser un autre site
            const external = html.match(/<(?!a\s)[a-z]+[^>]*\s(?:src|href)="https?:\/\/[^"]+"/gi) || [];
            expect(external).toEqual([]);
            expect(html).not.toMatch(/url\(\s*['"]?https?:/i);
        },
    );

    test('version affichée localement, sans badge distant', async () => {
        const { $ } = await openPopup(cached());
        expect($('#currentVersion').textContent).toBe('0.0.0-test');
        expect(document.querySelector('img[src^="http"]')).toBeNull();
    });
});

describe('Popup — épinglage', () => {
    test('extension non épinglée : instructions affichées', async () => {
        const { $ } = await openPopup(cached(), { pinned: false });
        expect($('#pinInstructionsSection').style.display).toBe('block');
    });

    test('extension épinglée : instructions masquées', async () => {
        const { $ } = await openPopup(cached());
        expect($('#pinInstructionsSection').style.display).toBe('none');
    });
});
