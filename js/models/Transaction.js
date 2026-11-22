import { DateRange } from '../core/DateRange.js';

/**
 * Transaction - Modèle représentant une transaction bancaire
 * Contient toutes les informations d'une transaction
 */
export class Transaction {
    constructor(id, amount, accountId, date, description, categoryId, current_month, expense_type) {
        this.id = id;
        this.amount = amount;
        this.accountId = accountId;
        this.date = date;
        this.description = description;
        this.categoryId = categoryId;
        this.current_month = current_month;
        this.expense_type = expense_type;
    }

    /**
     * Crée une instance Transaction à partir de données brutes
     * @param {Object} rawTransaction - Données brutes de la transaction
     * @returns {Transaction} Instance de Transaction
     */
    static fromRaw(rawTransaction) {
        if (!rawTransaction || !rawTransaction.id) {
            throw new Error('Invalid raw transaction data');
        }

        return new Transaction(
            rawTransaction.id,
            rawTransaction.amount || 0,
            parseInt(rawTransaction.account?.id) || null,
            rawTransaction.date || new Date(),
            rawTransaction.description || '',
            rawTransaction.category?.id || null,
            rawTransaction.current_month || 0,
            rawTransaction.expense_type || null
        );
    }

    /**
     * Vérifie si la transaction est valide
     * @returns {boolean}
     */
    isValid() {
        return this.id != null && 
               this.amount != null && 
               this.accountId != null && 
               this.date != null &&
               this.categoryId != null;
    }

    /**
     * Date budgétaire `YYYY-MM-DD` : date réelle décalée du mois de rattachement
     * Bankin (`current_month`), jour conservé. Voir DateRange.getBudgetDate.
     * @returns {string|null}
     */
    getBudgetDate() {
        return DateRange.getBudgetDate(this);
    }

    /**
     * Mois de rattachement `YYYY-MM`.
     * @returns {string|null}
     */
    getBudgetMonth() {
        return DateRange.getBudgetMonth(this);
    }

    /**
     * Date budgétaire sous forme de Date locale (minuit).
     * @returns {Date|null}
     */
    getAdjustedDate() {
        return DateRange.toLocalDate(this.getBudgetDate());
    }
} 