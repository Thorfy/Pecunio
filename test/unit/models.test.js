import { beforeAll, describe, expect, test } from 'vitest';
import { tx } from '../fixtures/bankin.js';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts);

describe('Transaction', () => {
    test('fromRaw lit les champs bruts Bankin', () => {
        const t = Transaction.fromRaw(tx({ id: 7, amount: -12.5, accountId: 101, categoryId: 188, date: '2024-03-15' }));
        expect(t).toMatchObject({ id: 7, amount: -12.5, accountId: 101, categoryId: 188, date: '2024-03-15' });
        expect(t.isValid()).toBe(true);
    });

    test("fromRaw convertit l'id de compte en nombre", () => {
        const raw = tx();
        raw.account.id = '101';
        expect(Transaction.fromRaw(raw).accountId).toBe(101);
    });

    test('fromRaw refuse une transaction sans id', () => {
        expect(() => Transaction.fromRaw({ amount: -1 })).toThrow('Invalid raw transaction data');
        expect(() => Transaction.fromRaw(null)).toThrow();
    });

    test('fromRaw : catégorie ou compte manquant → transaction invalide', () => {
        expect(Transaction.fromRaw({ id: 1, amount: -1, date: '2024-01-01', account: { id: 1 } }).isValid()).toBe(false);
        expect(Transaction.fromRaw({ id: 1, amount: -1, date: '2024-01-01', category: { id: 1 } }).isValid()).toBe(false);
    });

    test('fromRaw invente une date quand elle manque (comportement actuel, D6)', () => {
        const t = Transaction.fromRaw({ id: 1, amount: -1, account: { id: 1 }, category: { id: 2 } });
        expect(t.date).toBeInstanceOf(Date);
    });

    test('dépense / revenu / montant absolu', () => {
        const expense = Transaction.fromRaw(tx({ amount: -40 }));
        const income = Transaction.fromRaw(tx({ amount: 40 }));
        expect(expense.isExpense()).toBe(true);
        expect(expense.isIncome()).toBe(false);
        expect(income.isIncome()).toBe(true);
        expect(expense.getAbsoluteAmount()).toBe(40);
    });

    test('getAdjustedDate décale du nombre de mois de current_month', () => {
        const t = Transaction.fromRaw(tx({ date: '2024-01-20', current_month: 1 }));
        const d = t.getAdjustedDate();
        expect([d.getFullYear(), d.getMonth() + 1]).toEqual([2024, 2]);
        expect(t.getMonth()).toBe(2);
        expect(t.getYear()).toBe(2024);
    });

    test('equals compare les identifiants, clone copie', () => {
        const a = Transaction.fromRaw(tx({ id: 5 }));
        const b = a.clone();
        expect(b).not.toBe(a);
        expect(a.equals(b)).toBe(true);
        expect(a.equals({ id: 5 })).toBe(false);
        expect(a.toString()).toContain('id: 5');
    });
});

describe('Account', () => {
    test('fromRaw, validité et nom affiché', () => {
        const a = Account.fromRaw({ id: 101, name: 'Compte courant' });
        expect(a.isValid()).toBe(true);
        expect(a.getDisplayName()).toBe('Compte courant');
        expect(a.toString()).toContain('Compte courant');
    });

    test('fromRaw refuse un compte sans nom ou sans id', () => {
        expect(() => Account.fromRaw({ id: 1 })).toThrow();
        expect(() => Account.fromRaw({ name: 'x' })).toThrow();
    });

    test('nom vide → invalide, et libellé de repli', () => {
        const a = new Account(1, '  ');
        expect(a.isValid()).toBe(false);
        expect(new Account(1, '').getDisplayName()).toBe('Compte sans nom');
    });

    test('equals compare id et nom', () => {
        expect(new Account(1, 'A').equals(new Account(1, 'A'))).toBe(true);
        expect(new Account(1, 'A').equals(new Account(1, 'B'))).toBe(false);
        expect(new Account(1, 'A').equals({ id: 1, name: 'A' })).toBe(false);
    });
});

describe('Category', () => {
    test('parent / enfant', () => {
        const parent = Category.fromRaw({ id: 168, name: 'Alimentation' });
        const child = Category.fromRaw({ id: 188, name: 'Supermarché' }, 168);
        expect(parent.isParent()).toBe(true);
        expect(child.isChild()).toBe(true);
        expect(child.parentId).toBe(168);
        expect(child.toString()).toContain('parentId: 168');
    });

    test('fromRaw refuse une catégorie incomplète', () => {
        expect(() => Category.fromRaw({ id: 1 })).toThrow();
        expect(() => Category.fromRaw(undefined)).toThrow();
    });

    test('equals', () => {
        expect(new Category(1, 'A', 2).equals(new Category(1, 'A', 2))).toBe(true);
        expect(new Category(1, 'A', 2).equals(new Category(1, 'A', null))).toBe(false);
        expect(new Category(1, 'A').equals({})).toBe(false);
    });
});
