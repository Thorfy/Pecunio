/**
 * Épargne mois par mois (G1, lot UX-3b) : solde du mois (revenus − dépenses)
 * et taux d'épargne (solde / revenus). Le mois en cours, incomplet, est
 * affiché mais exclu des totaux.
 */
import { DateRange } from '../core/DateRange.js';

const round = (value) => Math.round(value * 100) / 100;

/**
 * Part des revenus mise de côté (négative en cas de déficit) ; null sans revenus.
 * @param {number} income
 * @param {number} balance
 * @returns {number | null}
 */
export function savingsRate(income, balance) {
    return income > 0 ? balance / income : null;
}

/**
 * @typedef {{ months: string[], income: number[], balance: number[], rate: (number | null)[],
 *   inProgress: number, total: { count: number, income: number, balance: number, rate: number | null } }} Savings
 */

/**
 * @param {object} params
 * @param {string[]} params.months mois « YYYY-MM »
 * @param {number[]} params.income revenus de chaque mois
 * @param {number[]} params.balance solde de chaque mois
 * @param {string | null} [params.currentMonth] mois en cours (« YYYY-MM »), exclu des totaux
 * @returns {Savings}
 */
export function buildSavings({ months, income, balance, currentMonth = null }) {
    const inProgress = currentMonth ? months.indexOf(currentMonth) : -1;
    const complete = months.map((_, i) => i).filter((i) => i !== inProgress);
    const totalOf = (values) => round(complete.reduce((sum, i) => sum + (values[i] || 0), 0));
    const totalIncome = totalOf(income);
    const totalBalance = totalOf(balance);
    return {
        months,
        income,
        balance,
        rate: months.map((_, i) => savingsRate(income[i], balance[i])),
        inProgress,
        total: { count: complete.length, income: totalIncome, balance: totalBalance, rate: savingsRate(totalIncome, totalBalance) },
    };
}

/**
 * Depuis le graphique temporel de la page Comptes : mêmes mois, même solde.
 * @param {{ months: string[], series: { kind: string, values: number[] }[], balance: number[] }} timeline
 * @param {string | null} [currentMonth]
 */
export function savingsFromTimeline(timeline, currentMonth = null) {
    const incomeSeries = timeline.series.filter((s) => s.kind === 'income');
    const income = timeline.months.map((_, i) => round(incomeSeries.reduce((sum, s) => sum + (s.values[i] || 0), 0)));
    return buildSavings({ months: timeline.months, income, balance: timeline.balance, currentMonth });
}

/**
 * Depuis les lignes du rapport (montants signés, mois de rattachement) : un
 * mois par mois présent dans les données.
 * @param {{ amount: number, budgetMonth?: string, date?: string }[]} rows
 */
export function savingsFromRows(rows) {
    /** @type {Map<string, { income: number, expenses: number }>} */
    const byMonth = new Map();
    for (const row of rows) {
        const amount = Number(row.amount);
        const month = row.budgetMonth || (row.date ? String(row.date).slice(0, 7) : '');
        if (!month || !Number.isFinite(amount)) continue;
        const entry = byMonth.get(month) || { income: 0, expenses: 0 };
        if (amount > 0) entry.income += amount;
        else entry.expenses -= amount;
        byMonth.set(month, entry);
    }
    const months = [...byMonth.keys()].sort();
    return buildSavings({
        months,
        income: months.map((m) => round(byMonth.get(m).income)),
        balance: months.map((m) => round(byMonth.get(m).income - byMonth.get(m).expenses)),
    });
}

/** Mois en cours « YYYY-MM ». */
export function currentMonthKey(today = new Date()) {
    return DateRange.toDateOnly(today)?.slice(0, 7) ?? null;
}

/**
 * Bornes de deux axes dont les zéros tombent à la même hauteur (soldes en
 * euros à gauche, taux en % à droite) : sans cela, un mois en déficit décale
 * l'un des zéros et la courbe semble passer sous les barres.
 * @param {number[]} left valeurs de l'axe de gauche
 * @param {number[]} right valeurs de l'axe de droite
 * @returns {{ left: { min: number, max: number }, right: { min: number, max: number } }}
 */
export function zeroAlignedRanges(left, right) {
    const span = (values, minimumMax) => {
        const finite = values.filter((v) => Number.isFinite(v));
        return { min: Math.min(0, ...finite), max: Math.max(minimumMax, ...finite) };
    };
    const a = span(left, 1);
    const b = span(right, 10);
    // Part de chaque axe sous le zéro : la plus grande s'impose aux deux
    const below = Math.max(-a.min / (a.max - a.min), -b.min / (b.max - b.min));
    const fit = ({ min, max }) => {
        if (below === 0) return { min: 0, max: max * 1.1 };
        // Mêmes proportions : |min| / (max + |min|) = below, en gardant l'étendue nécessaire
        const top = Math.max(max, (-min * (1 - below)) / below);
        return { min: (-top * below) / (1 - below) * 1.1, max: top * 1.1 };
    };
    return { left: fit(a), right: fit(b) };
}
