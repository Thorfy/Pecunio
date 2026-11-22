import { describe, expect, test, vi } from 'vitest';
import { CATEGORIES, sampleTransactions, tx } from '../fixtures/bankin.js';
import { BaseChartData } from '../../js/charts/base/BaseChartData.js';
import { BudgetChart } from '../../js/charts/BudgetChart.js';
import { ExpenseTypeChart } from '../../js/charts/ExpenseTypeChart.js';
import { LineBarChart } from '../../js/charts/LineBarChart.js';
import { SankeyChart } from '../../js/charts/SankeyChart.js';
import { Config } from '../../js/core/Config.js';
import { DATE_LOCALE } from '../../js/lib/chart.js';
import { formatEuros, formatPercent } from '../../js/utils/format.js';

/** Faux Settings : seules les méthodes utilisées par les graphiques. */
const fakeSettings = (values = {}) => ({
    getSetting: (key) => values[key],
    getEffectiveEndDate: () => values.endDate,
    waitForInitialization: () => Promise.resolve(),
});

/**
 * Force la langue utilisée par Date.prototype.toLocaleString('default', …),
 * c'est-à-dire la langue du navigateur de l'utilisateur.
 */
const forceBrowserLocale = (locale) => {
    const original = Date.prototype.toLocaleString;
    vi.spyOn(Date.prototype, 'toLocaleString').mockImplementation(function (requested, options) {
        return original.call(this, requested === 'default' ? locale : requested, options);
    });
};

const ids = (transactions) => transactions.map((t) => t.id).sort((a, b) => a - b);

describe('BaseChartData — utilitaires', () => {
    test('lookup : chaque sous-catégorie pointe vers le nom de son parent', () => {
        const chart = new BaseChartData([], CATEGORIES);
        expect(chart.getCategoryNameById(188)).toBe('Alimentation & Restau.');
        expect(chart.getCategoryNameById(168)).toBe('Alimentation & Restau.');
        expect(chart.getCategoryNameById(4242)).toBeNull();
    });

    test('catégories absentes ou invalides', () => {
        const chart = new BaseChartData(null, 'x');
        expect(chart.transactions).toEqual([]);
        expect(chart.categoryLookup.size).toBe(0);
    });

    test('médiane et moyenne ignorent les valeurs non numériques', () => {
        expect(BaseChartData.calculateMedian([3, 1, 2])).toBe(2);
        expect(BaseChartData.calculateMedian([4, 1, 3, 2])).toBe(2.5);
        expect(BaseChartData.calculateMedian([1, 'x', NaN, 5])).toBe(3);
        expect(BaseChartData.calculateMedian([])).toBe(0);
        expect(BaseChartData.calculateMedian(['x'])).toBe(0);
        expect(BaseChartData.calculateAverage([1, 2, 6])).toBe(3);
        expect(BaseChartData.calculateAverage(null)).toBe(0);
        expect(BaseChartData.calculateAverage([NaN])).toBe(0);
    });

    test('getAdjustedDate ne modifie pas la transaction', () => {
        const chart = new BaseChartData([], []);
        const t = tx({ date: '2024-01-20', current_month: -1 });
        const d = chart.getAdjustedDate(t);
        expect([d.getFullYear(), d.getMonth() + 1]).toEqual([2023, 12]);
        expect(t.date).toBe('2024-01-20');
        expect(chart.getAdjustedDate({})).toBeNull();
    });
});

describe('BaseChartData.applySettingOnData (période et comptes des réglages)', () => {
    test('filtre par période et par compte', () => {
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES, [102], null, fakeSettings({ startDate: '2024-01-01', endDate: '2024-12-31' }));
        expect(ids(chart.applySettingOnData())).toEqual([6]);
    });

    test('bornes inclusives', () => {
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES, null, null, fakeSettings({ startDate: '2024-02-05', endDate: '2024-02-14' }));
        expect(ids(chart.applySettingOnData())).toEqual([8, 9, 10]);
    });

    test('une seule borne suffit', () => {
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES, null, null, fakeSettings({ startDate: '2024-03-01' }));
        expect(ids(chart.applySettingOnData())).toEqual([12, 13]);
    });

    test('les options explicites priment sur les réglages', () => {
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES, null, null, fakeSettings({ startDate: '2030-01-01' }));
        expect(chart.applySettingOnData({ startDate: '2024-03-01', endDate: null })).toHaveLength(2);
    });

    test('n\'exclut pas les catégories d\'exception (fait plus loin par chaque graphique)', () => {
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES, null, null, fakeSettings({}));
        expect(ids(chart.applySettingOnData())).toContain(5);
    });

    test('ignore les transactions incomplètes ; pas de transactions → tableau vide', () => {
        const chart = new BaseChartData([null, { date: '2024-01-01' }, tx({ id: 1 })], CATEGORIES, null, null, fakeSettings({}));
        expect(ids(chart.applySettingOnData())).toEqual([1]);
        const empty = new BaseChartData([], CATEGORIES, null, null, fakeSettings({}));
        empty.transactions = null;
        expect(empty.applySettingOnData()).toEqual([]);
    });
});

describe('BaseChartData.applySettingOnDataByMonth (page Catégories)', () => {
    test('sélectionne un mois avec le nom affiché par Bankin (navigateur en français)', () => {
        forceBrowserLocale('fr-FR');
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES);
        expect(ids(chart.applySettingOnDataByMonth('février', '2024'))).toEqual([7, 8, 9, 10, 11]);
    });

    test('tient compte de current_month', () => {
        forceBrowserLocale('fr-FR');
        const chart = new BaseChartData([tx({ id: 1, date: '2024-01-30', current_month: 1 })], CATEGORIES);
        expect(ids(chart.applySettingOnDataByMonth('février', 2024))).toEqual([1]);
    });

    // --- B19 ------------------------------------------------------------
    test('B19 — les graphiques de la page Catégories fonctionnent avec un navigateur en anglais', () => {
        forceBrowserLocale('en-US');
        const chart = new BaseChartData(sampleTransactions(), CATEGORIES);
        // Bankin affiche « février 2024 » quelle que soit la langue du navigateur.
        expect(ids(chart.applySettingOnDataByMonth('février', '2024'))).toEqual([7, 8, 9, 10, 11]);
    });

    // --- B9 ----------------------------------------------------------------
    test('B9 — une transaction du 1er janvier est rangée en janvier, quel que soit le fuseau', () => {
        forceBrowserLocale('fr-FR');
        const chart = new BaseChartData([tx({ id: 1, date: '2024-01-01' })], CATEGORIES);
        expect(ids(chart.applySettingOnDataByMonth('janvier', '2024'))).toEqual([1]);
    });
});

describe('BaseChartData.mergeTransactionByCategory', () => {
    test('range chaque transaction dans sa sous-catégorie et dans son parent', () => {
        const chart = new BaseChartData([], CATEGORIES);
        const map = chart.mergeTransactionByCategory(sampleTransactions(), CATEGORIES);
        expect(ids(map.get(188))).toEqual([3, 9, 13]);
        expect(ids(map.get(168))).toEqual([3, 4, 9, 10, 13]);
        expect(map.get(326)).toEqual([]);
    });

    test('version legacy : seulement le parent, exceptions exclues', () => {
        const chart = new BaseChartData([], CATEGORIES);
        const byCat = chart.mergeTransactionByCategoryLegacy(sampleTransactions(), CATEGORIES);
        expect(ids(byCat[168])).toEqual([3, 4, 9, 10, 13]);
        expect(byCat[160]).toEqual([]);
        expect(byCat[188]).toBeUndefined();
    });

    // --- B17 ------------------------------------------------------------
    test('B17 — une catégorie parente sans sous-catégories ne fait pas planter le regroupement', () => {
        const categories = [...CATEGORIES, { id: 500, name: 'Sans enfants' }];
        const chart = new BaseChartData([], categories);
        const map = chart.mergeTransactionByCategory([tx({ id: 1, categoryId: 188 })], categories);
        expect(ids(map.get(168))).toEqual([1]);
    });
});

describe('BudgetChart — calculs', () => {
    const budget = async (transactions = sampleTransactions(), settings = {}) => {
        const chart = new BudgetChart(transactions, CATEGORIES, null, {}, fakeSettings(settings));
        await chart.initializationPromise;
        return chart;
    };

    test('organise les montants par année, mois et catégorie parente, sans les exceptions', async () => {
        const chart = await budget();
        expect(chart.organizedData[2024][1]).toEqual({
            "Entrées d'argent": [2500],
            Logement: [-800],
            'Alimentation & Restau.': [-120.5, -45],
        });
        expect(chart.organizedData[2024][2].Banque).toBeUndefined();
    });

    test('dépenses réelles d\'un mois', async () => {
        const chart = await budget();
        const spending = chart.getActualSpendingForMonth(2024, 2);
        expect(spending['Alimentation & Restau.']).toBeCloseTo(-158.3);
        expect(spending.Logement).toBe(-800);
        expect(spending.Banque).toBe(0);
        expect(chart.getActualSpendingForMonth(2030, 1).Logement).toBe(0);
    });

    test('médiane / moyenne mensuelle de l\'année en cours, jusqu\'au mois courant', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2024, 2, 20));
        const chart = await budget();
        const median = chart.getCalculatedMonthlyValueForYear(2024, 'median');
        const average = chart.getCalculatedMonthlyValueForYear(2024, 'average');
        expect(median.Logement).toBe(-800);
        expect(median['Alimentation & Restau.']).toBeCloseTo(-158.3);
        expect(average['Alimentation & Restau.']).toBeCloseTo((-165.5 - 158.3 - 150) / 3);
        expect(median.Banque).toBe(0);
        expect(chart.getCalculatedMonthlyValueForYear(2019).Logement).toBe(0);
    });

    test('année passée : les mois sans dépense comptent pour 0 dans la médiane', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2025, 5, 1));
        const chart = await budget();
        expect(chart.getCalculatedMonthlyValueForYear(2024).Logement).toBe(0);
        expect(chart.getCalculatedMonthlyValueForYear(2024, 'average').Logement).toBe(-200);
    });

    test('historique d\'un mois sur les années précédentes', async () => {
        const chart = await budget([tx({ date: '2022-03-10', amount: -100, categoryId: 180 }), tx({ date: '2023-03-10', amount: -300, categoryId: 180 }), tx({ date: '2024-03-10', amount: -999, categoryId: 180 })]);
        expect(chart.getHistoricalCalculatedValueForMonth(3, 2024).Logement).toBe(-200);
        expect(chart.getHistoricalCalculatedValueForMonth(3, 2024, 'average').Logement).toBe(-200);
        expect(chart.getHistoricalCalculatedValueForMonth(4, 2024).Logement).toBe(0);
    });

    test('prepareData : deux séries comparées, catégories masquées retirées', async () => {
        chrome.storage.local._data.hiddenCategories = ['Logement']; // catégorie masquée par l'utilisateur
        const chart = await budget();
        const data = await chart.prepareData(2024, 2, 2024, 1);
        expect(data.labels).toEqual(['Alimentation & Restau.', 'Banque', "Entrées d'argent"]);
        expect(data.datasets[0].label).toBe('Réel févr. 2024');
        expect(data.datasets[1].label).toBe('Réel janv. 2024');
        expect(data.datasets[0].data[0]).toBeCloseTo(-158.3);
        expect(data.datasets[1].data[0]).toBeCloseTo(-165.5);
    });

    test('prepareData : mode « toute l\'année »', async () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2024, 2, 20));
        const chart = await budget();
        const data = await chart.prepareData(2024, 'ALL', 2024, 'ALL', 'average');
        expect(data.datasets.map((d) => d.label)).toEqual(['Moyenne 2024', 'Moyenne 2024']);
    });

    test('aucune transaction dans la période → aucune donnée organisée', async () => {
        const chart = await budget(sampleTransactions(), { startDate: '2030-01-01', endDate: '2030-12-31' });
        expect(chart.organizedData).toEqual({});
    });
});

describe('SankeyChart — données', () => {
    const sankey = (transactions, month = 'janvier', year = '2024') => {
        forceBrowserLocale('fr-FR');
        return new SankeyChart(transactions, CATEGORIES, [month, year]).prepareData();
    };
    const flows = (data) => data.map(({ from, to, flow }) => [from, to, Math.round(flow * 100) / 100]);

    test('revenus → Budget → Dépenses → catégories, avec le reste', async () => {
        const data = await sankey(sampleTransactions());
        expect(flows(data)).toEqual([
            ['Salaires', 'Budget', 2500],
            ['Alimentation & Restau.', 'Supermarché / Epicerie', 120.5],
            ['Alimentation & Restau.', 'Restaurants', 45],
            ['Dépenses', 'Alimentation & Restau.', 165.5],
            ['Logement', 'Loyer', 800],
            ['Dépenses', 'Logement', 800],
            ['Budget', 'Restant', 1534.5],
            ['Budget', 'Dépenses', 965.5],
        ]);
    });

    test('pas de « Restant » quand les dépenses dépassent le budget', async () => {
        const data = await sankey([tx({ amount: -50, categoryId: 188, date: '2024-01-10' })]);
        expect(flows(data)).toEqual([
            ['Alimentation & Restau.', 'Supermarché / Epicerie', 50],
            ['Dépenses', 'Alimentation & Restau.', 50],
            ['Budget', 'Dépenses', 50],
        ]);
    });

    test('données invalides', () => {
        const chart = new SankeyChart([], CATEGORIES, []);
        expect(chart.getDataFormated(null, new Map())).toEqual([]);
        expect(chart.getDataFormated(CATEGORIES, {})).toEqual([]);
        expect(chart.convertDataToSankeyFormat(null)).toEqual([]);
        expect(chart.convertDataToSankeyFormat([null, { id: 1, name: 'x', transactions: 'bad', child: [{ name: 'y', transactions: 'bad' }] }])).toEqual([
            { from: 'Budget', to: 'Dépenses', flow: 0, id: 163 },
        ]);
    });

    // --- B18 ------------------------------------------------------------
    test('B18 — un remboursement réduit la dépense de sa catégorie', async () => {
        const data = await sankey([tx({ amount: -100, categoryId: 188, date: '2024-01-10' }), tx({ amount: 40, categoryId: 188, date: '2024-01-12' })]);
        expect(data.find((d) => d.from === 'Dépenses').flow).toBe(60);
        expect(data.find((d) => d.to === 'Supermarché / Epicerie').flow).toBe(60);
    });

    test('B18 — catégorie entièrement remboursée : aucun flux', async () => {
        const data = await sankey([tx({ amount: -50, categoryId: 189, date: '2024-01-10' }), tx({ amount: 50, categoryId: 189, date: '2024-01-12' })]);
        expect(data.some((d) => d.to === 'Restaurants')).toBe(false);
    });

    test('netFlow : revenus et dépenses nets, arrondis au centime, jamais négatifs', () => {
        expect(SankeyChart.netFlow([{ amount: -0.1 }, { amount: -0.2 }], false)).toBe(0.3);
        expect(SankeyChart.netFlow([{ amount: 2500 }, { amount: -100 }], true)).toBe(2400);
        expect(SankeyChart.netFlow([{ amount: 10 }], false)).toBe(0);
        expect(SankeyChart.netFlow([null, { amount: 'x' }], true)).toBe(0);
    });
});

describe('ExpenseTypeChart — données', () => {
    const expenseType = (transactions, params = ['janvier', '2024']) => {
        forceBrowserLocale('fr-FR');
        return new ExpenseTypeChart(transactions, CATEGORIES, params).prepareData();
    };

    test('répartit les dépenses du mois par type, sans revenus ni exceptions', async () => {
        const data = await expenseType(sampleTransactions());
        expect(data.labels).toEqual(['🏠 Essentiel', '🎯 Plaisir']);
        expect(data.datasets[0].data).toEqual([920.5, 45]);
        expect(data.expenseTypes).toEqual(['ESSENTIAL', 'PLEASURE']);
    });

    test('aucune dépense → graphique « Aucune donnée »', async () => {
        const data = await expenseType([tx({ amount: 100 })]);
        expect(data.labels).toEqual(['Aucune donnée']);
    });

    test('sans paramètres : toutes les transactions ; type inconnu affiché tel quel', async () => {
        const data = await expenseType([tx({ amount: -5, expense_type: 'MYSTERE' })], null);
        expect(data.labels).toEqual(['📦 MYSTERE']);
    });

    test('couleurs', () => {
        const chart = new ExpenseTypeChart([], CATEGORIES, null);
        expect(chart._darkenColor('rgba(100, 200, 50, 0.8)', 0.5)).toBe('rgba(50, 100, 25, 0.8)');
        expect(chart._darkenColor('red', 0.5)).toBe('red');
        expect(chart._generateColors(2)).toHaveLength(2);
        expect(chart._generateColors(1, ['INCONNU'])).toEqual(['rgba(199, 199, 199, 0.8)']);
    });
});

describe('LineBarChart — données', () => {
    test('cumule les montants par mois pour chaque catégorie parente', async () => {
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const data = await chart.prepareData();
        const alimentation = data.datasets.find((d) => d.label === 'Alimentation & Restau.');
        expect(alimentation.data.map(({ x, y }) => [x, Math.round(y * 100) / 100])).toEqual([
            ['2024-01', -165.5],
            ['2024-02', -158.3],
            ['2024-03', -150],
        ]);
        expect(data.datasets.find((d) => d.label === 'Banque').data).toEqual([]);
    });

    test('masque les catégories masquées par l\'utilisateur', async () => {
        chrome.storage.local._data.hiddenCategories = ['Logement'];
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const data = await chart.prepareData();
        expect(data.datasets.find((d) => d.label === 'Logement').hidden).toBe(true);
    });

    // --- B9 ----------------------------------------------------------------
    test('B9 — une dépense du 1er janvier 2024 est tracée en 2024-01, quel que soit le fuseau', async () => {
        const chart = new LineBarChart([tx({ date: '2024-01-01', categoryId: 188 })], CATEGORIES, null, {}, fakeSettings({}));
        const data = await chart.prepareData();
        expect(data.datasets.find((d) => d.label === 'Alimentation & Restau.').data[0].x).toBe('2024-01');
    });
});

describe('Graphiques — mois de rattachement Bankin (current_month)', () => {
    const moved = () => [
        tx({ id: 1, amount: -100, date: '2024-01-29', categoryId: 180, current_month: 1 }), // rattachée à février
        tx({ id: 2, amount: -50, date: '2024-01-10', categoryId: 180 }),
    ];

    test('page Catégories : la transaction apparaît dans son mois de rattachement', () => {
        const chart = new BaseChartData(moved(), CATEGORIES);
        expect(ids(chart.applySettingOnDataByMonth('février', 2024))).toEqual([1]);
        expect(ids(chart.applySettingOnDataByMonth('janvier', 2024))).toEqual([2]);
        expect(ids(chart.applySettingOnDataByMonth(2, '2024'))).toEqual([1]);
    });

    test('page Catégories : mois inconnu → aucune transaction', () => {
        const chart = new BaseChartData(moved(), CATEGORIES);
        expect(chart.applySettingOnDataByMonth('brumaire', 2024)).toEqual([]);
        expect(chart.applySettingOnDataByMonth('février', 'x')).toEqual([]);
    });

    test('graphique temporel : montant compté dans le mois de rattachement', async () => {
        const chart = new LineBarChart(moved(), CATEGORIES, null, {}, fakeSettings({}));
        const data = await chart.prepareData();
        expect(data.datasets.find((d) => d.label === 'Logement').data).toEqual([
            { x: '2024-02', y: -100 },
            { x: '2024-01', y: -50 },
        ]);
    });

    test('budget : montant rangé dans le mois de rattachement', async () => {
        const chart = new BudgetChart(moved(), CATEGORIES, null, {}, fakeSettings({}));
        await chart.initializationPromise;
        expect(chart.organizedData[2024][2].Logement).toEqual([-100]);
        expect(chart.organizedData[2024][1].Logement).toEqual([-50]);
    });

    test('la période des réglages porte sur le mois de rattachement', () => {
        const chart = new BaseChartData(moved(), CATEGORIES, null, null, fakeSettings({ startDate: '2024-02-01', endDate: '2024-02-29' }));
        expect(ids(chart.applySettingOnData())).toEqual([1]);
    });

    test('« pas de date de fin » : la période s\'étend jusqu\'à aujourd\'hui', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2024, 2, 20, 12));
        const transactions = [tx({ id: 1, date: '2024-03-19' }), tx({ id: 2, date: '2024-03-25' })];
        const settings = { startDate: '2024-01-01', endDate: '2024-01-31', noEndDate: true };
        const chart = new BaseChartData(transactions, CATEGORIES, null, null, fakeSettings(settings));
        expect(ids(chart.applySettingOnData())).toEqual([1]);
    });
});

describe('BudgetChart — infobulle', () => {
    // Contexte d'infobulle tel que Chart.js le fournit pour un graphique en barres :
    // `parsed` est un objet { x, y }, `raw` la valeur d'origine.
    const barContext = (y, label = 'Médiane 2026') => ({ dataset: { label }, parsed: { x: 0, y }, raw: y });

    test('B20 — affiche le montant de la barre, pas NaN', () => {
        expect(BudgetChart.formatTooltipLabel(barContext(-158.3), false)).toBe('Médiane 2026 : -158,30 €');
        expect(BudgetChart.formatTooltipLabel(barContext(0, 'Réel janv. 2024'), false)).toBe('Réel janv. 2024 : 0,00 €');
    });

    test('accepte aussi une valeur numérique simple', () => {
        expect(BudgetChart.formatTooltipLabel({ dataset: { label: 'A' }, parsed: 12 }, false)).toBe('A : 12,00 €');
        expect(BudgetChart.formatTooltipLabel({ dataset: { label: 'A' }, raw: 5 }, false)).toBe('A : 5,00 €');
    });

    test('valeur absente : pas de NaN', () => {
        expect(BudgetChart.formatTooltipLabel({ dataset: { label: 'A' }, parsed: {} }, false)).toBe('A : —');
    });

    test('montants masqués : seulement le libellé', () => {
        expect(BudgetChart.formatTooltipLabel(barContext(-158.3), true)).toBe('Médiane 2026');
        expect(BudgetChart.formatTooltipLabel({ dataset: {} }, true)).toBe('');
    });
});

describe('Graphiques — destruction (B16)', () => {
    test('BaseChartData.destroy détruit l\'instance Chart.js et son écouteur de masquage', () => {
        const chart = new BaseChartData([], CATEGORIES);
        const instance = { destroy: vi.fn(), options: { scales: {} }, update: vi.fn() };
        const add = vi.spyOn(window, 'addEventListener');
        const remove = vi.spyOn(window, 'removeEventListener');
        BaseChartData._attachAmountVisibilityListener(instance);
        const handler = add.mock.calls.find(([name]) => name === 'pecunio_amounts_visibility_changed')[1];
        chart.chartInstance = instance;
        chart.destroy();
        expect(instance.destroy).toHaveBeenCalled();
        expect(remove).toHaveBeenCalledWith('pecunio_amounts_visibility_changed', handler);
        expect(chart.chartInstance).toBeNull();
        expect(() => chart.destroy()).not.toThrow();
    });

    test('B16 — BudgetChart : un seul écouteur de stockage, retiré par destroy()', async () => {
        const chart = new BudgetChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        await chart.initializationPromise;
        chart._setupStorageListener();
        chart._setupStorageListener();
        expect(chrome.storage.onChanged.listenerCount).toBe(1);
        const budgetChart = { destroy: vi.fn() };
        chart.budgetChart = budgetChart;
        chart.destroy();
        expect(chrome.storage.onChanged.listenerCount).toBe(0);
        expect(budgetChart.destroy).toHaveBeenCalled();
        expect(chart.budgetChart).toBeNull();
    });

    test('B16 — BudgetChart : masquer une catégorie redessine le graphique affiché', async () => {
        const chart = new BudgetChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        await chart.initializationPromise;
        const update = vi.spyOn(chart, '_updateChartView').mockResolvedValue();
        chart._setupStorageListener();
        chart.budgetChart = { destroy() {} };
        chrome.storage.local.set({ hiddenCategories: ['Logement'] });
        chrome.storage.local.set({ Logement: true, autreCle: 1 });
        expect(update).toHaveBeenCalledTimes(1);
    });
});

describe('LineBarChart — taille (B23)', () => {
    test('B23 — canvas dans un conteneur de hauteur fixe, sans conserver le ratio', async () => {
        const container = LineBarChart.createCanvasContainer();
        expect(container.style.height).toBe(Config.CHART.LINE_CHART_HEIGHT);
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const config = await chart.getChartJsConfig();
        expect(config.options.maintainAspectRatio).toBe(false);
        expect(config.options.responsive).toBe(true);
    });
});

describe('Interface en français (D9)', () => {
    test('montants et pourcentages au format français', () => {
        expect(formatEuros(-1234.5)).toBe('-1\u202f234,50 €');
        expect(formatEuros(0)).toBe('0,00 €');
        expect(formatPercent(12.345)).toBe('12,3 %');
    });

    test('grand montant dans l\'infobulle de la comparaison budget', () => {
        const context = { dataset: { label: 'Médiane 2026' }, parsed: { x: 0, y: -2500 } };
        expect(BudgetChart.formatTooltipLabel(context, false)).toBe('Médiane 2026 : -2\u202f500,00 €');
    });

    test('comparaison budget : mois et calculs en français', async () => {
        const chart = new BudgetChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        expect(chart.monthsArray[0]).toBe('Tous les mois');
        expect(chart.monthsArray.slice(1, 4)).toEqual(['Janvier', 'Février', 'Mars']);
        expect(BudgetChart.calculationLabel('median')).toBe('Médiane');
        expect(BudgetChart.calculationLabel('average')).toBe('Moyenne');
    });

    test('graphique temporel : mois de l\'axe en français', async () => {
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const config = await chart.getChartJsConfig();
        expect(config.options.scales.x.adapters.date.locale).toBe(DATE_LOCALE);
        expect(DATE_LOCALE.code).toBe('fr');
    });
});

describe('LineBarChart — bouton de type de graphique (D10)', () => {
    test('vrai bouton HTML, au libellé explicite', () => {
        const onToggle = vi.fn();
        const button = LineBarChart.createChartTypeToggle('bar', onToggle);
        expect(button.tagName).toBe('BUTTON');
        expect(button.type).toBe('button');
        expect(button.textContent).toBe('Afficher en courbes');
        expect(LineBarChart.createChartTypeToggle('line', () => {}).textContent).toBe('Afficher en barres');
        button.click();
        expect(onToggle).toHaveBeenCalledTimes(1);
    });

    test('bascule : enregistre l\'autre type et prévient PageController', async () => {
        const settings = { ...fakeSettings({}), setSetting: vi.fn(() => Promise.resolve()) };
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, settings);
        chart.chartInstance = { config: { type: 'bar' } };
        const changed = vi.fn();
        window.addEventListener('pecunio_chart_type_changed', changed, { once: true });
        await chart.toggleChartType();
        expect(settings.setSetting).toHaveBeenCalledWith('chartType', 'line');
        expect(changed).toHaveBeenCalled();
    });

    test('sans préférences : type enregistré directement dans le stockage', async () => {
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, null);
        chart.chartInstance = { config: { type: 'line' } };
        await chart.toggleChartType();
        expect(chrome.storage.local._data.chartType).toBe('bar');
    });

    test('plus de bouton dessiné dans le canvas', async () => {
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const config = await chart.getChartJsConfig();
        expect(config.plugins).toBeUndefined();
    });
});
