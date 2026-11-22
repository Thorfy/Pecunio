/**
 * Rythme du mois (page Catégories, lot UX-3a) : dépenses cumulées jour par
 * jour du mois affiché, face au rythme habituel (médiane, jour par jour, des
 * cumuls des 12 mois précédents).
 */
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { BaseChartData } from './base/BaseChartData.js';
import { previousMonths } from './budgetComparison.js';

/**
 * @param {object} params
 * @param {{ amount: number, date: string, current_month?: number, category: { id: number } }[]} params.transactions
 * @param {{ year: number, month: number }} params.month mois affiché
 * @param {Date} [params.today] pour arrêter la courbe au jour du mois en cours
 * @param {Set<number>} [params.incomeCategoryIds] catégories (et sous-catégories) de revenus, ignorées
 * @param {number} [params.referenceMonths]
 * @returns {{ days: number[], current: (number | null)[], reference: number[], lastDay: number, spent: number, usual: number, delta: number | null }}
 */
export function buildMonthPace({ transactions, month, today = new Date(), incomeCategoryIds = new Set(), referenceMonths = 12 }) {
    const key = ({ year, month: m }) => `${year}-${String(m).padStart(2, '0')}`;
    const daysIn = ({ year, month: m }) => new Date(year, m, 0).getDate();
    const reference = previousMonths(month.year, month.month, referenceMonths);
    const wanted = new Map([month, ...reference].map((m) => [key(m), new Array(daysIn(m)).fill(0)]));

    // Dépenses nettes de chaque jour (remboursements déduits), hors revenus et virements internes
    for (const t of transactions) {
        const categoryId = t?.category?.id;
        if (incomeCategoryIds.has(categoryId) || Config.CATEGORIES.EXCEPTION_IDS.includes(categoryId)) continue;
        const budgetDate = DateRange.getBudgetDate(t);
        const amount = Number(t.amount);
        if (!budgetDate || !Number.isFinite(amount)) continue;
        const perDay = wanted.get(budgetDate.slice(0, 7));
        if (!perDay) continue;
        const day = Math.min(Number(budgetDate.slice(8, 10)), perDay.length);
        perDay[day - 1] -= amount;
    }

    const cumulate = (values) => {
        let total = 0;
        return values.map((v) => (total += v));
    };
    const round = (value) => Math.round(value * 100) / 100;
    const lastDay = daysIn(month);
    const days = Array.from({ length: lastDay }, (_, i) => i + 1);

    // Mois en cours : la courbe s'arrête à aujourd'hui
    const isCurrent = today.getFullYear() === month.year && today.getMonth() + 1 === month.month;
    const isFuture = month.year * 12 + month.month > today.getFullYear() * 12 + today.getMonth() + 1;
    const stopAt = isFuture ? 0 : isCurrent ? today.getDate() : lastDay;
    const currentCumul = cumulate(wanted.get(key(month)));
    const current = days.map((d) => (d <= stopAt ? round(currentCumul[d - 1]) : null));

    // Habituel : médiane des cumuls au même jour (mois plus courts : leur total)
    const referenceCumuls = reference.map((m) => cumulate(wanted.get(key(m))));
    const usualAt = (day) => round(BaseChartData.calculateMedian(referenceCumuls.map((c) => c[Math.min(day, c.length) - 1])));
    const referenceLine = days.map(usualAt);

    const spent = stopAt > 0 ? round(currentCumul[stopAt - 1]) : 0;
    const usual = stopAt > 0 ? referenceLine[stopAt - 1] : 0;
    return {
        days,
        current,
        reference: referenceLine,
        lastDay: stopAt,
        spent,
        usual,
        delta: usual > 0 ? (spent - usual) / usual : null,
    };
}
