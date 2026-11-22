/**
 * Plus fortes variations (page Catégories, G5, lot UX-3b) : catégories dont
 * la dépense du mois affiché s'écarte le plus de leur médiane des 12 mois
 * précédents. Mois en cours : comparaison au même jour du mois, pour ne pas
 * opposer un mois entamé à des mois complets.
 */
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { BaseChartData } from './base/BaseChartData.js';
import { previousMonths } from './budgetComparison.js';

const round = (value) => Math.round(value * 100) / 100;

/**
 * Arrondi symétrique : -37,5 → -38 comme 37,5 → 38 (Math.round donne -37).
 * @param {number} value
 */
export function roundHalfAway(value) {
    return Math.sign(value) * Math.round(Math.abs(value));
}

/**
 * @typedef {{ id: number, name: string, current: number, usual: number, diff: number, pct: number | null }} Variation
 */

/**
 * @param {object} params
 * @param {{ id: number, name: string, categories?: { id: number }[] }[]} params.categories catégories parentes
 * @param {{ amount: number, date: string, current_month?: number, category: { id: number } }[]} params.transactions
 * @param {{ year: number, month: number }} params.month mois affiché
 * @param {Date} [params.today]
 * @param {number} [params.referenceMonths]
 * @param {number} [params.limit] nombre de catégories gardées
 * @param {number} [params.minAmount] écart minimal en euros (en deçà : bruit)
 * @returns {{ items: Variation[], day: number | null }} `day` : jour de comparaison du mois en cours
 */
export function buildVariations({
    categories,
    transactions,
    month,
    today = new Date(),
    referenceMonths = 12,
    limit = 5,
    minAmount = 20,
}) {
    const key = ({ year, month: m }) => `${year}-${String(m).padStart(2, '0')}`;
    const reference = previousMonths(month.year, month.month, referenceMonths).map(key);
    const shown = key(month);
    const isCurrent = today.getFullYear() === month.year && today.getMonth() + 1 === month.month;
    const day = isCurrent ? today.getDate() : null;

    // Catégorie parente de chaque sous-catégorie ; revenus et virements internes ignorés
    const incomeId = Config.CATEGORIES.BUDGET_CATEGORY_ID;
    /** @type {Map<number, { id: number, name: string }>} */
    const parentOf = new Map();
    for (const parent of categories) {
        if (!parent || parent.id === incomeId) continue;
        parentOf.set(parent.id, parent);
        for (const child of parent.categories || []) parentOf.set(child.id, parent);
    }

    /** @type {Map<number, Map<string, number>>} dépense nette par catégorie et par mois */
    const spend = new Map();
    const wanted = new Set([shown, ...reference]);
    for (const t of transactions) {
        const categoryId = t?.category?.id;
        if (Config.CATEGORIES.EXCEPTION_IDS.includes(categoryId)) continue;
        const parent = parentOf.get(categoryId);
        const budgetDate = DateRange.getBudgetDate(t);
        const amount = Number(t.amount);
        if (!parent || !budgetDate || !Number.isFinite(amount)) continue;
        const monthKey = budgetDate.slice(0, 7);
        if (!wanted.has(monthKey)) continue;
        // Mois en cours : seulement jusqu'au même jour, dans chaque mois
        if (day != null && Number(budgetDate.slice(8, 10)) > day) continue;
        const perMonth = spend.get(parent.id) || new Map();
        perMonth.set(monthKey, (perMonth.get(monthKey) || 0) - amount);
        spend.set(parent.id, perMonth);
    }

    /** @type {Variation[]} */
    const items = [];
    for (const [id, perMonth] of spend) {
        const current = round(perMonth.get(shown) || 0);
        const usual = round(BaseChartData.calculateMedian(reference.map((m) => perMonth.get(m) || 0)));
        const diff = round(current - usual);
        if (Math.abs(diff) < minAmount) continue;
        items.push({ id, name: parentOf.get(id).name, current, usual, diff, pct: usual > 0 ? diff / usual : null });
    }
    items.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
    return { items: items.slice(0, limit), day };
}
