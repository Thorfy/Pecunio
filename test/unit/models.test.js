import { describe, expect, test } from 'vitest';
import { tx } from '../fixtures/bankin.js';
import { Account } from '../../js/models/Account.js';
import { Category } from '../../js/models/Category.js';
import { Transaction } from '../../js/models/Transaction.js';

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

    test('getAdjustedDate décale du nombre de mois de current_month', () => {
        const t = Transaction.fromRaw(tx({ date: '2024-01-20', current_month: 1 }));
        const d = t.getAdjustedDate();
        expect([d.getFullYear(), d.getMonth() + 1]).toEqual([2024, 2]);
    });
});

describe('Account', () => {
    test('fromRaw, validité et nom affiché', () => {
        const a = Account.fromRaw({ id: 101, name: 'Compte courant' });
        expect(a.isValid()).toBe(true);
        expect(a.getDisplayName()).toBe('Compte courant');
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
});

describe('Category', () => {

    test('fromRaw refuse une catégorie incomplète', () => {
        expect(() => Category.fromRaw({ id: 1 })).toThrow();
        expect(() => Category.fromRaw(undefined)).toThrow();
    });
});
