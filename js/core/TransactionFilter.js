import { DateRange } from './DateRange.js';

/**
 * TransactionFilter - Filtre unique des transactions (période, comptes, catégories)
 *
 * Utilisé par les graphiques, l'export et le rapport, pour que tous appliquent
 * exactement les mêmes règles (bug B14). Accepte les transactions brutes de
 * l'API Bankin (`account.id`, `category.id`) comme les modèles `Transaction`
 * (`accountId`, `categoryId`).
 *
 * La période porte sur la date budgétaire (date réelle + `current_month`),
 * bornes incluses, comparées en `YYYY-MM-DD` (voir DateRange).
 */
export class TransactionFilter {
    /** @param {object} t */
    static accountIdOf(t) {
        const id = t.accountId ?? t.account?.id;
        if (id == null || id === '') return null;
        const n = Number(id);
        return isNaN(n) ? null : n;
    }

    /** @param {object} t */
    static categoryIdOf(t) {
        const id = t.categoryId ?? t.category?.id;
        if (id == null || id === '') return null;
        const n = Number(id);
        return isNaN(n) ? null : n;
    }

    /**
     * Normalise les options de filtre (dates en `YYYY-MM-DD`, ids en nombres).
     * @param {{ startDate?: any, endDate?: any, accountsSelected?: Array<number|string>|null,
     *           excludeCategoryIds?: Array<number|string> }} [options]
     */
    static normalize(options = {}) {
        const toIds = (list) => (Array.isArray(list) ? list.map(Number).filter((n) => !isNaN(n)) : []);
        return {
            start: DateRange.toDateOnly(options.startDate),
            end: DateRange.toDateOnly(options.endDate),
            accounts: toIds(options.accountsSelected),
            excluded: toIds(options.excludeCategoryIds),
        };
    }

    /**
     * La transaction passe-t-elle le filtre ?
     * @param {object} transaction
     * @param {ReturnType<typeof TransactionFilter.normalize>} criteria options déjà normalisées
     */
    static matchesNormalized(transaction, criteria) {
        if (!transaction || transaction.date == null) return false;

        if (criteria.excluded.length > 0) {
            const categoryId = TransactionFilter.categoryIdOf(transaction);
            if (categoryId != null && criteria.excluded.includes(categoryId)) return false;
        }

        if (criteria.accounts.length > 0) {
            const accountId = TransactionFilter.accountIdOf(transaction);
            if (accountId == null || !criteria.accounts.includes(accountId)) return false;
        }

        if (criteria.start || criteria.end) {
            return DateRange.isDateInRange(DateRange.getBudgetDate(transaction), criteria.start, criteria.end);
        }
        return DateRange.getBudgetDate(transaction) != null;
    }

    /**
     * @param {object} transaction
     * @param {Parameters<typeof TransactionFilter.normalize>[0]} [options]
     */
    static matches(transaction, options = {}) {
        return TransactionFilter.matchesNormalized(transaction, TransactionFilter.normalize(options));
    }

    /**
     * @template T
     * @param {T[]} transactions
     * @param {Parameters<typeof TransactionFilter.normalize>[0]} [options]
     * @returns {T[]}
     */
    static apply(transactions, options = {}) {
        if (!Array.isArray(transactions)) return [];
        const criteria = TransactionFilter.normalize(options);
        return transactions.filter((t) => TransactionFilter.matchesNormalized(t, criteria));
    }
}
