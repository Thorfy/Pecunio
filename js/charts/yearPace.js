/**
 * Rythme de l'année (page Comptes) : dépenses cumulées jour après jour d'une
 * année, face à une année de référence ou à la médiane, jour par jour, des
 * cumuls de plusieurs années.
 *
 * Une année ne sert de référence que si elle est complète (données dès
 * janvier, année terminée) : il en faut au moins une pour comparer.
 */
import { Config } from '../core/Config.js';
import { DateRange } from '../core/DateRange.js';
import { BaseChartData } from './base/BaseChartData.js';

/** Jours de l'axe : une année de 365 jours, le 29 février compté avec le 28. */
export const DAYS_IN_YEAR = 365;
const MONTH_STARTS = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Années prises au plus dans la médiane. */
export const MAX_MEDIAN_YEARS = 5;

/**
 * Indice (0 à 364) d'un jour de l'année, identique d'une année à l'autre.
 * @param {number} month 1 à 12
 * @param {number} day
 */
export function dayOfYearIndex(month, day) {
    return MONTH_STARTS[month - 1] + Math.min(day, MONTH_LENGTHS[month - 1]) - 1;
}

/**
 * Mois et jour d'un indice de l'axe (inverse de dayOfYearIndex).
 * @param {number} index
 * @returns {{ month: number, day: number }}
 */
export function monthDayFromIndex(index) {
    let month = 12;
    while (MONTH_STARTS[month - 1] > index) month--;
    return { month, day: index - MONTH_STARTS[month - 1] + 1 };
}

/**
 * Dépenses nettes de chaque jour, par année (remboursements déduits), hors
 * revenus, virements internes et épargne ; date budgétaire de Bankin.
 * @param {{ amount: number, date: string, current_month?: number, category: { id: number } }[]} transactions
 * @param {Set<number>} incomeCategoryIds
 * @returns {{ perYear: Map<number, number[]>, firstMonth: string | null }}
 */
export function dailySpendingByYear(transactions, incomeCategoryIds = new Set()) {
    const perYear = new Map();
    let firstMonth = null;
    for (const t of transactions) {
        const categoryId = t?.category?.id;
        if (incomeCategoryIds.has(categoryId) || Config.CATEGORIES.EXCEPTION_IDS.includes(categoryId)) continue;
        const budgetDate = DateRange.getBudgetDate(t);
        const amount = Number(t.amount);
        if (!budgetDate || !Number.isFinite(amount)) continue;
        const month = budgetDate.slice(0, 7);
        if (firstMonth == null || month < firstMonth) firstMonth = month;
        const year = Number(budgetDate.slice(0, 4));
        if (!perYear.has(year)) perYear.set(year, new Array(DAYS_IN_YEAR).fill(0));
        perYear.get(year)[dayOfYearIndex(Number(budgetDate.slice(5, 7)), Number(budgetDate.slice(8, 10)))] -= amount;
    }
    return { perYear, firstMonth };
}

/**
 * Années proposées : celles qui ont des dépenses (affichables) et, parmi
 * elles, les complètes (références possibles), de la plus récente à la plus ancienne.
 * @param {ReturnType<typeof dailySpendingByYear>} spending
 * @param {Date} today
 * @returns {{ years: number[], completeYears: number[] }}
 */
export function yearChoices({ perYear, firstMonth }, today) {
    const years = [...perYear.keys()].filter((y) => y <= today.getFullYear()).sort((a, b) => b - a);
    const completeYears = years.filter((y) => y < today.getFullYear() && firstMonth != null && firstMonth <= `${y}-01`);
    return { years, completeYears };
}

/**
 * Années de la médiane pour une année affichée : les années complètes qui la
 * précèdent, les plus récentes d'abord retenues (MAX_MEDIAN_YEARS au plus).
 * @param {number[]} completeYears
 * @param {number} year
 * @returns {number[]} dans l'ordre chronologique
 */
export function medianYears(completeYears, year) {
    return completeYears.filter((y) => y < year).sort((a, b) => b - a).slice(0, MAX_MEDIAN_YEARS).reverse();
}

/**
 * @param {object} params
 * @param {ReturnType<typeof dailySpendingByYear>} params.spending
 * @param {number} params.year année affichée
 * @param {number[]} params.referenceYears une année, ou plusieurs pour leur médiane
 * @param {Date} [params.today] pour arrêter la courbe à aujourd'hui sur l'année en cours
 * @returns {{ year: number, referenceYears: number[], current: (number | null)[], reference: number[], lastIndex: number, spent: number, usual: number, delta: number | null }}
 *   `lastIndex` : indice du dernier jour compté (-1 : année à venir)
 */
export function buildYearPace({ spending, year, referenceYears, today = new Date() }) {
    const cumulate = (values = new Array(DAYS_IN_YEAR).fill(0)) => {
        let total = 0;
        return values.map((v) => (total += v));
    };
    const round = (value) => Math.round(value * 100) / 100;

    // Année en cours : la courbe s'arrête à aujourd'hui
    const lastIndex = year < today.getFullYear()
        ? DAYS_IN_YEAR - 1
        : year > today.getFullYear() ? -1 : dayOfYearIndex(today.getMonth() + 1, today.getDate());
    const currentCumul = cumulate(spending.perYear.get(year));
    const current = currentCumul.map((v, i) => (i <= lastIndex ? round(v) : null));

    // Référence : l'année choisie, ou la médiane des cumuls au même jour
    const referenceCumuls = referenceYears.map((y) => cumulate(spending.perYear.get(y)));
    const reference = currentCumul.map((_, i) => round(BaseChartData.calculateMedian(referenceCumuls.map((c) => c[i]))));

    const spent = lastIndex >= 0 ? round(currentCumul[lastIndex]) : 0;
    const usual = lastIndex >= 0 ? reference[lastIndex] : 0;
    return {
        year,
        referenceYears,
        current,
        reference,
        lastIndex,
        spent,
        usual,
        delta: usual > 0 ? (spent - usual) / usual : null,
    };
}
