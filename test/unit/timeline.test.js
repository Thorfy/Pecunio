// Données du graphique temporel de la page Comptes (js/charts/timeline.js).
import { describe, expect, test } from 'vitest';
import { BALANCE_LABEL, OTHERS_LABEL, buildTimeline, monthsBetween } from '../../js/charts/timeline.js';

const CATS = [
    { id: 2, name: "Entrées d'argent" },
    { id: 10, name: 'Logement' },
    { id: 11, name: 'Alimentation' },
    { id: 12, name: 'Transports' },
    { id: 13, name: 'Loisirs' },
    { id: 14, name: 'Santé' },
    { id: 15, name: 'Abonnements' },
    { id: 16, name: 'Impôts' },
];
const t = (date, amount, extra = {}) => ({ date, amount, ...extra });

describe('monthsBetween', () => {
    test('mois consécutifs, passage d\'année compris', () => {
        expect(monthsBetween('2024-11', '2025-02')).toEqual(['2024-11', '2024-12', '2025-01', '2025-02']);
        expect(monthsBetween('2024-05', '2024-05')).toEqual(['2024-05']);
    });
});

describe('buildTimeline', () => {
    const byCategory = {
        2: [t('2024-01-31', 2500), t('2024-02-29', 2500), t('2024-03-31', 2600)],
        10: [t('2024-01-05', -800), t('2024-02-05', -800), t('2024-03-05', -800)],
        11: [t('2024-01-10', -300), t('2024-03-10', -250)],
        12: [t('2024-02-10', -120)],
        13: [t('2024-03-10', -90)],
        14: [t('2024-01-20', -30)],
        15: [t('2024-02-01', -20), t('2024-03-01', -20)],
        16: [],
    };

    test('revenus, 5 premières dépenses par montant, « Autres dépenses » pour le reste', () => {
        const { months, series } = buildTimeline({ categories: CATS, byCategory, range: 'all' });
        expect(months).toEqual(['2024-01', '2024-02', '2024-03']);
        expect(series.map((s) => s.label)).toEqual([
            "Entrées d'argent",
            'Logement',
            'Alimentation',
            'Transports',
            'Loisirs',
            'Abonnements',
            // 6 catégories de dépenses actives : la plus faible (Santé, -30 €) part dans « Autres »
            OTHERS_LABEL,
        ]);
        expect(series.at(-1)).toEqual({ id: null, label: OTHERS_LABEL, kind: 'others', values: [-30, 0, 0] });
        expect(series[0]).toMatchObject({ kind: 'income', values: [2500, 2500, 2600] });
    });

    test('vue détaillée : toutes les catégories actives, sans « Autres »', () => {
        const { series } = buildTimeline({ categories: CATS, byCategory, range: 'all', detailed: true });
        expect(series.map((s) => s.label)).not.toContain(OTHERS_LABEL);
        expect(series).toHaveLength(7); // Impôts, sans opération, n'apparaît pas
    });

    test('solde du mois : revenus moins toutes les dépenses, regroupées comprises', () => {
        const { balance } = buildTimeline({ categories: CATS, byCategory, range: 'all' });
        expect(balance).toEqual([2500 - 800 - 300 - 30, 2500 - 800 - 120 - 20, 2600 - 800 - 250 - 90 - 20]);
        expect(BALANCE_LABEL).toBe('Solde du mois');
    });

    test('période : les N derniers mois jusqu\'au dernier mois qui a des opérations', () => {
        const long = { 10: Array.from({ length: 30 }, (_, i) => t(`20${22 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}-05`, -100)) };
        const cats = [{ id: 10, name: 'Logement' }];
        expect(buildTimeline({ categories: cats, byCategory: long, range: '12m' }).months).toHaveLength(12);
        expect(buildTimeline({ categories: cats, byCategory: long, range: '6m' }).months.at(-1)).toBe('2024-06');
        expect(buildTimeline({ categories: cats, byCategory: long, range: '24m' }).months).toHaveLength(24);
        expect(buildTimeline({ categories: cats, byCategory: long, range: 'all' }).months).toHaveLength(30);
    });

    test('mois sans opération : présents, à zéro', () => {
        const { months, series } = buildTimeline({
            categories: [{ id: 10, name: 'Logement' }],
            byCategory: { 10: [t('2024-01-05', -800), t('2024-04-05', -800)] },
            range: 'all',
        });
        expect(months).toEqual(['2024-01', '2024-02', '2024-03', '2024-04']);
        expect(series[0].values).toEqual([-800, 0, 0, -800]);
    });

    test('mois de rattachement Bankin (current_month)', () => {
        const { months } = buildTimeline({
            categories: [{ id: 10, name: 'Logement' }],
            byCategory: { 10: [t('2024-01-30', -800, { current_month: 1 })] },
        });
        expect(months).toEqual(['2024-02']);
    });

    test('aucune opération : rien à afficher', () => {
        expect(buildTimeline({ categories: CATS, byCategory: {} })).toEqual({ months: [], series: [], balance: [] });
    });

    test('montants arrondis au centime', () => {
        const { series } = buildTimeline({
            categories: [{ id: 10, name: 'Logement' }],
            byCategory: { 10: [t('2024-01-05', -0.1), t('2024-01-06', -0.2)] },
        });
        expect(series[0].values).toEqual([-0.3]);
    });
});
