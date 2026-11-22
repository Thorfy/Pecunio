import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CATEGORIES, sampleTransactions } from '../fixtures/bankin.js';
import { Config } from '../../js/core/Config.js';
import { APIError, AuthenticationError } from '../../js/core/DataManager.js';
import { Evt } from '../../js/core/Evt.js';
import { PageController } from '../../js/core/PageController.js';
import { AmountHider } from '../../js/ui/AmountHider.js';
import { LoadingScreen } from '../../js/ui/LoadingScreen.js';
import { ReviewPrompt } from '../../js/ui/ReviewPrompt.js';
import { StatusBanner } from '../../js/ui/StatusBanner.js';
import { makeCharts, makeWin } from '../helpers/page-controller.js';

const PAGE = () => PageController.PAGE;

const ACCOUNTS_DOM = '<div class="rightColumn"><div></div></div><div class="refreshIcon"></div><div class="homeBlock"></div>';
const CATEGORIES_DOM =
    '<div id="monthSelector"><div class="active"><span class="dib">Septembre 2026</span></div></div>' +
    '<div class="categoryChart"><div class="bankin-donut"></div></div>';

/** Contrôleur prêt à l'emploi, avec ses faux services. */
const setup = ({ href = 'https://app2.bankin.com/accounts', dom = ACCOUNTS_DOM, transactions = sampleTransactions(), dataPromise } = {}) => {
    document.body.innerHTML = dom;
    const win = makeWin(href);
    const charts = makeCharts();
    const settings = {
        waitForInitialization: () => Promise.resolve(),
        loadSettings: vi.fn(() => Promise.resolve()),
        getSetting: (key) => ({ accountsSelected: [101], isBlurry: false })[key],
        getAllSettings: () => ({ accountsSelected: [101] }),
    };
    const cacheStore = {
        waitForInitialization: () => Promise.resolve(),
        get: (type) => ({ transactions, categories: CATEGORIES })[type] ?? null,
        clear: vi.fn(() => Promise.resolve()),
    };
    const dataManager = {
        waitForInitialization: vi.fn(() => dataPromise ?? new Promise(() => {})),
        refreshData: vi.fn(() => Promise.resolve()),
        dispose: vi.fn(),
    };
    const createDataManager = vi.fn(() => dataManager);
    const evt = new Evt();
    const controller = new PageController({ settings, cacheStore, evt, createDataManager, win, charts: charts.classes });
    return { controller, win, charts, settings, cacheStore, dataManager, createDataManager, evt };
};

/** Simule une navigation de Bankin (SPA). */
const navigate = (win, href) => {
    win.location.href = href;
    win.fire('popstate');
};

const kinds = (created) => created.map((c) => c.kind);

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(LoadingScreen, 'show').mockImplementation(() => {});
    vi.spyOn(ReviewPrompt, 'tryShow').mockImplementation(() => Promise.resolve());
    vi.spyOn(AmountHider.prototype, 'insertButton').mockImplementation(() => {});
});

afterEach(() => {
    StatusBanner.hide();
    document.body.innerHTML = '';
});

describe('PageController.detectPage', () => {
    test.each([
        ['https://app2.bankin.com/accounts', 'ACCOUNTS'],
        ['https://app2.bankin.com/accounts/', 'ACCOUNTS'],
        ['https://app2.bankin.com/accounts?tab=1#x', 'ACCOUNTS'],
        ['https://app2.bankin.com/categories', 'CATEGORIES'],
        ['https://app2.bankin.com/categories/2', 'CATEGORY_DETAIL'],
        ['https://app2.bankin.com/signin', 'SIGNIN'],
        ['https://app2.bankin.com/profile/settings', 'OTHER'],
        ['pas une url', 'OTHER'],
    ])('%s → %s', (href, page) => {
        expect(PageController.detectPage(href)).toBe(PAGE()[page]);
    });

    test('pages avec graphiques : Comptes, Catégories et détail d\'une catégorie (historique)', () => {
        expect(PageController.hasCharts(PAGE().ACCOUNTS)).toBe(true);
        expect(PageController.hasCharts(PAGE().CATEGORIES)).toBe(true);
        expect(PageController.hasCharts(PAGE().CATEGORY_DETAIL)).toBe(true);
        expect(PageController.hasCharts(PAGE().SIGNIN)).toBe(false);
    });
});

describe('PageController — chargement des données (B12)', () => {
    test('B12 — sur /signin, aucune connexion ni chargement de données', async () => {
        const { controller, createDataManager, charts } = setup({ href: 'https://app2.bankin.com/signin', dom: '' });
        controller.start();
        await vi.runOnlyPendingTimersAsync();
        expect(createDataManager).not.toHaveBeenCalled();
        expect(charts.created).toHaveLength(0);
    });

    test('un seul DataManager, créé au premier passage sur une page à graphiques', async () => {
        const { controller, win, createDataManager } = setup({ href: 'https://app2.bankin.com/profile' });
        controller.start();
        expect(createDataManager).not.toHaveBeenCalled();
        navigate(win, 'https://app2.bankin.com/accounts');
        navigate(win, 'https://app2.bankin.com/categories');
        navigate(win, 'https://app2.bankin.com/accounts');
        await controller.requestBuild();
        expect(createDataManager).toHaveBeenCalledTimes(1);
    });

    test('erreur d\'authentification : bandeau avec bouton « Recharger »', async () => {
        const { controller, win } = setup({ dataPromise: Promise.reject(new AuthenticationError('Auth timeout')), transactions: [] });
        controller.start();
        await vi.waitFor(() => expect(StatusBanner.isVisible('data-error')).toBe(true));
        const banner = document.getElementById(StatusBanner.ID);
        expect(banner.getAttribute('role')).toBe('alert');
        expect(banner.shadowRoot.textContent).toContain('session non reconnue');
        banner.shadowRoot.querySelector('.pecunio-status-action').click();
        expect(win.location.reload).toHaveBeenCalled();
    });

    test('erreur réseau avec cache : bandeau + graphiques depuis les données enregistrées', async () => {
        const { controller, charts } = setup({ dataPromise: Promise.reject(new APIError('offline', null, 'u')) });
        await controller.start();
        await vi.waitFor(() => expect(StatusBanner.isVisible('data-error')).toBe(true));
        await controller.whenIdle();
        expect(document.getElementById(StatusBanner.ID).shadowRoot.textContent).toContain('dernières données enregistrées');
        expect(kinds(charts.created.slice(-2))).toEqual(['LineBarChart', 'BudgetChart']);
        expect(controller.charts).toHaveLength(2);
    });

    test('D11 — bandeau « chargement » si les données tardent, retiré à leur arrivée', async () => {
        const { controller, evt } = setup();
        controller.start();
        await vi.advanceTimersByTimeAsync(PageController.LOADING_BANNER_DELAY_MS - 1);
        expect(StatusBanner.isVisible('loading')).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(StatusBanner.isVisible('loading')).toBe(true);
        evt.dispatch('data_loaded');
        expect(StatusBanner.isVisible('loading')).toBe(false);
    });

    test('pas de bandeau « chargement » si les données arrivent vite', async () => {
        const { controller } = setup({ dataPromise: Promise.resolve() });
        controller.start();
        await vi.advanceTimersByTimeAsync(PageController.LOADING_BANNER_DELAY_MS * 2);
        expect(StatusBanner.isVisible()).toBe(false);
    });
});

describe('PageController — déconnexion (D8)', () => {
    test('D8 — sur /signin : cache, rapport et en-têtes effacés, préférences gardées', async () => {
        Object.assign(chrome.storage.local._data, {
            pecunio_report_mergedData: [{ id: 1 }],
            pecunio_report_stats: {},
            pecunio_report_params: {},
            startDate: '2024-01-01',
            hiddenCategories: ['Logement'],
        });
        const { controller, cacheStore } = setup({ href: 'https://app2.bankin.com/signin', dom: '' });
        await controller.start();
        expect(cacheStore.clear).toHaveBeenCalledWith();
        expect(chrome.storage.local._data).toEqual({ startDate: '2024-01-01', hiddenCategories: ['Logement'] });
        expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({ type: 'pecunio_signed_out' });
    });

    test('D8 — déconnexion depuis une page à graphiques : DataManager fermé puis recréé à la reconnexion', async () => {
        const { controller, win, createDataManager, dataManager, cacheStore } = setup();
        controller.start();
        expect(createDataManager).toHaveBeenCalledTimes(1);
        navigate(win, 'https://app2.bankin.com/signin');
        await controller.whenIdle();
        await vi.waitFor(() => expect(cacheStore.clear).toHaveBeenCalled());
        expect(dataManager.dispose).toHaveBeenCalled();
        navigate(win, 'https://app2.bankin.com/accounts');
        expect(createDataManager).toHaveBeenCalledTimes(2);
    });

    test('D8 — l\'échec du chargement d\'avant la déconnexion n\'affiche pas d\'erreur', async () => {
        let fail;
        const dataPromise = new Promise((_resolve, reject) => { fail = reject; });
        dataPromise.catch(() => {});
        const { controller, win } = setup({ dataPromise });
        controller.start();
        navigate(win, 'https://app2.bankin.com/signin');
        await vi.waitFor(() => expect(chrome.runtime.sendMessage).toHaveBeenCalled());
        fail(new Error('Auth timeout'));
        await vi.runOnlyPendingTimersAsync();
        expect(StatusBanner.isVisible('data-error')).toBe(false);
    });

    test('D8 — un effacement en échec n\'empêche pas la suite', async () => {
        const { controller, cacheStore } = setup({ href: 'https://app2.bankin.com/signin', dom: '' });
        cacheStore.clear.mockRejectedValue(new Error('quota'));
        await expect(controller.start()).resolves.toBeUndefined();
        expect(chrome.runtime.sendMessage).toHaveBeenCalled();
    });
});

describe('PageController — construction des graphiques', () => {
    test('page Comptes : graphique temporel + budget, puis masquage et invitation à l\'avis', async () => {
        const { controller, charts } = setup();
        await controller.requestBuild();
        expect(kinds(charts.created)).toEqual(['LineBarChart', 'BudgetChart']);
        expect(charts.created[0].rendered).toBe(true);
        expect(charts.created[1].containerId).toBe('budgetChartBlock');
        expect(LoadingScreen.show).toHaveBeenCalled();
        expect(ReviewPrompt.tryShow).toHaveBeenCalledTimes(1);
        expect(controller.buildCount).toBe(1);
    });

    test('sans données en cache : aucun graphique', async () => {
        const { controller, charts } = setup({ transactions: null });
        await controller.requestBuild();
        expect(charts.created).toHaveLength(0);
    });

    test('page Bankin pas encore affichée : rien, sans erreur', async () => {
        const { controller, charts } = setup({ dom: '<div class="rightColumn"></div>' });
        await controller.requestBuild();
        expect(charts.created).toHaveLength(0);
        expect(controller.buildCount).toBe(0);
    });

    test('page Catégories : types de dépenses, flux et rythme du mois pour le mois affiché', async () => {
        const { controller, charts } = setup({ href: 'https://app2.bankin.com/categories', dom: CATEGORIES_DOM });
        await controller.requestBuild();
        expect(kinds(charts.created)).toEqual(['ExpenseTypeChart', 'SankeyChart', 'MonthPaceChart']);
        expect(charts.created[0].args[2]).toEqual(['septembre', '2026']);
        expect(charts.created[2].args[2]).toEqual(['septembre', '2026']);
        // Reconstruction (changement de mois) : une seule carte de rythme
        await controller.requestBuild();
        expect(document.querySelectorAll('.pecunio-pace-wrapper')).toHaveLength(1);
        expect(charts.created[2].destroy).toHaveBeenCalled();
    });

    test("page de détail d'une catégorie : historique de la catégorie de l'adresse", async () => {
        const { controller, charts } = setup({ href: 'https://app2.bankin.com/categories/159', dom: CATEGORIES_DOM });
        await controller.requestBuild();
        expect(kinds(charts.created)).toEqual(['CategoryHistoryChart']);
        expect(charts.created[0].args[2]).toEqual({ categoryId: 159, monthParams: ['septembre', '2026'] });
    });

    test("détail : changement de mois ou de catégorie, un seul historique à jour", async () => {
        const { controller, win, charts } = setup({ href: 'https://app2.bankin.com/categories/161', dom: CATEGORIES_DOM });
        await controller.start();
        await controller.requestBuild();
        expect(document.querySelectorAll('.pecunio-history-wrapper')).toHaveLength(1);
        navigate(win, 'https://app2.bankin.com/categories/2');
        await controller.whenIdle();
        expect(document.querySelectorAll('.pecunio-history-wrapper')).toHaveLength(1);
        expect(charts.created.at(-1).args[2].categoryId).toBe(2);
        expect(charts.created.slice(0, -1).every((c) => c.destroy.mock.calls.length >= 1)).toBe(true);
    });

    test('B16 — chaque reconstruction détruit les graphiques précédents', async () => {
        const { controller, charts } = setup();
        await controller.requestBuild();
        const [first, second] = charts.created;
        await controller.requestBuild();
        expect(first.destroy).toHaveBeenCalledTimes(1);
        expect(second.destroy).toHaveBeenCalledTimes(1);
        expect(controller.charts).toHaveLength(2);
        controller.stop();
        expect(charts.created[2].destroy).toHaveBeenCalled();
    });

    test('B5 — demandes simultanées : une construction à la fois, regroupées', async () => {
        const { controller, charts } = setup();
        const requests = [1, 2, 3, 4, 5].map(() => controller.requestBuild());
        await Promise.all(requests);
        // La première construction, puis une seule pour toutes les demandes reçues pendant celle-ci
        expect(controller.buildCount).toBe(2);
        expect(charts.created).toHaveLength(4);
        expect(ReviewPrompt.tryShow).toHaveBeenCalledTimes(2);
        expect(document.querySelectorAll('#budgetChartBlock')).toHaveLength(1);
    });

    test('une erreur pendant une construction n\'empêche pas les suivantes', async () => {
        const { controller, charts } = setup();
        charts.classes.LineBarChart.prototype.render = vi.fn().mockRejectedValueOnce(new Error('boum')).mockResolvedValue();
        await controller.requestBuild();
        expect(console.error).toHaveBeenCalled();
        await controller.requestBuild();
        expect(controller.buildCount).toBe(1);
    });

    test('data_loaded déclenche la construction', async () => {
        const { controller, evt, charts } = setup();
        controller.start();
        await controller.requestBuild(); // construction initiale
        const before = charts.created.length;
        evt.dispatch('data_loaded');
        await controller.requestBuild();
        expect(charts.created.length).toBeGreaterThan(before);
    });
});

describe('PageController — bouton ↻ et sélecteur de mois (B4)', () => {
    test('B4 — après plusieurs constructions, un clic sur ↻ ne recharge qu\'une fois', async () => {
        const { controller, dataManager } = setup();
        controller.start();
        await controller.requestBuild();
        await controller.requestBuild();
        await controller.requestBuild();
        document.querySelector('.refreshIcon').click();
        await vi.advanceTimersByTimeAsync(PageController.REFRESH_DELAY_MS);
        expect(dataManager.refreshData).toHaveBeenCalledTimes(1);
    });

    test('↻ en échec : bandeau d\'erreur', async () => {
        const { controller, dataManager } = setup();
        controller.start();
        await controller.requestBuild();
        dataManager.refreshData.mockRejectedValueOnce(new APIError('500', 500, 'u'));
        document.querySelector('.refreshIcon').click();
        await vi.advanceTimersByTimeAsync(PageController.REFRESH_DELAY_MS);
        await vi.waitFor(() => expect(StatusBanner.isVisible('data-error')).toBe(true));
    });

    test('↻ avant tout chargement : sans effet', async () => {
        const { controller } = setup();
        await expect(controller.refreshData()).resolves.toBeUndefined();
    });

    test('changement de mois : une seule reconstruction par clic', async () => {
        const { controller } = setup({ href: 'https://app2.bankin.com/categories', dom: CATEGORIES_DOM });
        await controller.requestBuild();
        await controller.requestBuild();
        document.querySelector('#monthSelector').click();
        await vi.advanceTimersByTimeAsync(PageController.MONTH_CHANGE_DELAY_MS);
        await vi.waitFor(() => expect(controller.buildCount).toBe(3));
    });
});

describe('PageController — navigation (B6)', () => {
    test('B6 — onglet Revenus : les graphiques de dépenses sont retirés et détruits', async () => {
        const { controller, win, charts } = setup({ href: 'https://app2.bankin.com/categories', dom: CATEGORIES_DOM });
        await controller.start();
        const expenseWrappers = '.pecunio-expense-type-wrapper, .pecunio-sankey-wrapper, .pecunio-pace-wrapper';
        expect(document.querySelectorAll(expenseWrappers)).toHaveLength(3);

        navigate(win, 'https://app2.bankin.com/categories/2');
        await controller.whenIdle();

        expect(document.querySelectorAll(expenseWrappers)).toHaveLength(0);
        const [expenseType, sankey, pace, history] = charts.created;
        expect([expenseType, sankey, pace].every((c) => c.destroy.mock.calls.length === 1)).toBe(true);
        // Onglet Revenus : historique des revenus (lot UX-3a)
        expect(history.kind).toBe('CategoryHistoryChart');
        expect(history.args[2]).toEqual({ categoryId: 2, monthParams: ['septembre', '2026'] });
        expect(document.querySelectorAll('.pecunio-history-wrapper')).toHaveLength(1);
    });

    test('retour sur l\'onglet Dépenses : graphiques reconstruits', async () => {
        const { controller, win, charts } = setup({ href: 'https://app2.bankin.com/categories/2', dom: CATEGORIES_DOM });
        await controller.start();
        expect(kinds(charts.created)).toEqual(['CategoryHistoryChart']);
        navigate(win, 'https://app2.bankin.com/categories');
        await controller.whenIdle();
        expect(kinds(charts.created)).toEqual(['CategoryHistoryChart', 'ExpenseTypeChart', 'SankeyChart', 'MonthPaceChart']);
        // L'historique ne reste pas sur la page Catégories
        expect(document.querySelectorAll('.pecunio-history-wrapper')).toHaveLength(0);
    });

    test('plusieurs signaux pour une même navigation : une seule reconstruction', async () => {
        const { controller, win } = setup({ href: 'https://app2.bankin.com/profile', dom: ACCOUNTS_DOM });
        await controller.start();
        win.location.href = 'https://app2.bankin.com/accounts';
        win.fire('popstate');
        win.fire('hashchange');
        await vi.advanceTimersByTimeAsync(Config.INTERVALS.URL_CHECK * 3);
        await controller.whenIdle();
        expect(controller.buildCount).toBe(1);
    });

    test('navigation détectée par l\'API Navigation si disponible', async () => {
        const { controller, win } = setup({ href: 'https://app2.bankin.com/profile' });
        const navListeners = [];
        win.navigation = { addEventListener: (type, fn) => navListeners.push([type, fn]) };
        await controller.start();
        expect(navListeners.map(([type]) => type)).toEqual(['navigatesuccess']);
        win.location.href = 'https://app2.bankin.com/accounts';
        navListeners[0][1]();
        await controller.whenIdle();
        expect(controller.buildCount).toBe(1);
    });

    test('navigation sans événement : détectée par la vérification périodique', async () => {
        const { controller, win } = setup({ href: 'https://app2.bankin.com/profile' });
        await controller.start();
        win.location.href = 'https://app2.bankin.com/accounts';
        await vi.advanceTimersByTimeAsync(Config.INTERVALS.URL_CHECK);
        await controller.whenIdle();
        expect(controller.buildCount).toBe(1);
        controller.stop();
        win.location.href = 'https://app2.bankin.com/categories';
        await vi.advanceTimersByTimeAsync(Config.INTERVALS.URL_CHECK * 2);
        expect(controller.buildCount).toBe(1);
    });
});

describe('PageController — réglages modifiés ailleurs (popup)', () => {
    test('dates ou comptes modifiés : réglages relus puis graphiques redessinés', async () => {
        const { controller, settings } = setup();
        controller.start();
        await controller.requestBuild();
        chrome.storage.local.set({ startDate: '2024-02-01' });
        await vi.waitFor(() => expect(settings.loadSettings).toHaveBeenCalled());
        await controller.requestBuild();
        expect(controller.buildCount).toBeGreaterThanOrEqual(2);
    });

    test('autres clés ou autre zone de stockage : rien', async () => {
        const { controller, settings } = setup();
        controller.start();
        chrome.storage.local.set({ review_build_count: 3 });
        await controller._onStorageChanged({ startDate: {} }, 'session');
        expect(settings.loadSettings).not.toHaveBeenCalled();
    });

    test('relecture des réglages impossible : avertissement, graphiques quand même', async () => {
        const { controller, settings } = setup();
        settings.loadSettings.mockRejectedValueOnce(new Error('quota'));
        await controller._onStorageChanged({ endDate: {} }, 'local');
        expect(console.warn).toHaveBeenCalled();
        expect(controller.buildCount).toBe(1);
    });
});

describe('PageController — reconstructions inutiles (B24)', () => {
    test('B24 — données reçues identiques à celles affichées : graphiques conservés', async () => {
        const { controller, evt, charts } = setup();
        await controller.start();
        expect(controller.buildCount).toBe(1);
        evt.dispatch('data_loaded');
        await controller.whenIdle();
        expect(controller.buildCount).toBe(1);
        expect(charts.created).toHaveLength(2);
        expect(charts.created[0].destroy).not.toHaveBeenCalled();
    });

    test('données reçues différentes : graphiques reconstruits', async () => {
        const { controller, evt, cacheStore } = setup();
        await controller.start();
        const updated = [...sampleTransactions(), { ...sampleTransactions()[0], id: 999, amount: -42 }];
        cacheStore.get = (type) => ({ transactions: updated, categories: CATEGORIES })[type] ?? null;
        evt.dispatch('data_loaded');
        await controller.whenIdle();
        expect(controller.buildCount).toBe(2);
    });

    test('graphiques retirés par Bankin entre-temps : reconstruits même si les données sont identiques', async () => {
        const { controller, evt } = setup();
        await controller.start();
        document.querySelector('#budgetChartBlock').remove();
        evt.dispatch('data_loaded');
        await controller.whenIdle();
        expect(controller.buildCount).toBe(2);
    });

    test('réglages modifiés : reconstruction même si les données sont identiques', async () => {
        const { controller, settings } = setup();
        await controller.start();
        settings.getAllSettings = () => ({ accountsSelected: [101], startDate: '2024-02-01' });
        await controller._onStorageChanged({ startDate: {} }, 'local');
        expect(controller.buildCount).toBe(2);
    });

    test('une demande forcée reçue pendant une construction n\'est pas perdue', async () => {
        const { controller } = setup();
        await controller.start();
        const running = controller.requestBuild(); // forcée
        controller.requestBuild({ onlyIfChanged: true });
        controller.requestBuild(); // forcée, pendant la construction en cours
        await running;
        expect(controller.buildCount).toBe(3);
    });

    test('seules des demandes « si changement » pendant une construction : rien de plus', async () => {
        const { controller } = setup();
        await controller.start();
        const running = controller.requestBuild();
        controller.requestBuild({ onlyIfChanged: true });
        controller.requestBuild({ onlyIfChanged: true });
        await running;
        expect(controller.buildCount).toBe(2);
    });
});
