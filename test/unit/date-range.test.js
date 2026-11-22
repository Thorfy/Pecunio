import { describe, expect, test, vi } from 'vitest';
import { DateRange } from '../../js/core/DateRange.js';

describe('DateRange.parts / toDateOnly', () => {
    test('une chaîne YYYY-MM-DD est prise telle quelle, sans conversion UTC', () => {
        expect(DateRange.parts('2024-01-01')).toEqual({ year: 2024, month: 1, day: 1 });
        expect(DateRange.toDateOnly('2024-01-01')).toBe('2024-01-01');
        expect(DateRange.toDateOnly('2024-12-31T23:30:00Z')).toBe('2024-12-31');
    });

    test('une Date est lue en heure locale', () => {
        expect(DateRange.toDateOnly(new Date(2024, 0, 1, 0, 5))).toBe('2024-01-01');
        expect(DateRange.toDateOnly(new Date(2024, 11, 31, 23, 55))).toBe('2024-12-31');
        expect(DateRange.toDateOnly(new Date(2024, 2, 15).getTime())).toBe('2024-03-15');
    });

    test('valeurs absentes ou invalides → null', () => {
        for (const value of [null, undefined, '', 'pas une date', '2024-13-01', '2024-02-32', new Date('x')]) {
            expect(DateRange.toDateOnly(value)).toBeNull();
        }
    });

    test('toLocalDate : minuit heure locale', () => {
        const d = DateRange.toLocalDate('2024-03-15');
        expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2024, 2, 15, 0]);
        expect(DateRange.toLocalDate('x')).toBeNull();
    });

    test('date du jour en heure locale, même juste après minuit', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2024, 2, 15, 0, 10));
        expect(DateRange.getTodayInputValue()).toBe('2024-03-15');
    });
});

describe('DateRange — calendrier', () => {
    test.each([
        [2024, 2, '2024-02-29'],
        [2023, 2, '2023-02-28'],
        [2024, 3, '2024-03-31'],
        [2024, 12, '2024-12-31'],
    ])('dernier jour de %i-%i : %s', (year, month, expected) => {
        expect(DateRange.lastDayOfMonth(year, month)).toBe(expected);
    });

    test.each([
        ['2024-01-31', 1, '2024-02-29'],
        ['2024-03-15', -3, '2023-12-15'],
        ['2024-12-10', 1, '2025-01-10'],
        ['2024-05-31', -12, '2023-05-31'],
        ['2024-05-20', 0, '2024-05-20'],
    ])('%s + %i mois = %s', (date, months, expected) => {
        expect(DateRange.addMonths(date, months)).toBe(expected);
    });

    test('addMonths : date invalide → null', () => {
        expect(DateRange.addMonths('x', 1)).toBeNull();
    });

    test('isDateInRange : bornes incluses et optionnelles', () => {
        expect(DateRange.isDateInRange('2024-03-15', '2024-03-15', '2024-03-15')).toBe(true);
        expect(DateRange.isDateInRange('2024-03-14', '2024-03-15', null)).toBe(false);
        expect(DateRange.isDateInRange('2024-03-16', null, '2024-03-15')).toBe(false);
        expect(DateRange.isDateInRange('2024-03-16', null, null)).toBe(true);
        expect(DateRange.isDateInRange(null, null, null)).toBe(false);
    });
});

describe('DateRange — mois de rattachement Bankin', () => {
    test('sans current_month : date réelle', () => {
        expect(DateRange.getBudgetDate({ date: '2024-03-15' })).toBe('2024-03-15');
        expect(DateRange.getBudgetDate({ date: '2024-03-15', current_month: 0 })).toBe('2024-03-15');
        expect(DateRange.getBudgetMonth({ date: '2024-03-15' })).toBe('2024-03');
    });

    test('avec current_month : date décalée, jour conservé', () => {
        expect(DateRange.getBudgetDate({ date: '2024-01-28', current_month: 1 })).toBe('2024-02-28');
        expect(DateRange.getBudgetDate({ date: '2024-01-31', current_month: 1 })).toBe('2024-02-29');
        expect(DateRange.getBudgetMonth({ date: '2024-01-05', current_month: -1 })).toBe('2023-12');
    });

    test('current_month non numérique ignoré ; sans date → null', () => {
        expect(DateRange.getBudgetDate({ date: '2024-03-15', current_month: '1' })).toBe('2024-03-15');
        expect(DateRange.getBudgetDate({ date: '2024-03-15', current_month: NaN })).toBe('2024-03-15');
        expect(DateRange.getBudgetDate({})).toBeNull();
        expect(DateRange.getBudgetDate(null)).toBeNull();
        expect(DateRange.getBudgetMonth({})).toBeNull();
    });
});

describe('DateRange.monthIndexFromLabel', () => {
    test.each([
        ['janvier', 1],
        ['février', 2],
        ['fevrier', 2],
        ['FÉVRIER', 2],
        ['août', 8],
        ['aout', 8],
        ['décembre', 12],
        ['February', 2],
        ['august', 8],
        ['fév.', 2],
        ['sept', 9],
        [3, 3],
    ])('%s → %i', (label, expected) => {
        expect(DateRange.monthIndexFromLabel(label)).toBe(expected);
    });

    test.each([['brumaire'], [''], ['ju'], [0], [13], [null], [{}]])('%s → null', (label) => {
        expect(DateRange.monthIndexFromLabel(label)).toBeNull();
    });
});

describe('DateRange.getEffectiveEndDate', () => {
    test('« pas de date de fin » → aujourd\'hui, sinon la date stockée', () => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2024, 2, 15, 12));
        expect(DateRange.getEffectiveEndDate({ endDate: '2024-01-31', noEndDate: true })).toBe('2024-03-15');
        expect(DateRange.getEffectiveEndDate({ endDate: '2024-01-31' })).toBe('2024-01-31');
        expect(DateRange.getEffectiveEndDate()).toBeNull();
    });
});
