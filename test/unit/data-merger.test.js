import { describe, expect, test, vi } from 'vitest';
import { ACCOUNTS, CATEGORIES, sampleTransactions, tx } from '../fixtures/bankin.js';
import { Config } from '../../js/core/Config.js';
import { TransactionFilter } from '../../js/core/TransactionFilter.js';
import { ReportFilters } from '../../js/report/ReportFilters.js';
import { DataMerger } from '../../js/services/DataMerger.js';

const merger = (transactions = sampleTransactions(), options = {}) =>
    new DataMerger(
        transactions,
        CATEGORIES,
        ACCOUNTS,
        options.startDate ?? null,
        options.endDate ?? null,
        options.accountsSelected ?? null,
    );

describe('DataMerger — préparation des données', () => {
    test('ignore les entrées non tableau', () => {
        const m = new DataMerger(null, 'x', undefined);
        expect(m.transactions).toEqual([]);
        expect(m.categorizations).toEqual([]);
        expect(m.accounts).toEqual([]);
    });

    test('écarte les transactions, comptes et catégories invalides', () => {
        const m = new DataMerger(
            [tx({ id: 1 }), { amount: -1 }, { id: 3, amount: -1, date: '2024-01-01' }],
            [...CATEGORIES, { id: 999 }],
            [...ACCOUNTS, { id: 3 }],
        );
        expect(m.transactions.map((t) => t.id)).toEqual([1]);
        expect(m.accounts).toHaveLength(2);
        expect(m.categorizations.some((c) => c.id === 999)).toBe(false);
    });

    test('aplatit les catégories en gardant le parent', () => {
        const m = merger();
        expect(m.categoryMap.get(188)).toMatchObject({ name: 'Supermarché / Epicerie', parentId: 168 });
        expect(m.categoryMap.get(168)).toMatchObject({ name: 'Alimentation & Restau.', parentId: null });
    });
});

describe('DataMerger.mergeData', () => {
    test('enrichit chaque transaction (compte, catégorie, parent) et trie par date', () => {
        const rows = merger().mergeData();
        expect(rows).toHaveLength(13);
        const courses = rows.find((r) => r.transactionId === 3);
        expect(courses).toMatchObject({
            amount: -120.5,
            description: 'Courses',
            accountId: 101,
            accountName: 'Compte courant',
            categoryId: 188,
            categoryName: 'Supermarché / Epicerie',
            parentCategoryId: 168,
            parentCategoryName: 'Alimentation & Restau.',
            expenseType: 'ESSENTIAL',
        });
        const dates = rows.map((r) => r.date);
        expect([...dates].sort()).toEqual(dates);
    });

    test('catégorie inconnue → « Uncategorized »', () => {
        const [row] = merger([tx({ categoryId: 4242 })]).mergeData();
        expect(row).toMatchObject({ categoryId: null, categoryName: 'Uncategorized', parentCategoryName: 'Uncategorized' });
    });

    test('filtre par compte sélectionné', () => {
        const rows = merger(sampleTransactions(), { accountsSelected: [102] }).mergeData();
        expect(rows.map((r) => r.transactionId)).toEqual([6]);
    });

    test('filtre par période, bornes incluses, au jour près', () => {
        const rows = merger(sampleTransactions(), { startDate: '2024-02-05', endDate: '2024-02-14' }).mergeData();
        expect(rows.map((r) => r.transactionId).sort((a, b) => a - b)).toEqual([8, 9, 10]);
    });

    // --- B8 -------------------------------------------------------------
    test('B8 — une transaction d\'un compte supprimé est exportée avec un nom de repli', () => {
        const [row] = merger([tx({ accountId: 999 })]).mergeData();
        expect(row.accountId).toBe(999);
        expect(row.accountName).toBe(DataMerger.UNKNOWN_ACCOUNT);
    });

    // --- B10 (décision : vraie date + mois de rattachement) ---------------
    test('B10 — la date exportée est la date réelle de la transaction', () => {
        const [row] = merger([tx({ date: '2024-03-15' })]).mergeData();
        expect(row.date).toBe('2024-03-15');
        expect(row.budgetMonth).toBe('2024-03');
    });

    test('B10 — le mois de rattachement Bankin est exporté à côté de la date réelle', () => {
        const [row] = merger([tx({ date: '2024-01-28', current_month: 1 })]).mergeData();
        expect(row).toMatchObject({ date: '2024-01-28', budgetMonth: '2024-02' });
    });

    test('B10 — la période porte sur le mois de rattachement', () => {
        const transactions = [tx({ id: 1, date: '2024-01-28', current_month: 1 }), tx({ id: 2, date: '2024-01-28' })];
        const rows = merger(transactions, { startDate: '2024-02-01', endDate: '2024-02-29' }).mergeData();
        expect(rows.map((r) => r.transactionId)).toEqual([1]);
    });

    // --- B14 ------------------------------------------------------------
    test('B14 — l\'export CSV garde toutes les catégories (le rapport exclut les exceptions ensuite)', () => {
        const rows = merger().mergeData();
        expect(rows.map((r) => r.categoryId)).toContain(326);
        const reportRows = ReportFilters.applyReportFilters(rows);
        for (const excluded of Config.CATEGORIES.EXCEPTION_IDS) {
            expect(reportRows.map((r) => r.categoryId)).not.toContain(excluded);
        }
    });

    test('B14 — la date de début s\'applique même sans date de fin', () => {
        const rows = merger(sampleTransactions(), { startDate: '2024-03-01' }).mergeData();
        expect(rows.map((r) => r.transactionId).sort((a, b) => a - b)).toEqual([12, 13]);
    });

    test('B14 — la date de fin s\'applique même sans date de début', () => {
        const rows = merger(sampleTransactions(), { endDate: '2024-01-12' }).mergeData();
        expect(rows.map((r) => r.transactionId).sort((a, b) => a - b)).toEqual([2, 3]);
    });

    test('B14 — même résultat que le filtre des graphiques pour la même période', () => {
        const options = { startDate: '2024-01-10', endDate: '2024-02-20', accountsSelected: [101] };
        const exported = merger(sampleTransactions(), options).mergeData().map((r) => r.transactionId);
        const charted = TransactionFilter.apply(sampleTransactions(), options).map((t) => t.id);
        expect(exported.sort((a, b) => a - b)).toEqual(charted.sort((a, b) => a - b));
    });
});

describe('DataMerger.getStats', () => {
    test('totaux revenus / dépenses / solde', () => {
        const stats = merger([tx({ amount: 100 }), tx({ amount: -30 }), tx({ amount: -20 })]).getStats();
        expect(stats).toMatchObject({ totalTransactions: 3, totalAmount: 50, totalExpenses: 50, totalIncome: 100 });
    });

    test('nombre de comptes : sélection ou tous', () => {
        expect(merger(sampleTransactions(), { accountsSelected: [101] }).getStats().accountsCount).toBe(1);
        expect(merger().getStats().accountsCount).toBe(2);
    });
});

describe('DataMerger — CSV', () => {
    const row = (overrides = {}) => ({
        transactionId: 1,
        date: '2024-03-15',
        budgetMonth: '2024-03',
        amount: -12.5,
        description: 'Courses',
        accountId: 101,
        accountName: 'Compte courant',
        categoryId: 188,
        categoryName: 'Supermarché',
        parentCategoryId: 168,
        parentCategoryName: 'Alimentation',
        expenseType: 'ESSENTIAL',
        ...overrides,
    });

    /** Découpe un CSV RFC 4180 en lignes de cellules (guillemets doublés, sauts de ligne cités). */
    const parseCsv = (csv) => {
        const rows = [];
        let cells = [];
        let cell = '';
        let quoted = false;
        for (let i = 0; i < csv.length; i++) {
            const c = csv[i];
            if (quoted && c === '"' && csv[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (c === '"') {
                quoted = !quoted;
            } else if (c === ',' && !quoted) {
                cells.push(cell);
                cell = '';
            } else if (c === '\r' && csv[i + 1] === '\n' && !quoted) {
                cells.push(cell);
                rows.push(cells);
                cells = [];
                cell = '';
                i++;
            } else {
                cell += c;
            }
        }
        cells.push(cell);
        rows.push(cells);
        return rows;
    };

    /** Capture le fichier CSV produit par exportToCSV (contenu et nom). */
    const captureExport = async (transactions) => {
        let blob = null;
        let filename = '';
        vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => {
            blob = b;
            return 'blob:pecunio-test';
        });
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            filename = this.getAttribute('download');
        });
        const count = merger(transactions).exportToCSV();
        return { text: await blob.text(), filename, count, type: blob.type };
    };

    test('en-tête et une ligne par transaction, séparées par CRLF', () => {
        const csv = merger().convertToCSV([row(), row({ transactionId: 2 })]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe(
            'Transaction ID,Date,Budget Month,Amount,Description,Account ID,Account Name,Category ID,Category Name,Parent Category ID,Parent Category Name,Expense Type',
        );
        expect(parseCsv(lines[1])[0]).toEqual([
            '1', '2024-03-15', '2024-03', '-12.5', 'Courses', '101', 'Compte courant', '188', 'Supermarché', '168', 'Alimentation', 'ESSENTIAL',
        ]);
    });

    test('cellules : nombres bruts, textes cités, valeurs absentes vides', () => {
        expect(DataMerger.escapeCsvCell(-12.5)).toBe('-12.5');
        expect(DataMerger.escapeCsvCell(NaN)).toBe('');
        expect(DataMerger.escapeCsvCell(null)).toBe('');
        expect(DataMerger.escapeCsvCell(undefined)).toBe('');
        expect(DataMerger.escapeCsvCell('Courses')).toBe('"Courses"');
    });

    // --- B7 -------------------------------------------------------------
    test('B7 — un guillemet dans la description ne décale pas les colonnes', () => {
        const csv = merger().convertToCSV([row({ description: 'Boutique "Le Coin"' })]);
        const cells = parseCsv(csv)[1];
        expect(cells).toHaveLength(12);
        expect(cells[4]).toBe('Boutique "Le Coin"');
    });

    test('B7 — virgules et retours à la ligne restent dans leur cellule', () => {
        const csv = merger().convertToCSV([row({ description: 'Ligne 1, suite\r\nLigne 2' })]);
        const rows = parseCsv(csv);
        expect(rows).toHaveLength(2);
        expect(rows[1][4]).toBe('Ligne 1, suite\r\nLigne 2');
    });

    test.each(['=HYPERLINK("http://exemple.invalid")', '+33 1', '-retrait', '@SUM(A1)', '\tcmd'])(
        'B7 — formule neutralisée : %s',
        (description) => {
            const cells = parseCsv(merger().convertToCSV([row({ description })]))[1];
            expect(cells[4]).toBe(`'${description}`);
        },
    );

    test('B7 — un « # » dans une description ne tronque pas le fichier exporté', async () => {
        const { text, count } = await captureExport([tx({ description: 'Commande #42' }), tx({ description: 'Après' })]);
        const rows = parseCsv(text.replace(/^\uFEFF/, ''));
        expect(count).toBe(2);
        expect(rows).toHaveLength(3);
        expect(rows[1][4]).toBe('Commande #42');
        expect(rows[2][4]).toBe('Après');
    });

    test('B7 — fichier UTF-8 avec BOM (accents lisibles dans Excel)', async () => {
        const { text, type } = await captureExport([tx({ description: 'Café' })]);
        expect(text.charCodeAt(0)).toBe(0xfeff);
        expect(type).toBe('text/csv;charset=utf-8');
    });

    test('B7 — le nom de fichier est daté au format AAAA-MM-JJ, sans « / »', async () => {
        vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
        vi.setSystemTime(new Date(2024, 2, 15, 10));
        const { filename } = await captureExport([tx()]);
        expect(filename).toBe('transaction_export_2024-03-15.csv');
    });

    test('exportToCSV déclenche un seul téléchargement et nettoie le lien', async () => {
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pecunio-test');
        const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        merger([tx()]).exportToCSV();
        expect(click).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('a[download]')).toHaveLength(0);
        await vi.waitFor(() => expect(revoke).toHaveBeenCalledWith('blob:pecunio-test'));
    });
});
