// Tests de contrat : l'adaptateur BankinPage face aux vraies pages de Bankin.
//
// Les pages de test/fixtures/bankin-pages/ sont des captures anonymisées des
// pages réelles (scripts/bankin-snapshot.js). Si Bankin change son interface,
// une nouvelle capture fait échouer ces tests et montre quel élément manque :
// voir docs/TESTING.md, « Tests de contrat Bankin ».
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CATEGORIES, sampleTransactions } from '../fixtures/bankin.js';
import { makeCharts, makeWin } from '../helpers/page-controller.js';
import { BankinPage } from '../../js/bankin/BankinPage.js';
import { Evt } from '../../js/core/Evt.js';
import { PageController } from '../../js/core/PageController.js';
import { AmountHider } from '../../js/ui/AmountHider.js';
import { LoadingScreen } from '../../js/ui/LoadingScreen.js';
import { ReviewPrompt } from '../../js/ui/ReviewPrompt.js';

const loadPage = (name) => {
    document.body.innerHTML = readFileSync(resolve('test/fixtures/bankin-pages', `${name}.html`), 'utf8');
    return new BankinPage(document);
};

afterEach(() => {
    document.body.innerHTML = '';
});

describe('Contrat Bankin — page Comptes', () => {
    test('tous les éléments utilisés par Pecunio sont présents', () => {
        expect(loadPage('accounts').missingElements(BankinPage.PAGE.ACCOUNTS)).toEqual([]);
    });

    test('bloc des graphiques, bouton ↻ et indicateur de chargement', () => {
        const bankin = loadPage('accounts');
        expect(bankin.accountsBlock()).not.toBeNull();
        expect(bankin.refreshButton()).not.toBeNull();
        // Le 1er bloc de la colonne de droite est le bloc des comptes lui-même
        expect(bankin.loadingSlot()).toBe(bankin.accountsBlock());
    });

    test('masquage des montants : en-tête, bouton et montants des comptes', () => {
        const bankin = loadPage('accounts');
        expect(bankin.headerAmount().textContent).toBe('0,00 €');
        expect(bankin.hideButtonContainer(BankinPage.PAGE.ACCOUNTS)).not.toBeNull();
        const amounts = bankin.amountElements();
        expect(amounts.length).toBeGreaterThanOrEqual(3);
        expect(amounts.every((el) => /€/.test(el.textContent))).toBe(true);
    });

    test('pas d\'éléments de la page Catégories', () => {
        const bankin = loadPage('accounts');
        expect(bankin.activeMonth()).toBeNull();
        expect(bankin.categoryChart()).toBeNull();
    });
});

describe('Contrat Bankin — page Catégories', () => {
    test('tous les éléments utilisés par Pecunio sont présents', () => {
        expect(loadPage('categories').missingElements(BankinPage.PAGE.CATEGORIES)).toEqual([]);
    });

    test('mois affiché lu dans le sélecteur de mois', () => {
        const bankin = loadPage('categories');
        expect(bankin.monthSelector()).not.toBeNull();
        expect(bankin.activeMonthLabel()).toBe('Octobre 2026');
        expect(bankin.activeMonth()).toEqual(['octobre', '2026']);
    });

    test('bloc du donut et ses panneaux', () => {
        const bankin = loadPage('categories');
        expect(bankin.categoryChart()).not.toBeNull();
        expect(bankin.categoryChartPanels()).toHaveLength(1);
    });

    test('masquage des montants : bouton dans la légende du donut (pas d\'en-tête de solde)', () => {
        const bankin = loadPage('categories');
        expect(bankin.headerAmount()).toBeNull();
        const container = bankin.hideButtonContainer(BankinPage.PAGE.CATEGORIES);
        expect(container?.matches('.categoryChart .mt2.tac')).toBe(true);
        const amounts = bankin.amountElements();
        expect(amounts.some((el) => el.closest('#contentList'))).toBe(true); // liste des catégories
        expect(amounts.some((el) => el.closest('.categoryChart .mt2.tac'))).toBe(true); // total du donut
        expect(amounts.some((el) => el.closest('#donutChart'))).toBe(true); // étiquettes du donut
    });
});

describe('Contrat Bankin — PageController sur les vraies pages', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(LoadingScreen, 'show').mockImplementation(() => {});
        vi.spyOn(ReviewPrompt, 'tryShow').mockImplementation(() => Promise.resolve());
        vi.spyOn(AmountHider.prototype, 'insertButton').mockImplementation(() => {});
    });

    const start = async (page, href) => {
        loadPage(page);
        const charts = makeCharts();
        const controller = new PageController({
            settings: {
                waitForInitialization: () => Promise.resolve(),
                loadSettings: () => Promise.resolve(),
                getSetting: () => null,
                getAllSettings: () => ({}),
            },
            cacheStore: {
                waitForInitialization: () => Promise.resolve(),
                get: (type) => ({ transactions: sampleTransactions(), categories: CATEGORIES })[type] ?? null,
                clear: () => Promise.resolve(),
            },
            evt: new Evt(),
            createDataManager: () => ({ waitForInitialization: () => new Promise(() => {}), dispose() {} }),
            win: makeWin(href),
            charts: charts.classes,
        });
        await controller.start();
        controller.stop();
        return charts.created.map((chart) => chart.kind);
    };

    test('page Comptes : graphique temporel et comparaison budget', async () => {
        expect(await start('accounts', 'https://app2.bankin.com/accounts')).toEqual(['LineBarChart', 'SavingsChart', 'BudgetChart']);
    });

    test('page Catégories : types de dépenses et diagramme de flux, pour le mois affiché', async () => {
        expect(await start('categories', 'https://app2.bankin.com/categories')).toEqual(['ExpenseTypeChart', 'MonthPaceChart', 'VariationsChart', 'SankeyChart']);
    });
});
