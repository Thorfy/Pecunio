/**
 * Comparaison du budget (page Comptes, lot UX-2a) : préréglages de périodes
 * et mise en forme « dépenses seules, triées, avec l'écart ».
 */
import { MONTH_NAMES } from '../utils/format.js';

/** Préréglages proposés, dans l'ordre des boutons. */
export const BUDGET_PRESETS = Object.freeze({
    current: 'Ce mois-ci',
    last: 'Mois dernier',
    year: 'Cette année',
    custom: 'Personnaliser',
});

/** Nombre de mois de la médiane de référence. */
export const REFERENCE_MONTHS = 12;

/**
 * Les `count` mois qui précèdent `year`/`month` (exclu), du plus ancien au plus récent.
 * @returns {{ year: number, month: number }[]}
 */
export function previousMonths(year, month, count) {
    const months = [];
    for (let i = count; i >= 1; i--) {
        const date = new Date(year, month - 1 - i, 1);
        months.push({ year: date.getFullYear(), month: date.getMonth() + 1 });
    }
    return months;
}

/**
 * @typedef {{ kind: 'month', year: number, month: number }
 *   | { kind: 'months', months: { year: number, month: number }[] }
 *   | { kind: 'year', year: number }} BudgetPeriod
 */

/**
 * Périodes comparées par un préréglage.
 * @param {'current' | 'last' | 'year'} preset
 * @param {Date} [now]
 * @returns {{ primary: BudgetPeriod, comparison: BudgetPeriod, primaryLabel: string, comparisonLabel: string }}
 */
export function presetPeriods(preset, now = new Date()) {
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    if (preset === 'year') {
        return {
            primary: { kind: 'year', year },
            comparison: { kind: 'year', year: year - 1 },
            primaryLabel: `Médiane mensuelle ${year}`,
            comparisonLabel: `Médiane mensuelle ${year - 1}`,
        };
    }
    const target = preset === 'current' ? { year, month } : previousMonths(year, month, 1)[0];
    return {
        primary: { kind: 'month', ...target },
        comparison: { kind: 'months', months: previousMonths(target.year, target.month, REFERENCE_MONTHS) },
        primaryLabel: preset === 'current' ? 'Ce mois-ci (en cours)' : `${MONTH_NAMES[target.month]} ${target.year}`,
        comparisonLabel: `Médiane des ${REFERENCE_MONTHS} mois précédents`,
    };
}

/**
 * @typedef {{ name: string, primary: number, comparison: number, delta: number | null }} ComparisonRow
 */

/**
 * Dépenses seules (montants positifs), triées de la plus importante à la plus
 * faible sur la période principale, avec l'écart relatif.
 * @param {Record<string, number>} primary montants signés par catégorie (dépenses < 0)
 * @param {Record<string, number>} comparison
 * @param {{ exclude?: Set<string> }} [options] catégories à ignorer (revenus, masquées)
 * @returns {{ rows: ComparisonRow[], totals: { primary: number, comparison: number, delta: number | null } }}
 */
export function toExpenseComparison(primary, comparison, { exclude = new Set() } = {}) {
    const spent = (value) => Math.round(Math.max(0, -(Number(value) || 0)) * 100) / 100;
    const deltaOf = (p, c) => (c > 0 ? (p - c) / c : null);
    const names = new Set([...Object.keys(primary), ...Object.keys(comparison)]);
    const rows = [];
    for (const name of names) {
        if (exclude.has(name)) continue;
        const p = spent(primary[name]);
        const c = spent(comparison[name]);
        if (p === 0 && c === 0) continue;
        rows.push({ name, primary: p, comparison: c, delta: deltaOf(p, c) });
    }
    rows.sort((a, b) => b.primary - a.primary || b.comparison - a.comparison || a.name.localeCompare(b.name));
    const total = (key) => Math.round(rows.reduce((sum, row) => sum + row[key], 0) * 100) / 100;
    const totals = { primary: total('primary'), comparison: total('comparison'), delta: null };
    totals.delta = deltaOf(totals.primary, totals.comparison);
    return { rows, totals };
}

const DELTA = new Intl.NumberFormat('fr-FR', { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });

/**
 * Écart relatif : « +12 % », « −7 % », « = » ; « nouveau » sans référence.
 * @param {number | null} delta
 */
export function formatDelta(delta) {
    if (delta == null) return 'nouveau';
    if (Math.abs(delta) < 0.005) return '=';
    return DELTA.format(delta);
}
