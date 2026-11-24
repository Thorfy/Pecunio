// Rythme de l'année (page Comptes) : une année face à une autre ou à la médiane.
import { describe, expect, test } from 'vitest';
import { buildYearPace, dailySpendingByYear, dayOfYearIndex, medianYears, monthDayFromIndex, yearChoices } from '../../js/charts/yearPace.js';
// Import en tête : chargé à froid dans un test (Chart.js), il dépassait son délai sous charge
import { YearPaceChart } from '../../js/charts/YearPaceChart.js';

const t = (date, amount, categoryId, extra = {}) => ({ date, amount, category: { id: categoryId }, account: { id: 101 }, ...extra });
const income = new Set([2, 230]);
const TODAY = new Date(2026, 10, 24);

/** Une dépense le 10 de chaque mois de l'année. */
const monthly = (year, amount, id = 188) =>
    Array.from({ length: 12 }, (_, i) => t(`${year}-${String(i + 1).padStart(2, '0')}-10`, -amount, id));

describe('jours de l\'année', () => {
    test('indice identique d\'une année à l\'autre, 29 février compté avec le 28', () => {
        expect(dayOfYearIndex(1, 1)).toBe(0);
        expect(dayOfYearIndex(3, 1)).toBe(59);
        expect(dayOfYearIndex(2, 29)).toBe(dayOfYearIndex(2, 28));
        expect(dayOfYearIndex(12, 31)).toBe(364);
        expect(monthDayFromIndex(0)).toEqual({ month: 1, day: 1 });
        expect(monthDayFromIndex(59)).toEqual({ month: 3, day: 1 });
        expect(monthDayFromIndex(364)).toEqual({ month: 12, day: 31 });
    });
});

describe('années proposées', () => {
    test('affichables : années avec dépenses ; références : années terminées et couvertes dès janvier', () => {
        const spending = dailySpendingByYear([t('2023-03-04', -50, 188), ...monthly(2024, 10), ...monthly(2025, 10), t('2026-02-01', -20, 188)]);
        // 2023 commence en mars : incomplète ; 2026 : en cours
        expect(yearChoices(spending, TODAY)).toEqual({ years: [2026, 2025, 2024, 2023], completeYears: [2025, 2024] });
        expect(yearChoices(dailySpendingByYear([t('2023-01-20', -10, 188), ...monthly(2025, 1)]), TODAY).completeYears).toEqual([2025, 2023]);
        expect(yearChoices(dailySpendingByYear([]), TODAY)).toEqual({ years: [], completeYears: [] });
    });

    test('médiane : années complètes avant l\'année affichée, 5 au plus', () => {
        const complete = [2025, 2024, 2023, 2022, 2021, 2020, 2019];
        expect(medianYears(complete, 2026)).toEqual([2021, 2022, 2023, 2024, 2025]);
        expect(medianYears(complete, 2022)).toEqual([2019, 2020, 2021]);
        expect(medianYears(complete, 2019)).toEqual([]);
    });

    test('« Comparer à » : médiane s\'il y a au moins deux années précédentes, puis chaque autre année complète', () => {
        const choices = { years: [2026, 2025, 2024, 2023], completeYears: [2025, 2024, 2023] };
        expect(YearPaceChart.referenceOptions(choices, 2026).map((o) => o.label)).toEqual(['Médiane de 2023 à 2025', '2025', '2024', '2023']);
        expect(YearPaceChart.referenceOptions(choices, 2026)[0].years).toEqual([2023, 2024, 2025]);
        // Une seule année précédente : pas de médiane, mais une année plus récente reste possible
        expect(YearPaceChart.referenceOptions(choices, 2024).map((o) => o.value)).toEqual(['2025', '2023']);
        expect(YearPaceChart.defaultYear(choices)).toBe(2026);
        // Une seule année complète : elle ne peut pas se comparer à elle-même
        const one = { years: [2026, 2025], completeYears: [2025] };
        expect(YearPaceChart.referenceOptions(one, 2025)).toEqual([]);
        expect(YearPaceChart.defaultYear(one)).toBe(2026);
        // Aucune année complète : pas de carte
        expect(YearPaceChart.defaultYear({ years: [2026], completeYears: [] })).toBeNull();
    });
});

describe('buildYearPace', () => {
    test('année en cours face à une année : courbe arrêtée à aujourd\'hui, comparaison au même jour', () => {
        const spending = dailySpendingByYear([...monthly(2025, 100), ...monthly(2026, 120)], income);
        const p = buildYearPace({ spending, year: 2026, referenceYears: [2025], today: TODAY });
        expect(p.reference[dayOfYearIndex(1, 9)]).toBe(0);
        expect(p.reference[dayOfYearIndex(1, 10)]).toBe(100);
        expect(p.reference[364]).toBe(1200);
        const today = dayOfYearIndex(11, 24);
        expect(p.lastIndex).toBe(today);
        expect(p.current[today]).toBe(1320);
        expect(p.current[today + 1]).toBeNull();
        expect([p.spent, p.usual]).toEqual([1320, 1100]);
        expect(p.delta).toBeCloseTo(0.2);
    });

    test('médiane des cumuls au même jour ; année passée affichée en entier', () => {
        const spending = dailySpendingByYear([2021, 2022, 2023, 2024].flatMap((y, i) => monthly(y, 100 * (i + 1))));
        const p = buildYearPace({ spending, year: 2024, referenceYears: [2021, 2022, 2023], today: TODAY });
        expect(p.lastIndex).toBe(364);
        expect(p.spent).toBe(4800);
        expect(p.usual).toBe(2400);
        // Une année plus récente peut servir de référence à une plus ancienne
        expect(buildYearPace({ spending, year: 2021, referenceYears: [2024], today: TODAY }).delta).toBeCloseTo(-0.75);
    });

    test('revenus, virements internes et épargne exclus ; remboursements déduits ; mois de rattachement Bankin', () => {
        const spending = dailySpendingByYear([
            t('2025-01-05', -100, 188),
            t('2026-01-05', -300, 326), // virement interne
            t('2026-01-06', -200, 282), // épargne
            t('2026-01-07', 2600, 230), // salaire
            t('2026-01-08', -50, 188),
            t('2026-01-09', 20, 188), // remboursement
            t('2025-12-30', -70, 188, { current_month: 1 }), // compté en janvier 2026
        ], income);
        const p = buildYearPace({ spending, year: 2026, referenceYears: [2025], today: new Date(2026, 5, 1) });
        expect(p.current[0]).toBe(70);
        expect(p.spent).toBe(100);
        expect(p.reference[364]).toBe(100);
    });
});

describe('Carte', () => {
    test('comptes choisis seulement, sur tout l\'historique (pas la période du graphique des dépenses)', () => {
        const settings = { getSetting: (key) => ({ startDate: '2026-01-01', endDate: '2026-12-31' })[key] ?? null };
        const chart = new YearPaceChart([...monthly(2025, 100), t('2025-03-03', -999, 188, { account: { id: 102 } })], [], [101], null, settings);
        chart.now = () => TODAY;
        expect(chart.prepareData().completeYears).toEqual([2025]);
        expect(buildYearPace({ spending: chart.spending, year: 2025, referenceYears: [2025], today: TODAY }).spent).toBe(1200);
    });
});

describe('Phrase de synthèse et légende', () => {
    const base = { year: 2026, referenceYears: [2023, 2024, 2025], lastIndex: dayOfYearIndex(11, 24), spent: 900, usual: 1000, delta: -0.1 };
    const text = (pace, hide) => YearPaceChart.summary(pace, hide).replace(/\s/g, ' ');

    test('médiane : année en cours, année écoulée, année à venir', () => {
        expect(text(base, false)).toBe('Au 24 novembre : 900,00 € dépensés, contre 1 000,00 € en médiane à cette date, écart -10 %');
        expect(text(base, true)).toBe('Au 24 novembre : écart -10 % avec la médiane');
        expect(text({ ...base, lastIndex: 0 }, true)).toBe('Au 1er janvier : écart -10 % avec la médiane');
        expect(text({ ...base, lastIndex: 364 }, false)).toBe('Sur 2026 : 900,00 € dépensés, contre 1 000,00 € en médiane, écart -10 %');
        expect(text({ ...base, delta: null }, false)).toBe('Au 24 novembre : 900,00 € dépensés');
        expect(text({ ...base, lastIndex: -1 }, false)).toBe('Année à venir : pas encore de dépenses.');
        expect(YearPaceChart.referenceLabel([2023, 2024, 2025])).toBe('Médiane de 2023 à 2025');
    });

    test('une année de référence : nommée', () => {
        const single = { ...base, referenceYears: [2025] };
        expect(text(single, false)).toBe('Au 24 novembre : 900,00 € dépensés, contre 1 000,00 € en 2025 à cette date, écart -10 %');
        expect(text(single, true)).toBe('Au 24 novembre : écart -10 % avec 2025');
        expect(text({ ...single, lastIndex: 364 }, false)).toBe('Sur 2026 : 900,00 € dépensés, contre 1 000,00 € en 2025, écart -10 %');
        expect(YearPaceChart.referenceLabel([2025])).toBe('2025');
    });

    test("repères des mois : tous si l'axe est large, un sur deux sinon", () => {
        expect([2, 3].map((m) => YearPaceChart.showMonthTick(m, 600))).toEqual([true, true]);
        expect([1, 2, 3].map((m) => YearPaceChart.showMonthTick(m, 300))).toEqual([true, false, true]);
    });
});
