/**
 * Historique d'une catégorie (page de détail d'une catégorie Bankin, lot UX-3a) :
 * montants des 12 derniers mois jusqu'au mois affiché, par sous-catégorie,
 * avec la médiane des 12 mois précédents.
 *
 * Catégorie de dépenses : montants dépensés (positifs, remboursements déduits).
 * « Entrées d'argent » (onglet Revenus de Bankin) : montants reçus.
 */
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { BaseChartData } from './base/BaseChartData.js';
import { previousMonths } from './budgetComparison.js';

export const OTHERS_SUBCATEGORY_LABEL = 'Autres';

/** « 2026-03 » pour { year: 2026, month: 3 }. */
const key = ({ year, month }) => `${year}-${String(month).padStart(2, '0')}`;

/**
 * @param {object} params
 * @param {{ id: number, name: string, categories?: { id: number, name: string }[] }} params.category
 *   catégorie parente (ou sous-catégorie seule)
 * @param {{ amount: number, date: string, current_month?: number, category: { id: number } }[]} params.transactions
 * @param {{ year: number, month: number }} params.month mois affiché
 * @param {number} [params.count] nombre de mois affichés
 * @param {number} [params.maxSeries] nombre de sous-catégories détaillées (au-delà : « Autres »)
 * @param {number} [params.incomeCategoryId]
 * @returns {{ months: string[], series: { id: number | null, label: string, values: number[] }[], totals: number[], median: number, isIncome: boolean }}
 */
export function buildCategoryHistory({
    category,
    transactions,
    month,
    count = 12,
    maxSeries = 5,
    incomeCategoryId = Config.CATEGORIES.BUDGET_CATEGORY_ID,
}) {
    const isIncome = category.id === incomeCategoryId;
    const children = category.categories?.length ? category.categories : [];
    const parts = [...children, { id: category.id, name: category.name }];
    const partIds = new Set(parts.map((p) => p.id));

    const shown = [...previousMonths(month.year, month.month, count - 1), month].map(key);
    const reference = previousMonths(month.year, month.month, 12).map(key);
    const wanted = new Set([...shown, ...reference]);

    // Montant de chaque sous-catégorie, mois par mois
    /** @type {Map<number, Map<string, number>>} */
    const amounts = new Map(parts.map((p) => [p.id, new Map()]));
    for (const t of transactions) {
        const id = t?.category?.id;
        if (!partIds.has(id) || Config.CATEGORIES.EXCEPTION_IDS.includes(id)) continue;
        const m = DateRange.getBudgetMonth(t);
        const amount = Number(t.amount);
        if (!m || !wanted.has(m) || !Number.isFinite(amount)) continue;
        const perMonth = amounts.get(id);
        perMonth.set(m, (perMonth.get(m) || 0) + (isIncome ? amount : -amount));
    }

    const round = (value) => Math.round(value * 100) / 100;
    const sum = (values) => values.reduce((a, b) => a + b, 0);
    let series = parts
        .map((p) => ({ id: p.id, label: p.name, values: shown.map((m) => round(amounts.get(p.id).get(m) || 0)) }))
        .filter((s) => s.values.some((v) => v !== 0))
        .sort((a, b) => sum(b.values) - sum(a.values));
    if (series.length > maxSeries + 1) {
        const others = series.slice(maxSeries);
        series = [
            ...series.slice(0, maxSeries),
            { id: null, label: OTHERS_SUBCATEGORY_LABEL, values: shown.map((_, i) => round(sum(others.map((s) => s.values[i])))) },
        ];
    }

    const totalOf = (m) => round(sum(parts.map((p) => amounts.get(p.id).get(m) || 0)));
    return {
        months: shown,
        series,
        totals: shown.map(totalOf),
        median: round(BaseChartData.calculateMedian(reference.map(totalOf))),
        isIncome,
    };
}

/**
 * Catégorie Bankin d'après son identifiant : parente, ou sous-catégorie seule.
 * @param {{ id: number, name: string, categories?: object[] }[]} categories
 * @param {number} id
 * @returns {{ id: number, name: string, categories?: any[], parentId?: number } | null}
 */
export function findCategory(categories, id) {
    for (const parent of categories || []) {
        if (parent?.id === id) return parent;
        const child = parent?.categories?.find((c) => c?.id === id);
        if (child) return { id: child.id, name: child.name, parentId: parent.id };
    }
    return null;
}
