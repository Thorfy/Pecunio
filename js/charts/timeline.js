/**
 * Données du graphique temporel de la page Comptes (lot UX-2a) : revenus et
 * dépenses par mois, sur une période choisie, avec le solde de chaque mois.
 *
 * Vue simplifiée (par défaut) : les revenus, les `topN` catégories de dépenses
 * les plus importantes de la période et « Autres dépenses » pour le reste.
 * Vue détaillée : toutes les catégories qui ont des opérations sur la période.
 */
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';

/** Nombre de mois affichés pour chaque période (`chartRange`). */
export const RANGE_MONTHS = Object.freeze({ '6m': 6, '12m': 12, '24m': 24, all: Infinity });

/** Libellés des périodes, pour les boutons et le titre. */
export const RANGE_LABELS = Object.freeze({ '6m': '6 mois', '12m': '12 mois', '24m': '24 mois', all: 'Tout' });

export const OTHERS_LABEL = 'Autres dépenses';
export const BALANCE_LABEL = 'Solde du mois';

/** « 2024-01 » → « 2024-02 ». */
function nextMonth(yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, '0')}`;
}

/** Mois consécutifs de `first` à `last` inclus (« YYYY-MM »). */
export function monthsBetween(first, last) {
    const months = [];
    for (let m = first; m <= last; m = nextMonth(m)) months.push(m);
    return months;
}

/**
 * @typedef {{ id: number | null, label: string, kind: 'income' | 'expense' | 'others', values: number[] }} TimelineSeries
 */

/**
 * @param {object} params
 * @param {{ id: number, name: string }[]} params.categories catégories parentes de Bankin
 * @param {Record<number, { amount: number, date: string, current_month?: number }[]>} params.byCategory
 *   transactions par identifiant de catégorie parente (catégories d'exception déjà retirées)
 * @param {'6m' | '12m' | '24m' | 'all'} [params.range]
 * @param {boolean} [params.detailed] toutes les catégories plutôt que les principales
 * @param {number} [params.topN] nombre de catégories de dépenses gardées en vue simplifiée
 * @param {number} [params.incomeCategoryId] catégorie des revenus
 * @returns {{ months: string[], series: TimelineSeries[], balance: number[] }}
 */
export function buildTimeline({
    categories,
    byCategory,
    range = '12m',
    detailed = false,
    topN = 5,
    incomeCategoryId = Config.CATEGORIES.BUDGET_CATEGORY_ID,
}) {
    // Total de chaque catégorie, mois par mois (mois de rattachement Bankin)
    /** @type {Map<number, Map<string, number>>} */
    const totals = new Map();
    let first = null;
    let last = null;
    for (const category of categories) {
        const perMonth = new Map();
        for (const transaction of byCategory[category.id] || []) {
            const budgetDate = DateRange.getBudgetDate(transaction);
            const amount = Number(transaction.amount);
            if (!budgetDate || !Number.isFinite(amount)) continue;
            const month = budgetDate.slice(0, 7);
            perMonth.set(month, (perMonth.get(month) || 0) + amount);
            if (!first || month < first) first = month;
            if (!last || month > last) last = month;
        }
        totals.set(category.id, perMonth);
    }
    if (!first) return { months: [], series: [], balance: [] };

    // Fenêtre : les N derniers mois jusqu'au dernier mois qui a des opérations
    const allMonths = monthsBetween(first, last);
    const count = RANGE_MONTHS[range] ?? RANGE_MONTHS['12m'];
    const months = allMonths.slice(Math.max(0, allMonths.length - count));

    const round = (value) => Math.round(value * 100) / 100;
    const seriesOf = (category, kind) => ({
        id: category.id,
        label: category.name,
        kind,
        values: months.map((m) => round(totals.get(category.id).get(m) || 0)),
    });
    const all = categories.map((category) => seriesOf(category, category.id === incomeCategoryId ? 'income' : 'expense'));
    const active = all.filter((s) => s.values.some((v) => v !== 0));
    const sum = (values) => values.reduce((a, b) => a + b, 0);

    const income = active.filter((s) => s.kind === 'income');
    // Dépenses de la plus importante à la plus faible sur la période
    const expenses = active.filter((s) => s.kind === 'expense').sort((a, b) => sum(a.values) - sum(b.values));

    let series;
    if (detailed || expenses.length <= topN) {
        series = [...income, ...expenses];
    } else {
        const others = expenses.slice(topN);
        series = [
            ...income,
            ...expenses.slice(0, topN),
            {
                id: null,
                label: OTHERS_LABEL,
                kind: 'others',
                values: months.map((_, i) => round(sum(others.map((s) => s.values[i])))),
            },
        ];
    }

    // Solde : toutes les catégories, y compris celles regroupées ou masquées
    const balance = months.map((_, i) => round(sum(active.map((s) => s.values[i]))));
    return { months, series, balance };
}
