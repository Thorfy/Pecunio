import { describe, expect, test } from 'vitest';
import { sampleTransactions, tx } from '../fixtures/bankin.js';
import { Config } from '../../js/core/Config.js';
import { TransactionFilter } from '../../js/core/TransactionFilter.js';
import { Transaction } from '../../js/models/Transaction.js';

const ids = (list) => list.map((t) => t.id).sort((a, b) => a - b);

describe('TransactionFilter', () => {
    test('sans critère : toutes les transactions datées', () => {
        expect(TransactionFilter.apply(sampleTransactions())).toHaveLength(13);
        expect(TransactionFilter.apply([tx({ id: 1 }), { id: 2 }, null])).toHaveLength(1);
    });

    test('entrée non tableau → tableau vide', () => {
        expect(TransactionFilter.apply(null)).toEqual([]);
    });

    test('période : bornes incluses, chacune optionnelle', () => {
        const all = sampleTransactions();
        expect(ids(TransactionFilter.apply(all, { startDate: '2024-02-05', endDate: '2024-02-14' }))).toEqual([8, 9, 10]);
        expect(ids(TransactionFilter.apply(all, { startDate: '2024-03-01' }))).toEqual([12, 13]);
        expect(ids(TransactionFilter.apply(all, { endDate: '2024-01-12' }))).toEqual([2, 3]);
    });

    test('bornes acceptées sous forme de Date locale', () => {
        const kept = TransactionFilter.apply(sampleTransactions(), { startDate: new Date(2024, 2, 1), endDate: new Date(2024, 2, 31) });
        expect(ids(kept)).toEqual([12, 13]);
    });

    test('comptes : nombres ou chaînes, transactions brutes ou modèles', () => {
        expect(ids(TransactionFilter.apply(sampleTransactions(), { accountsSelected: ['102'] }))).toEqual([6]);
        const model = Transaction.fromRaw(tx({ id: 1, accountId: 102 }));
        expect(TransactionFilter.apply([model], { accountsSelected: [102] })).toHaveLength(1);
        expect(TransactionFilter.apply([{ id: 3, date: '2024-01-01' }], { accountsSelected: [102] })).toHaveLength(0);
    });

    test('sélection de comptes vide → tous les comptes', () => {
        expect(TransactionFilter.apply(sampleTransactions(), { accountsSelected: [] })).toHaveLength(13);
        expect(TransactionFilter.apply(sampleTransactions(), { accountsSelected: null })).toHaveLength(13);
    });

    test('catégories exclues', () => {
        const kept = TransactionFilter.apply(sampleTransactions(), { excludeCategoryIds: Config.CATEGORIES.EXCEPTION_IDS });
        expect(ids(kept)).not.toContain(5);
        expect(ids(kept)).not.toContain(11);
        expect(kept).toHaveLength(10);
    });

    test('la période porte sur le mois de rattachement (current_month)', () => {
        const moved = tx({ id: 1, date: '2024-01-29', current_month: 1 });
        expect(TransactionFilter.matches(moved, { startDate: '2024-02-01', endDate: '2024-02-29' })).toBe(true);
        expect(TransactionFilter.matches(moved, { startDate: '2024-01-01', endDate: '2024-01-31' })).toBe(false);
    });

    test('ids invalides ignorés', () => {
        expect(TransactionFilter.accountIdOf({ account: { id: 'x' } })).toBeNull();
        expect(TransactionFilter.categoryIdOf({ categoryId: '' })).toBeNull();
        expect(TransactionFilter.normalize({ accountsSelected: ['1', 'x'] }).accounts).toEqual([1]);
    });
});
