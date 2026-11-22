import { beforeAll, describe, expect, test, vi } from 'vitest';
import { ACCOUNTS, CATEGORIES, sampleTransactions, tx } from '../fixtures/bankin.js';
import { knownBug } from '../helpers/known-bug.js';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts);

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

    test('filtre par période quand les deux bornes sont fournies (au mois près, cf. B10)', () => {
        const rows = merger(sampleTransactions(), { startDate: '2024-02-01', endDate: '2024-02-29' }).mergeData();
        expect(rows.map((r) => r.transactionId).sort((a, b) => a - b)).toEqual([7, 8, 9, 10, 11]);
    });

    // --- B8 -------------------------------------------------------------
    test('B8 — comportement actuel : un compte supprimé fait planter la fusion', () => {
        expect(() => merger([tx({ accountId: 999 })]).mergeData()).toThrow(TypeError);
    });

    knownBug('B8 — attendu : une transaction d\'un compte supprimé est exportée avec un nom de repli', () => {
        const [row] = merger([tx({ accountId: 999 })]).mergeData();
        expect(row.accountId).toBe(999);
        expect(row.accountName).toBeTruthy();
    });

    // --- B10 ------------------------------------------------------------
    test('B10 — comportement actuel : la date exportée est ramenée au début du mois', () => {
        const [row] = merger([tx({ date: '2024-03-15' })]).mergeData();
        expect(row.date.slice(0, 7)).toBe('2024-03');
        expect(row.date).not.toBe('2024-03-15');
    });

    test.todo('B10 — à décider : la date exportée doit-elle rester la date réelle de la transaction ?');

    // --- B14 ------------------------------------------------------------
    test('B14 — comportement actuel : l\'export inclut les catégories d\'exception', () => {
        const ids = merger().mergeData().map((r) => r.categoryId);
        expect(ids).toContain(326);
        expect(ids).toContain(282);
    });

    knownBug('B14 — attendu : l\'export exclut les mêmes catégories que les graphiques', () => {
        const ids = merger().mergeData().map((r) => r.categoryId);
        for (const excluded of Config.CATEGORIES.EXCEPTION_IDS) expect(ids).not.toContain(excluded);
    });

    test('B14 — comportement actuel : une seule borne de date est ignorée', () => {
        const rows = merger(sampleTransactions(), { startDate: '2024-03-01' }).mergeData();
        expect(rows).toHaveLength(13);
    });

    knownBug('B14 — attendu : la date de début s\'applique même sans date de fin', () => {
        const rows = merger(sampleTransactions(), { startDate: '2024-03-01' }).mergeData();
        expect(rows.map((r) => r.transactionId).sort((a, b) => a - b)).toEqual([12, 13]);
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

    /** Découpe une ligne CSV RFC 4180 (guillemets doublés). */
    const parseCsvLine = (line) => {
        const cells = [];
        let cell = '';
        let quoted = false;
        for (let i = 0; i < line.length; i++) {
            const c = line[i];
            if (quoted && c === '"' && line[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (c === '"') {
                quoted = !quoted;
            } else if (c === ',' && !quoted) {
                cells.push(cell);
                cell = '';
            } else {
                cell += c;
            }
        }
        cells.push(cell);
        return cells;
    };

    test('en-tête et une ligne par transaction, séparées par CRLF', () => {
        const csv = merger().convertToCSV([row(), row({ transactionId: 2 })]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toBe(
            'Transaction ID,Date,Amount,Description,Account ID,Account Name,Category ID,Category Name,Parent Category ID,Parent Category Name,Expense Type',
        );
        expect(parseCsvLine(lines[1])).toEqual([
            '1', '2024-03-15', '-12.5', 'Courses', '101', 'Compte courant', '188', 'Supermarché', '168', 'Alimentation', 'ESSENTIAL',
        ]);
    });

    // --- B7 -------------------------------------------------------------
    knownBug('B7 — attendu : un guillemet dans la description ne décale pas les colonnes', () => {
        const csv = merger().convertToCSV([row({ description: 'Boutique "Le Coin"' })]);
        const cells = parseCsvLine(csv.split('\r\n')[1]);
        expect(cells).toHaveLength(11);
        expect(cells[3]).toBe('Boutique "Le Coin"');
    });

    knownBug('B7 — attendu : les formules Excel sont neutralisées', () => {
        const csv = merger().convertToCSV([row({ description: '=HYPERLINK("http://exemple.invalid")' })]);
        const cells = parseCsvLine(csv.split('\r\n')[1]);
        expect(cells[3].startsWith('=')).toBe(false);
    });

    knownBug('B7 — attendu : un « # » dans une description ne tronque pas le fichier exporté', () => {
        let href = '';
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            href = this.getAttribute('href');
        });
        merger([tx({ description: 'Commande #42' }), tx({ description: 'Après' })]).exportToCSV();
        // Le navigateur considère tout ce qui suit un « # » brut comme un fragment d'URL.
        expect(href).not.toContain('#');
    });

    knownBug('B7 — attendu : le nom de fichier ne contient pas de « / »', () => {
        let filename = '';
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
            filename = this.getAttribute('download');
        });
        vi.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('15/03/2024');
        merger([tx()]).exportToCSV();
        expect(filename).not.toContain('/');
    });

    test('exportToCSV déclenche un téléchargement', () => {
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
        merger([tx()]).exportToCSV();
        expect(click).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll('a[download]')).toHaveLength(0);
    });
});
