// Comparaison du budget : préréglages et mise en forme (js/charts/budgetComparison.js).
import { describe, expect, test } from 'vitest';
import { formatDelta, presetPeriods, previousMonths, toExpenseComparison } from '../../js/charts/budgetComparison.js';

describe('previousMonths', () => {
    test('mois précédents, passage d\'année compris, du plus ancien au plus récent', () => {
        expect(previousMonths(2026, 2, 3)).toEqual([
            { year: 2025, month: 11 },
            { year: 2025, month: 12 },
            { year: 2026, month: 1 },
        ]);
        expect(previousMonths(2026, 2, 12)).toHaveLength(12);
    });
});

describe('presetPeriods', () => {
    const now = new Date(2026, 10, 22); // 22 novembre 2026

    test('ce mois-ci (en cours) face à la médiane des 12 mois précédents', () => {
        const p = presetPeriods('current', now);
        expect(p.primary).toEqual({ kind: 'month', year: 2026, month: 11 });
        expect(p.comparison.kind).toBe('months');
        expect(p.comparison.months[0]).toEqual({ year: 2025, month: 11 });
        expect(p.comparison.months.at(-1)).toEqual({ year: 2026, month: 10 });
        expect([p.primaryLabel, p.comparisonLabel]).toEqual(['Ce mois-ci (en cours)', 'Médiane des 12 mois précédents']);
    });

    test('mois dernier (complet) face aux 12 mois d\'avant', () => {
        const p = presetPeriods('last', now);
        expect(p.primary).toEqual({ kind: 'month', year: 2026, month: 10 });
        expect(p.comparison.months.at(-1)).toEqual({ year: 2026, month: 9 });
        expect(p.primaryLabel).toBe('Octobre 2026');
    });

    test('mois dernier en janvier : décembre de l\'année précédente', () => {
        expect(presetPeriods('last', new Date(2026, 0, 15)).primary).toEqual({ kind: 'month', year: 2025, month: 12 });
    });

    test('cette année face à l\'an dernier, en médiane mensuelle', () => {
        const p = presetPeriods('year', now);
        expect(p.primary).toEqual({ kind: 'year', year: 2026 });
        expect(p.comparison).toEqual({ kind: 'year', year: 2025 });
        expect(p.primaryLabel).toBe('Médiane mensuelle 2026');
    });
});

describe('toExpenseComparison', () => {
    test('dépenses seules, en positif, triées, avec écart ; revenus exclus', () => {
        const { rows, totals } = toExpenseComparison(
            { Logement: -900, Alimentation: -450, Salaires: 2600, Loisirs: -50 },
            { Logement: -900, Alimentation: -400, Salaires: 2500, Santé: -30 },
            { exclude: new Set(['Salaires']) },
        );
        expect(rows).toEqual([
            { name: 'Logement', primary: 900, comparison: 900, delta: 0 },
            { name: 'Alimentation', primary: 450, comparison: 400, delta: 0.125 },
            { name: 'Loisirs', primary: 50, comparison: 0, delta: null },
            { name: 'Santé', primary: 0, comparison: 30, delta: -1 },
        ]);
        expect(totals).toEqual({ primary: 1400, comparison: 1330, delta: (1400 - 1330) / 1330 });
    });

    test('catégorie en positif (remboursements) comptée à zéro ; catégories vides ignorées', () => {
        const { rows } = toExpenseComparison({ Santé: 40, Divers: 0 }, { Santé: -20 });
        expect(rows).toEqual([{ name: 'Santé', primary: 0, comparison: 20, delta: -1 }]);
    });

    test('aucune dépense : rien à afficher', () => {
        expect(toExpenseComparison({}, {})).toEqual({ rows: [], totals: { primary: 0, comparison: 0, delta: null } });
    });
});

describe('formatDelta', () => {
    test.each([
        [0.125, '+13\u00a0%'],
        [-0.07, '-7\u00a0%'],
        [0.001, '='],
        [null, 'nouveau'],
    ])('%s → %s', (delta, expected) => {
        // Espace insécable (fine ou normale selon la version d'ICU) avant %
        expect(formatDelta(delta).replace(/\u202f/g, '\u00a0')).toBe(expected);
    });
});
