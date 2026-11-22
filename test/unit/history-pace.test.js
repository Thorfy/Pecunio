// Historique d'une catégorie et rythme du mois (lot UX-3a).
import { describe, expect, test } from 'vitest';
import { buildCategoryHistory, findCategory } from '../../js/charts/categoryHistory.js';
import { buildMonthPace } from '../../js/charts/monthPace.js';

const t = (date, amount, categoryId, extra = {}) => ({ date, amount, category: { id: categoryId }, ...extra });

const LOGEMENT = { id: 161, name: 'Logement', categories: [{ id: 180, name: 'Loyer' }, { id: 181, name: 'Électricité' }] };
const REVENUS = { id: 2, name: "Entrées d'argent", categories: [{ id: 230, name: 'Salaires' }] };

describe('buildCategoryHistory', () => {
    const monthly = (from, to, day, amount, id) => {
        const out = [];
        for (let y = from[0], m = from[1]; y < to[0] || (y === to[0] && m <= to[1]); m === 12 ? ((m = 1), y++) : m++) {
            out.push(t(`${y}-${String(m).padStart(2, '0')}-${day}`, amount, id));
        }
        return out;
    };

    test('12 mois jusqu\'au mois affiché, par sous-catégorie, montants dépensés en positif', () => {
        const transactions = [
            ...monthly([2025, 1], [2026, 10], '05', -800, 180),
            ...monthly([2025, 11], [2026, 10], '08', -60, 181),
            t('2026-10-20', 20, 181), // remboursement
            t('2026-10-12', -999, 188), // autre catégorie
        ];
        const h = buildCategoryHistory({ category: LOGEMENT, transactions, month: { year: 2026, month: 10 } });
        expect(h.months).toHaveLength(12);
        expect(h.months[0]).toBe('2025-11');
        expect(h.months.at(-1)).toBe('2026-10');
        expect(h.series.map((s) => s.label)).toEqual(['Loyer', 'Électricité']);
        expect(h.series[1].values.at(-1)).toBe(40);
        expect(h.totals.at(-1)).toBe(840);
        expect(h.isIncome).toBe(false);
    });

    test('médiane des 12 mois précédant le mois affiché', () => {
        const transactions = [
            ...monthly([2025, 10], [2026, 9], '05', -800, 180),
            t('2026-10-05', -1200, 180),
        ];
        const h = buildCategoryHistory({ category: LOGEMENT, transactions, month: { year: 2026, month: 10 } });
        expect(h.median).toBe(800);
        expect(h.totals.at(-1)).toBe(1200);
    });

    test('revenus (« Entrées d\'argent ») : montants reçus en positif', () => {
        const h = buildCategoryHistory({ category: REVENUS, transactions: [t('2026-10-28', 2600, 230)], month: { year: 2026, month: 10 } });
        expect(h.isIncome).toBe(true);
        expect(h.totals.at(-1)).toBe(2600);
    });

    test('plus de 6 sous-catégories : 5 détaillées et « Autres »', () => {
        const many = { id: 170, name: 'Loisirs', categories: Array.from({ length: 8 }, (_, i) => ({ id: 300 + i, name: `S${i}` })) };
        const transactions = many.categories.map((c, i) => t('2026-10-10', -(100 - i * 10), c.id));
        const h = buildCategoryHistory({ category: many, transactions, month: { year: 2026, month: 10 } });
        expect(h.series.map((s) => s.label)).toEqual(['S0', 'S1', 'S2', 'S3', 'S4', 'Autres']);
        expect(h.series.at(-1).values.at(-1)).toBe(50 + 40 + 30);
    });

    test('findCategory : parente ou sous-catégorie seule', () => {
        expect(findCategory([LOGEMENT, REVENUS], 161).name).toBe('Logement');
        expect(findCategory([LOGEMENT], 181)).toEqual({ id: 181, name: 'Électricité', parentId: 161 });
        expect(findCategory([LOGEMENT], 999)).toBeNull();
    });
});

describe('buildMonthPace', () => {
    const income = new Set([2, 230]);

    test('mois passé : cumul jour par jour face à la médiane des cumuls des 12 mois précédents', () => {
        const transactions = [];
        for (let m = 1; m <= 12; m++) {
            const month = String(m).padStart(2, '0');
            transactions.push(t(`2025-${month}-05`, -800, 180), t(`2025-${month}-20`, -200, 188));
        }
        transactions.push(t('2026-01-05', -800, 180), t('2026-01-10', -300, 188), t('2026-01-31', 2600, 230));
        const p = buildMonthPace({ transactions, month: { year: 2026, month: 1 }, today: new Date(2026, 5, 1), incomeCategoryIds: income });
        expect(p.days).toHaveLength(31);
        expect(p.current[3]).toBe(0); // 4 janvier
        expect(p.current[4]).toBe(800); // 5 janvier
        expect(p.current[30]).toBe(1100); // revenus ignorés
        expect(p.reference[19]).toBe(1000); // habituellement 1 000 € au 20
        expect(p.lastDay).toBe(31);
        expect([p.spent, p.usual]).toEqual([1100, 1000]);
        expect(p.delta).toBeCloseTo(0.1);
    });

    test('mois en cours : courbe arrêtée à aujourd\'hui, comparaison au même jour', () => {
        const transactions = [t('2026-11-03', -100, 188), t('2026-11-25', -50, 188)];
        const p = buildMonthPace({ transactions, month: { year: 2026, month: 11 }, today: new Date(2026, 10, 22), incomeCategoryIds: income });
        expect(p.current[21]).toBe(100);
        expect(p.current[22]).toBeNull();
        expect(p.lastDay).toBe(22);
        expect(p.delta).toBeNull(); // pas d'historique
    });

    test('virements internes et épargne exclus ; remboursements déduits', () => {
        const transactions = [t('2026-01-05', -300, 326), t('2026-01-06', -200, 282), t('2026-01-07', -50, 188), t('2026-01-08', 20, 188)];
        const p = buildMonthPace({ transactions, month: { year: 2026, month: 1 }, today: new Date(2026, 5, 1) });
        expect(p.spent).toBe(30);
    });

    test('mois court de référence : son total au-delà de sa fin', () => {
        const transactions = [t('2026-02-28', -100, 188), t('2026-03-31', -100, 188)];
        const p = buildMonthPace({ transactions, month: { year: 2026, month: 3 }, today: new Date(2026, 5, 1), referenceMonths: 1 });
        // Février 2026 n'a que 28 jours : le 31 mars, l'habituel vaut son total
        expect(p.reference[30]).toBe(100);
    });
});

describe('Phrases de synthèse', () => {
    test('historique : mois affiché face à la médiane, revenus ou dépenses', async () => {
        const { CategoryHistoryChart } = await import('../../js/charts/CategoryHistoryChart.js');
        const history = { totals: [800, 840], median: 800, isIncome: false };
        expect(CategoryHistoryChart.summary(history, 'Octobre 2026', false).replace(/[\u202f\u00a0]/g, ' '))
            .toBe('Octobre 2026 : 840,00 € dépensés, contre 800,00 € habituellement (médiane des 12 mois précédents), écart +5 %');
        expect(CategoryHistoryChart.summary(history, 'Octobre 2026', true).replace(/[\u202f\u00a0]/g, ' '))
            .toBe('Octobre 2026 face à la médiane des 12 mois précédents : écart +5 %');
        expect(CategoryHistoryChart.summary({ totals: [800, 801], median: 800, isIncome: false }, 'Octobre 2026', true))
            .toBe('Octobre 2026 face à la médiane des 12 mois précédents : sans écart');
        expect(CategoryHistoryChart.summary({ totals: [2600], median: 0, isIncome: true }, 'Octobre 2026', false).replace(/[\u202f\u00a0]/g, ' '))
            .toBe('Octobre 2026 : 2 600,00 € reçus');
        // Mois en cours : pas d'écart trompeur avec un mois complet
        const partial = { totals: [800, 76], median: 800, isIncome: false };
        expect(CategoryHistoryChart.summary(partial, 'Novembre 2026', false, true).replace(/[\u202f\u00a0]/g, ' '))
            .toBe('Novembre 2026 (en cours) : 76,00 € dépensés à ce jour ; médiane des 12 mois précédents : 800,00 €');
        expect(CategoryHistoryChart.summary(partial, 'Novembre 2026', true, true)).toBe('Novembre 2026 (en cours)');
        expect(CategoryHistoryChart.title({ name: 'Logement' }, false)).toBe('Logement sur 12 mois');
        // Nuances des sous-catégories : rgb(…) de Bankin ou violet de Pecunio en hexadécimal
        expect(CategoryHistoryChart.withAlpha('rgb(104, 125, 0)', 0.5)).toBe('rgba(104, 125, 0, 0.5)');
        expect(CategoryHistoryChart.withAlpha('rgba(104, 125, 0, 1)', 0.36)).toBe('rgba(104, 125, 0, 0.36)');
        expect(CategoryHistoryChart.withAlpha('#6562fc', 0.72)).toBe('rgba(101, 98, 252, 0.72)');
        expect(CategoryHistoryChart.title({ name: "Entrées d'argent" }, true)).toBe('Revenus sur 12 mois');
    });

    test('rythme : au jour J du mois en cours, ou sur le mois écoulé', async () => {
        const { MonthPaceChart } = await import('../../js/charts/MonthPaceChart.js');
        const days = Array.from({ length: 30 }, (_, i) => i + 1);
        const pace = { days, lastDay: 22, spent: 900, usual: 1000, delta: -0.1 };
        expect(MonthPaceChart.summary(pace, false).replace(/[\u202f\u00a0]/g, ' '))
            .toBe("Au 22 : 900,00 € dépensés, contre 1 000,00 € d'habitude à cette date, écart -10 %");
        expect(MonthPaceChart.summary(pace, true).replace(/[\u202f\u00a0]/g, ' ')).toBe('Au 22 : écart -10 % avec le rythme habituel');
        expect(MonthPaceChart.summary({ ...pace, lastDay: 30, delta: null }, false)).toBe('Sur le mois : 900,00 € dépensés');
        expect(MonthPaceChart.summary({ ...pace, lastDay: 30 }, false).replace(/[\u202f\u00a0]/g, ' '))
            .toBe('Sur le mois : 900,00 € dépensés, contre 1 000,00 € sur un mois habituel, écart -10 %');
        expect(MonthPaceChart.summary({ ...pace, lastDay: 0 }, false)).toBe('Mois à venir : pas encore de dépenses.');
    });
});
