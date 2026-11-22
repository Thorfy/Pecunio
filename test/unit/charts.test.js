import { describe, expect, test, vi } from 'vitest';
import { CATEGORIES, sampleTransactions, tx } from '../fixtures/bankin.js';
import { BaseChartData } from '../../js/charts/base/BaseChartData.js';
import { BudgetChart } from '../../js/charts/BudgetChart.js';
import { ExpenseTypeChart } from '../../js/charts/ExpenseTypeChart.js';
import { LineBarChart } from '../../js/charts/LineBarChart.js';
import { SankeyChart } from '../../js/charts/SankeyChart.js';
import { Config } from '../../js/core/Config.js';
import { DATE_LOCALE } from '../../js/lib/chart.js';
import { formatEuros, formatNumber, formatPercent } from '../../js/utils/format.js';

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
            ['Budget', 'Non dépensé', 1534.5],
            ['Budget', 'Dépenses', 965.5],
        ]);
    });

    test('dépenses supérieures aux revenus : « Dépassement » plutôt que « Non dépensé » (U9)', async () => {
        const data = await sankey([
            tx({ amount: 30, categoryId: 230, date: '2024-01-31' }),
            tx({ amount: -50, categoryId: 188, date: '2024-01-10' }),
        ]);
        expect(flows(data)).toEqual([
            ['Salaires', 'Budget', 30],
            ['Alimentation & Restau.', 'Supermarché / Epicerie', 50],
            ['Dépenses', 'Alimentation & Restau.', 50],
            ['Budget', 'Dépenses', 30],
            ['Dépassement', 'Dépenses', 20],
        ]);
        expect(data.at(-1).id).toBe('overspend');
    });

    test('petits flux regroupés : catégories et sous-catégories sous 2 % (U8)', () => {
        const data = [
            { from: 'Logement', to: 'Loyer', flow: 900, id: 161 },
            { from: 'Logement', to: 'Électricité', flow: 10, id: 161 },
            { from: 'Logement', to: 'Assurance', flow: 8, id: 161 },
            { from: 'Dépenses', to: 'Logement', flow: 918, id: 161 },
            { from: 'Banque', to: 'Frais', flow: 3, id: 164 },
            { from: 'Dépenses', to: 'Banque', flow: 3, id: 164 },
            { from: 'Santé', to: 'Pharmacie', flow: 5, id: 163 },
            { from: 'Dépenses', to: 'Santé', flow: 5, id: 163 },
            { from: 'Budget', to: 'Dépenses', flow: 926, id: 163 },
        ];
        // Ordre d'origine conservé ; « Budget → Dépenses » reste le dernier flux
        expect(flows(SankeyChart.groupSmallFlows(data))).toEqual([
            ['Logement', 'Loyer', 900],
            ['Logement', 'Logement (autres)', 18],
            ['Dépenses', 'Logement', 918],
            ['Dépenses', 'Autres dépenses', 8],
            ['Budget', 'Dépenses', 926],
        ]);
    });

    test('petites sous-catégories sans sous-catégorie détaillée : laissées telles quelles', () => {
        const data = [
            { from: 'Logement', to: 'Loyer', flow: 900, id: 161 },
            { from: 'Dépenses', to: 'Logement', flow: 900, id: 161 },
            { from: 'Loisirs', to: 'Sport', flow: 10, id: 170 },
            { from: 'Loisirs', to: 'Sorties', flow: 8, id: 170 },
            { from: 'Dépenses', to: 'Loisirs', flow: 18, id: 170 },
        ];
        expect(flows(SankeyChart.groupSmallFlows(data))).toEqual(flows(data));
    });

    test('petits flux : un seul sous le seuil reste tel quel ; mois sans dépense inchangé', () => {
        const data = [
            { from: 'Logement', to: 'Loyer', flow: 900, id: 161 },
            { from: 'Logement', to: 'Électricité', flow: 10, id: 161 },
            { from: 'Dépenses', to: 'Logement', flow: 910, id: 161 },
            { from: 'Dépenses', to: 'Santé', flow: 5, id: 163 },
        ];
        expect(SankeyChart.groupSmallFlows(data)).toHaveLength(4);
        const empty = [{ from: 'Budget', to: 'Dépenses', flow: 0, id: 163 }];
        expect(SankeyChart.groupSmallFlows(empty)).toEqual(empty);
    });

    test('couleurs : nœuds « Autres » et « Dépassement », gris sans règle CSS', () => {
        expect(SankeyChart.flowColor('others')).toBe('rgb(173, 184, 197)');
        expect(SankeyChart.flowColor('overspend')).toBe('rgb(252, 93, 106)');
        expect(SankeyChart.flowColor(99999)).toBe('rgb(173, 184, 197)');
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
        expect(data.labels).toEqual(['Essentiel', 'Plaisir']);
        expect(data.datasets[0].data).toEqual([920.5, 45]);
        expect(data.expenseTypes).toEqual(['ESSENTIAL', 'PLEASURE']);
    });

    test('aucune dépense → graphique « Aucune donnée »', async () => {
        const data = await expenseType([tx({ amount: 100 })]);
        expect(data.labels).toEqual(['Aucune donnée']);
    });

    test('sans paramètres : toutes les transactions ; type inconnu affiché tel quel', async () => {
        const data = await expenseType([tx({ amount: -5, expense_type: 'MYSTERE' })], null);
        expect(data.labels).toEqual(['MYSTERE']);
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
        // Catégorie sans opération sur la période : pas de série
        expect(data.datasets.find((d) => d.label === 'Banque')).toBeUndefined();
        // Solde du mois en ligne, hors pile des catégories
        expect(data.datasets.at(-1)).toMatchObject({ type: 'line', label: 'Solde du mois', stack: 'solde' });
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
            { x: '2024-01', y: -50 },
            { x: '2024-02', y: -100 },
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
        expect(formatNumber(-1500)).toBe('-1\u202f500');
        expect(formatNumber(2.5)).toBe('2,5');
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

    test("graduations de l'axe des montants au format français", async () => {
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const config = await chart.getChartJsConfig();
        expect(config.options.scales.y.ticks.callback(8000)).toBe('8\u202f000');
    });

    test('plus de bouton dessiné dans le canvas', async () => {
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        const config = await chart.getChartJsConfig();
        expect(config.plugins).toBeUndefined();
    });
});

describe('BudgetChart — préréglages et comparaison (UX-2a)', () => {
    const settingsWith = (values = {}) => ({ ...fakeSettings(values), setSetting: vi.fn(() => Promise.resolve()) });
    const budgetAt = async (now, values = {}) => {
        const chart = new BudgetChart(sampleTransactions(), CATEGORIES, null, {}, settingsWith(values));
        chart.now = () => now;
        await chart.initializationPromise;
        return chart;
    };

    test('médiane mensuelle sur une liste de mois, mois sans opération comptés à zéro', async () => {
        const chart = await budgetAt(new Date(2024, 3, 15));
        const median = chart.getCalculatedValueOverMonths([{ year: 2024, month: 1 }, { year: 2024, month: 2 }, { year: 2024, month: 3 }]);
        expect(median.Logement).toBe(-800);
        expect(median['Alimentation & Restau.']).toBe(-158.3);
        expect(chart.getCalculatedValueOverMonths([{ year: 2030, month: 1 }]).Logement).toBe(0);
    });

    test('« mois dernier » : mars 2024 face à la médiane des 12 mois précédents', async () => {
        const chart = await budgetAt(new Date(2024, 3, 15), { budgetPreset: 'last' });
        const comparison = await chart.getComparison();
        expect(comparison.primaryLabel).toBe('Mars 2024');
        expect(comparison.comparisonLabel).toBe('Médiane des 12 mois précédents');
        expect(comparison.primary.Logement).toBe(-800);
        // Seuls janvier et février 2024 ont des opérations : la médiane sur 12 mois vaut 0
        expect(comparison.comparison.Logement).toBe(0);
    });

    test('interface : préréglage enregistré, bouton actif, panneau « Personnaliser », synthèse et barres triées', async () => {
        document.body.innerHTML = '<div id="budgetChartBlock"></div>';
        const settings = settingsWith({ budgetPreset: 'last' });
        const chart = new BudgetChart(sampleTransactions(), CATEGORIES, null, {}, settings);
        chart.now = () => new Date(2024, 2, 15); // mois dernier = février 2024
        chart.createUI('budgetChartBlock');
        await chart.initializationPromise;
        await vi.waitFor(() => expect(chart.lastComparison).toBeDefined());

        const pressed = () => [...document.querySelectorAll('.pecunio-budget-presets button[aria-pressed="true"]')].map((b) => b.textContent);
        expect(pressed()).toEqual(['Mois dernier']);
        expect(document.querySelector('.pecunio-budget-custom').hidden).toBe(true);
        // Dépenses seules (pas les revenus), de la plus importante à la plus faible
        expect(chart.lastComparison.rows.map((r) => r.name)).toEqual(['Logement', 'Alimentation & Restau.']);
        expect(document.querySelector('.pecunio-budget-summary').textContent).toMatch(/^Dépenses : .*Février 2024.*écart/);

        chart.lastComparison = undefined;
        document.querySelector('.pecunio-budget-presets button[data-preset="custom"]').click();
        expect(settings.setSetting).toHaveBeenCalledWith('budgetPreset', 'custom');
        expect(pressed()).toEqual(['Personnaliser']);
        expect(document.querySelector('.pecunio-budget-custom').hidden).toBe(false);
        await vi.waitFor(() => expect(chart.lastComparison).toBeDefined());
        chart.destroy();
        document.body.innerHTML = '';
    });

    test('revenus et catégories masquées exclus de la comparaison', async () => {
        chrome.storage.local._data.hiddenCategories = ['Logement'];
        const chart = await budgetAt(new Date(2024, 2, 15));
        const excluded = await chart._excludedCategories();
        expect([...excluded].sort()).toEqual(["Entrées d'argent", 'Logement']);
    });

    test('infobulle des barres horizontales : valeur sur l\'axe X', () => {
        const context = { dataset: { label: 'Mars 2024' }, parsed: { x: 158.3, y: 2 } };
        expect(BudgetChart.formatTooltipLabel(context, false, 'x')).toBe('Mars 2024 : 158,30 €');
    });
});

describe('LineBarChart — barre d\'outils (UX-2a)', () => {
    test('période : un bouton par durée, l\'actif marqué, clic sur un autre', () => {
        const onSelect = vi.fn();
        const group = LineBarChart.createRangeSelector('12m', onSelect);
        const buttons = [...group.querySelectorAll('button')];
        expect(buttons.map((b) => b.textContent)).toEqual(['6 mois', '12 mois', '24 mois', 'Tout']);
        expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false', 'false']);
        buttons[1].click();
        expect(onSelect).not.toHaveBeenCalled();
        buttons[3].click();
        expect(onSelect).toHaveBeenCalledWith('all');
    });

    test('détail : libellé selon la vue', () => {
        expect(LineBarChart.createDetailToggle(false, () => {}).textContent).toBe('Toutes les catégories');
        expect(LineBarChart.createDetailToggle(true, () => {}).textContent).toBe('Vue simplifiée');
    });

    test('préférences enregistrées et graphique prévenu', async () => {
        const settings = { ...fakeSettings({ chartRange: '6m' }), setSetting: vi.fn(() => Promise.resolve()) };
        const chart = new LineBarChart(sampleTransactions(), CATEGORIES, null, {}, settings);
        expect(chart._option('chartRange')).toBe('6m');
        expect(chart._option('chartDetailed')).toBe(false); // valeur par défaut
        const changed = vi.fn();
        window.addEventListener('pecunio_chart_type_changed', changed, { once: true });
        await chart._saveOption('chartDetailed', true);
        expect(settings.setSetting).toHaveBeenCalledWith('chartDetailed', true);
        expect(changed).toHaveBeenCalled();
    });

    test('titre selon la période', () => {
        expect(LineBarChart.title('12m')).toBe('Revenus et dépenses — 12 mois');
        expect(LineBarChart.title('all')).toBe('Revenus et dépenses par mois');
    });
});

describe('BudgetChart — couleurs des catégories', () => {
    test('même couleur, plus claire, pour la période de référence', () => {
        expect(BudgetChart.withAlpha('rgb(255, 178, 0)', 0.35)).toBe('rgba(255, 178, 0, 0.35)');
        expect(BudgetChart.withAlpha('rgba(1, 2, 3, 1)', 0.5)).toBe('rgba(1, 2, 3, 0.5)');
        expect(BudgetChart.withAlpha('#6562fc', 0.5)).toBe('#6562fc');
    });

    test('couleur de Bankin de chaque catégorie, violet à défaut', async () => {
        const style = document.createElement('style');
        style.textContent = '.categoryColor_159 { background-color: rgb(103, 127, 224); }';
        document.head.appendChild(style);
        const chart = new BudgetChart(sampleTransactions(), CATEGORIES, null, {}, fakeSettings({}));
        expect(chart._categoryColors(['Logement', 'Banque', 'Inconnue'])).toEqual(['rgb(103, 127, 224)', '#6562fc', '#6562fc']);
        style.remove();
    });
});

describe('ExpenseTypeChart — total et pourcentages (U7)', () => {
    test('types dans un ordre fixe : Essentiel, Plaisir, Épargne, Autre', async () => {
        forceBrowserLocale('fr-FR');
        const data = await new ExpenseTypeChart([
            tx({ amount: -10, expense_type: 'OTHER' }),
            tx({ amount: -30, expense_type: 'PLEASURE' }),
            tx({ amount: -60, expense_type: 'ESSENTIAL' }),
        ], CATEGORIES, null).prepareData();
        expect(data.labels).toEqual(['Essentiel', 'Plaisir', 'Autre']);
        expect(data.datasets[0].data).toEqual([60, 30, 10]);
    });

    test('légende : part de chaque type en pourcentage', () => {
        expect(ExpenseTypeChart.legendText('Essentiel', [60, 30, 10], 0)).toBe('Essentiel · 60,0 %');
        expect(ExpenseTypeChart.legendText('Aucune donnée', [1], 0)).toBe('Aucune donnée');
    });

    test('en-tête : type principal en part arrondie (aucun montant)', () => {
        expect(ExpenseTypeChart.mainType(['Essentiel', 'Plaisir', 'Épargne'], [453, 81, 168])).toEqual({ share: '65 %', label: 'Essentiel' });
        expect(ExpenseTypeChart.mainType(['Aucune donnée'], [1])).toBeNull();
        expect(ExpenseTypeChart.mainType(['Essentiel'], [0])).toBeNull();
        expect(ExpenseTypeChart.createHeader({ share: '65 %', label: 'Essentiel' }).textContent).toBe('65 %Essentiel, type principal');
        expect(ExpenseTypeChart.createHeader(null).textContent).toBe('—Aucune dépense ce mois-ci');
    });
});
