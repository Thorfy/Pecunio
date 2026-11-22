import { describe, expect, test } from 'vitest';
import { ACCOUNTS, CATEGORIES, tx } from '../fixtures/bankin.js';
import { APIError, AuthenticationError, DataManagerError, DataValidators, ValidationError } from '../../js/core/DataManager.js';

describe('DataValidators', () => {
    test('transaction valide', () => {
        expect(DataValidators.validateTransaction(tx())).toEqual({ valid: true, errors: [] });
    });

    test('accepte les identifiants à 0', () => {
        const t = tx({ id: 0, accountId: 0, categoryId: 0 });
        expect(DataValidators.validateTransaction(t).valid).toBe(true);
    });

    test.each([
        ['sans id', { id: undefined }, 'id'],
        ['montant texte', { amount: '12' }, 'amount'],
        ['sans date', { date: '' }, 'date'],
        ['date invalide', { date: 'pas une date' }, 'invalid date'],
    ])('transaction %s → invalide', (_label, override, message) => {
        const t = { ...tx(), ...override };
        const result = DataValidators.validateTransaction(t);
        expect(result.valid).toBe(false);
        expect(result.errors.join(' ')).toContain(message);
    });

    test('transaction sans compte ni catégorie', () => {
        const result = DataValidators.validateTransaction({ id: 1, amount: -1, date: '2024-01-01' });
        expect(result.errors).toHaveLength(2);
        expect(DataValidators.validateTransaction({ ...tx(), account: {}, category: {} }).errors).toHaveLength(2);
    });

    test('non-objet', () => {
        expect(DataValidators.validateTransaction(null).valid).toBe(false);
        expect(DataValidators.validateCategory('x').valid).toBe(false);
        expect(DataValidators.validateAccount(42).valid).toBe(false);
    });

    test('catégories', () => {
        for (const c of CATEGORIES) expect(DataValidators.validateCategory(c).valid).toBe(true);
        expect(DataValidators.validateCategory({ id: 1, name: ' ' }).valid).toBe(false);
        expect(DataValidators.validateCategory({ name: 'x' }).valid).toBe(false);
        expect(DataValidators.validateCategory({ id: 1, name: 'x', categories: 'non' }).valid).toBe(false);
    });

    test('comptes', () => {
        for (const a of ACCOUNTS) expect(DataValidators.validateAccount(a).valid).toBe(true);
        expect(DataValidators.validateAccount({ id: 1 }).valid).toBe(false);
        expect(DataValidators.validateAccount({ name: 'x' }).valid).toBe(false);
    });

    test('validateArray sépare éléments valides et invalides', () => {
        const result = DataValidators.validateArray([tx({ id: 1 }), { id: 2 }], DataValidators.validateTransaction, 'transactions');
        expect(result.valid).toBe(false);
        expect(result.validItems.map((t) => t.id)).toEqual([1]);
        expect(result.invalidItems[0].index).toBe(1);
        expect(result.errors[0]).toMatch(/^Item 1:/);
    });

    test('validateArray refuse un non-tableau', () => {
        const result = DataValidators.validateArray({}, DataValidators.validateTransaction, 'transactions');
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain('Expected array');
    });
});

describe('Erreurs typées de DataManager', () => {
    test('héritage et codes', () => {
        const auth = new AuthenticationError('x', { a: 1 });
        const api = new APIError('y', 500, 'https://u');
        const validation = new ValidationError('z', 'transactions', [1]);
        expect(auth).toBeInstanceOf(DataManagerError);
        expect(auth.code).toBe('AUTH_ERROR');
        expect(api).toMatchObject({ code: 'API_ERROR', statusCode: 500, url: 'https://u' });
        expect(validation).toMatchObject({ code: 'VALIDATION_ERROR', dataType: 'transactions', invalidData: [1] });
        expect(validation).toBeInstanceOf(Error);
    });
});
