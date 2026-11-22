import { beforeAll, describe, expect, test } from 'vitest';
import { REPORT_SCRIPTS, loadScripts } from '../helpers/load.js';

beforeAll(() => loadScripts(REPORT_SCRIPTS));

/** Ligne fusionnée (format de sortie de DataMerger.mergeData). */
const row = (overrides = {}) => ({
    transactionId: 1,
    date: '2024-03-15',
    amount: -10,
    description: 'Achat',
    categoryId: 188,
    categoryName: 'Supermarché',
    parentCategoryId: 168,
    parentCategoryName: 'Alimentation',
    expenseType: 'ESSENTIAL',
    ...overrides,
});

describe('ReportFilters.applyReportFilters', () => {
    test('exclut les catégories d\'exception de Config par défaut', () => {
        const rows = [row({ categoryId: 326 }), row({ categoryId: 282 }), row({ categoryId: 188 })];
        expect(ReportFilters.applyReportFilters(rows).map((r) => r.categoryId)).toEqual([188]);
    });

    test('accepte une liste d\'exceptions explicite et des ids en texte', () => {
        const rows = [row({ categoryId: '188' }), row({ categoryId: 189 })];
        expect(ReportFilters.applyReportFilters(rows, { exceptionCategoryIds: [188] }).map((r) => r.categoryId)).toEqual([189]);
    });

    test('utilise la catégorie parente si la catégorie est absente, garde les lignes sans catégorie', () => {
        const rows = [row({ categoryId: null, parentCategoryId: 326 }), row({ categoryId: null, parentCategoryId: null })];
        expect(ReportFilters.applyReportFilters(rows)).toHaveLength(1);
    });
});

describe('ReportFilters — statistiques', () => {
    const rows = [
        row({ amount: 2000, expenseType: 'OTHER', description: 'Salaire', categoryName: 'Salaires' }),
        row({ amount: -500 }),
        row({ amount: -200, expenseType: 'SAVING' }),
        row({ amount: 50, description: 'Remboursement mutuelle', expenseType: 'OTHER' }),
        row({ amount: -30, description: 'achat', categoryName: 'Avoir magasin' }),
    ];

    test('filterIncomeExpenseData exclut l\'épargne et les remboursements / avoirs', () => {
        expect(ReportFilters.filterIncomeExpenseData(rows).map((r) => r.amount)).toEqual([2000, -500]);
    });

    test('computeIncomeExpenseForChart et computeStatsLikeIncomeExpenseChart sont cohérents', () => {
        expect(ReportFilters.computeIncomeExpenseForChart(rows)).toEqual({ totalIncome: 2000, totalExpenses: 500 });
        expect(ReportFilters.computeStatsLikeIncomeExpenseChart(rows)).toEqual({
            totalTransactions: 2,
            totalIncome: 2000,
            totalExpenses: 500,
        });
    });
});

describe('ReportChartDataBuilder', () => {
    test('types de dépense : ordre fixe, libellés français, revenus ignorés', () => {
        const data = ReportChartDataBuilder.buildExpenseTypeData([
            row({ amount: -10, expenseType: 'PLEASURE' }),
            row({ amount: -20, expenseType: 'ESSENTIAL' }),
            row({ amount: -5, expenseType: 'CUSTOM' }),
            row({ amount: -1, expenseType: null }),
            row({ amount: 100, expenseType: 'ESSENTIAL' }),
        ]);
        expect(data.labels).toEqual(['Essentiel', 'Plaisir', 'Autre', 'CUSTOM']);
        expect(data.data).toEqual([20, 10, 1, 5]);
        expect(data.colors).toHaveLength(4);
    });

    test('catégories : regroupées par parent, triées, limitées à 12', () => {
        const rows = Array.from({ length: 14 }, (_, i) => row({ amount: -(i + 1), parentCategoryName: `Cat ${i + 1}` }));
        rows.push(row({ amount: -100, parentCategoryName: null, categoryName: null }));
        const data = ReportChartDataBuilder.buildCategoryData(rows);
        expect(data.labels).toHaveLength(12);
        expect(data.labels[0]).toBe('Non catégorisé');
        expect(data.data[1]).toBe(14);
        expect(ReportChartDataBuilder.buildPolarData(rows)).toEqual(data);
    });

    test('évolution : un point par mois et par catégorie, mois en français', () => {
        const data = ReportChartDataBuilder.buildEvolutionData([
            row({ date: '2024-02-03', amount: -10, parentCategoryName: 'A' }),
            row({ date: '2024-01-03', amount: -5, parentCategoryName: 'A' }),
            row({ date: '2024-01-20', amount: -7, parentCategoryName: 'B' }),
            row({ date: null, amount: -99 }),
            row({ date: '2024-01-20', amount: 50 }),
        ]);
        expect(data.labels).toEqual(['Jan 2024', 'Fév 2024']);
        expect(data.datasets.map((d) => [d.label, d.data])).toEqual([
            ['A', [5, 10]],
            ['B', [7, 0]],
        ]);
    });

    test('évolution : regroupe par mois de rattachement quand il est connu', () => {
        const data = ReportChartDataBuilder.buildEvolutionData([
            row({ date: '2024-01-29', budgetMonth: '2024-02', amount: -10, parentCategoryName: 'A' }),
            row({ date: '2024-02-03', budgetMonth: '2024-02', amount: -5, parentCategoryName: 'A' }),
        ]);
        expect(data.labels).toEqual(['Fév 2024']);
        expect(data.datasets[0].data).toEqual([15]);
    });

    test('Sankey : Dépenses → parents → sous-catégories', () => {
        const { data, colorMap } = ReportChartDataBuilder.buildSankeyData([
            row({ amount: -30, parentCategoryName: 'Alimentation', categoryName: 'Supermarché' }),
            row({ amount: -20, parentCategoryName: 'Alimentation', categoryName: 'Restaurants' }),
            row({ amount: -10, parentCategoryName: 'Divers', categoryName: 'Divers' }),
            row({ amount: 99 }),
        ]);
        expect(data.map(({ from, to, flow }) => [from, to, flow])).toEqual([
            ['Dépenses', 'Alimentation', 50],
            ['Dépenses', 'Divers', 10],
            ['Alimentation', 'Supermarché', 30],
            ['Alimentation', 'Restaurants', 20],
        ]);
        expect(colorMap.filter(Boolean)).toHaveLength(4);
    });
});

describe('ReportStorage', () => {
    test('enregistre puis relit les données du rapport', async () => {
        await ReportStorage.saveReportData([row()], { total: 1 }, { startDate: '2024-01-01' });
        await expect(ReportStorage.loadReportData()).resolves.toEqual({
            mergedData: [row()],
            stats: { total: 1 },
            params: { startDate: '2024-01-01' },
        });
    });

    test('paramètres absents → objets vides', async () => {
        await ReportStorage.saveReportData([], undefined, undefined);
        await expect(ReportStorage.loadReportData()).resolves.toMatchObject({ params: {} });
    });

    test('rejette s\'il n\'y a pas de rapport', async () => {
        await expect(ReportStorage.loadReportData()).rejects.toThrow('Aucune donnée de rapport');
    });

    test('remonte les erreurs chrome.runtime.lastError', async () => {
        chrome.storage.local.get.mockImplementationOnce((_keys, cb) => {
            chrome.runtime.lastError = { message: 'quota' };
            cb({});
            chrome.runtime.lastError = undefined;
        });
        await expect(ReportStorage.loadReportData()).rejects.toThrow('quota');
    });
});
