// Épargne mois par mois (G1) et plus fortes variations (G5), lot UX-3b.
import { describe, expect, test } from 'vitest';
import { buildSavings, savingsFromRows, savingsFromTimeline, savingsRate } from '../../js/charts/savings.js';

const nbsp = (text) => text.replace(/[\u202f\u00a0]/g, ' ');

describe('Épargne (G1)', () => {
    test('taux : part des revenus mise de côté, négative en déficit, sans revenus null', () => {
        expect(savingsRate(2000, 300)).toBeCloseTo(0.15);
        expect(savingsRate(2000, -200)).toBeCloseTo(-0.1);
        expect(savingsRate(0, -50)).toBeNull();
    });

    test('mois en cours affiché mais exclu des totaux', () => {
        const s = buildSavings({
            months: ['2026-09', '2026-10', '2026-11'],
            income: [2000, 2000, 2000],
            balance: [400, -100, 1500],
            currentMonth: '2026-11',
        });
        expect(s.inProgress).toBe(2);
        expect(s.rate[2]).toBeCloseTo(0.75);
        expect(s.total).toEqual({ count: 2, income: 4000, balance: 300, rate: 0.075 });
    });

    test('depuis le graphique temporel : revenus = séries de revenus, solde repris tel quel', () => {
        const timeline = {
            months: ['2026-09', '2026-10'],
            series: [
                { kind: 'income', values: [2500, 2600] },
                { kind: 'expense', values: [-2000, -2900] },
                { kind: 'others', values: [-100, 0] },
            ],
            balance: [400, -300],
        };
        const s = savingsFromTimeline(timeline);
        expect(s.income).toEqual([2500, 2600]);
        expect(s.balance).toEqual([400, -300]);
        expect(s.total.balance).toBe(100);
    });

    test('depuis les lignes du rapport : par mois de rattachement', () => {
        const s = savingsFromRows([
            { amount: 2500, budgetMonth: '2026-10' },
            { amount: -1800, budgetMonth: '2026-10' },
            { amount: 2500, date: '2026-11-28' },
            { amount: -2700, date: '2026-11-03' },
        ]);
        expect(s.months).toEqual(['2026-10', '2026-11']);
        expect(s.balance).toEqual([700, -200]);
        expect(s.total.rate).toBeCloseTo(0.1);
    });

    test('phrase de synthèse : épargne, déficit, montants masqués', async () => {
        const { SavingsChart } = await import('../../js/charts/SavingsChart.js');
        const saved = { total: { count: 11, income: 30000, balance: 3600, rate: 0.12 } };
        expect(nbsp(SavingsChart.summary(saved, false))).toBe('Sur 11 mois complets : 3 600,00 € mis de côté sur 30 000,00 € de revenus, soit 12 %');
        expect(SavingsChart.summary(saved, true)).toBe("Sur 11 mois complets : taux d'épargne 12 %");
        const deficit = { total: { count: 1, income: 2000, balance: -160, rate: -0.08 } };
        expect(nbsp(SavingsChart.summary(deficit, false))).toBe('Sur 1 mois complet : 160,00 € de plus dépensés que reçus (-8 % des revenus)');
        expect(SavingsChart.summary({ total: { count: 0 } }, false)).toBe('Pas encore de mois complet sur la période.');
        expect(SavingsChart.title('12m')).toBe('Épargne — 12 mois');
        expect(SavingsChart.title('all')).toBe('Épargne par mois');
    });
});

describe('Plus fortes variations (G5)', () => {
    const CATEGORIES = [
        { id: 2, name: "Entrées d'argent", categories: [{ id: 230, name: 'Salaires' }] },
        { id: 170, name: 'Loisirs', categories: [{ id: 200, name: 'Sport' }] },
        { id: 168, name: 'Alimentation', categories: [{ id: 188, name: 'Courses' }] },
        { id: 164, name: 'Banque', categories: [{ id: 326, name: 'Virements internes' }] },
    ];
    const t = (date, amount, id, extra = {}) => ({ date, amount, category: { id }, ...extra });
    const everyMonth = (day, amount, id) => Array.from({ length: 12 }, (_, i) => {
        const m = i + 10; // oct. 2025 → sept. 2026
        const year = m > 12 ? 2026 : 2025;
        return t(`${year}-${String(((m - 1) % 12) + 1).padStart(2, '0')}-${day}`, amount, id);
    });

    test('écart à la médiane des 12 mois précédents, trié par écart en euros', async () => {
        const { buildVariations } = await import('../../js/charts/variations.js');
        const transactions = [
            ...everyMonth('10', -200, 200), // Loisirs : 200 € d'habitude
            ...everyMonth('12', -400, 188), // Alimentation : 400 € d'habitude
            t('2026-10-10', -290, 200), // Loisirs +90 €
            t('2026-10-12', -250, 188), // Alimentation -150 €
            t('2026-10-15', 2600, 230), // revenus : ignorés
            t('2026-10-16', -900, 326), // virement interne : ignoré
        ];
        const { items, day } = buildVariations({ categories: CATEGORIES, transactions, month: { year: 2026, month: 10 }, today: new Date(2026, 10, 22) });
        expect(day).toBeNull();
        expect(items.map((v) => [v.name, v.diff])).toEqual([['Alimentation', -150], ['Loisirs', 90]]);
        expect(items[1].pct).toBeCloseTo(0.45);
    });

    test('mois en cours : comparaison au même jour ; petits écarts ignorés ; nouvelle catégorie', async () => {
        const { buildVariations } = await import('../../js/charts/variations.js');
        const transactions = [
            ...everyMonth('05', -100, 188), // avant le 22 chaque mois
            ...everyMonth('28', -300, 188), // après le 22 : hors comparaison
            t('2026-11-05', -110, 188), // +10 € : bruit
            t('2026-11-08', -60, 200), // Loisirs : nouveau
        ];
        const { items, day } = buildVariations({ categories: CATEGORIES, transactions, month: { year: 2026, month: 11 }, today: new Date(2026, 10, 22) });
        expect(day).toBe(22);
        expect(items).toEqual([{ id: 170, name: 'Loisirs', current: 60, usual: 0, diff: 60, pct: null }]);
    });

    test('ligne : écart et part, ou la part seule quand les montants sont masqués', async () => {
        const { VariationsChart } = await import('../../js/charts/VariationsChart.js');
        const up = { id: 170, name: 'Loisirs', current: 290, usual: 200, diff: 90, pct: 0.45 };
        const line = VariationsChart.describe(up, false);
        expect(nbsp(line.value)).toBe('+90,00 € (+45 %)');
        expect(nbsp(line.detail)).toBe("290,00 € contre 200,00 € d'habitude");
        expect(VariationsChart.describe({ ...up, diff: -150, pct: -0.375 }, true)).toEqual({ value: '-38 %', detail: '' });
        expect(VariationsChart.percent({ pct: null })).toBe('nouveau');
        expect(VariationsChart.subtitle(22)).toBe('Au 22, face à la médiane des 12 mois précédents au même jour');
    });
});

describe('Épargne : axes alignés sur zéro', () => {
    test('un mois en déficit : le zéro des soldes et celui du taux à la même hauteur', async () => {
        const { zeroAlignedRanges } = await import('../../js/charts/savings.js');
        const share = ({ min, max }) => -min / (max - min);
        const { left, right } = zeroAlignedRanges([800, -400, 1200], [30, -40, 35]);
        expect(share(left)).toBeCloseTo(share(right));
        expect(left.min).toBeLessThanOrEqual(-400);
        expect(left.max).toBeGreaterThanOrEqual(1200);
        expect(right.min).toBeLessThanOrEqual(-40);
        expect(right.max).toBeGreaterThanOrEqual(35);
    });

    test('aucun déficit : les deux axes partent de zéro ; taux absents ignorés', async () => {
        const { zeroAlignedRanges } = await import('../../js/charts/savings.js');
        const { left, right } = zeroAlignedRanges([800, 200], [30, null]);
        expect(left.min).toBe(0);
        expect(right.min).toBe(0);
        expect(right.max).toBeGreaterThanOrEqual(30);
    });
});

describe('Textes avec montants et masquage', () => {
    test("réécrits à chaque bascule de l'œil ; une nouvelle liaison remplace l'ancienne", async () => {
        const { BaseChartData } = await import('../../js/charts/base/BaseChartData.js');
        const p = document.createElement('p');
        document.body.appendChild(p);
        const toggle = (isBlurry) => window.dispatchEvent(new CustomEvent('pecunio_amounts_visibility_changed', { detail: { isBlurry } }));

        BaseChartData.bindAmountText(p, (hide) => (hide ? 'ancien masqué' : 'ancien 10 €'));
        BaseChartData.bindAmountText(p, (hide) => (hide ? 'écart +5 %' : '120,00 €, écart +5 %'));
        expect(p.textContent).toBe('120,00 €, écart +5 %');
        toggle(true);
        expect(p.textContent).toBe('écart +5 %');
        toggle(false);
        expect(p.textContent).toBe('120,00 €, écart +5 %');

        p.remove();
        toggle(true);
        expect(p.textContent).toBe('120,00 €, écart +5 %');
    });
});
