/**
 * Transaction - Modèle représentant une transaction bancaire
 * Contient toutes les informations d'une transaction
 */
class Transaction {
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
     * Retourne la date ajustée selon current_month
     * @returns {Date}
     */
    getAdjustedDate() {
        const adjustedDate = new Date(this.date);
        
        if (this.current_month != null && typeof this.current_month === 'number') {
            adjustedDate.setDate(1);
            adjustedDate.setMonth(adjustedDate.getMonth() + this.current_month);
        }
        
        return adjustedDate;
    }

    /**
     * Vérifie si la transaction est une dépense
     * @returns {boolean}
     */
    isExpense() {
        return this.amount < 0;
    }

    /**
     * Vérifie si la transaction est un revenu
     * @returns {boolean}
     */
    isIncome() {
        return this.amount > 0;
    }

    /**
     * Retourne le montant absolu
     * @returns {number}
     */
    getAbsoluteAmount() {
        return Math.abs(this.amount);
    }

    /**
     * Retourne le mois de la transaction (1-12)
     * @returns {number}
     */
    getMonth() {
        return this.getAdjustedDate().getMonth() + 1;
    }

    /**
     * Retourne l'année de la transaction
     * @returns {number}
     */
    getYear() {
        return this.getAdjustedDate().getFullYear();
    }

    /**
     * Retourne une représentation string de la transaction
     * @returns {string}
     */
    toString() {
        return `Transaction(id: ${this.id}, amount: ${this.amount}, date: ${this.date}, description: "${this.description}")`;
    }

    /**
     * Compare cette transaction avec une autre
     * @param {Transaction} other - Autre transaction à comparer
     * @returns {boolean}
     */
    equals(other) {
        if (!(other instanceof Transaction)) {
            return false;
        }
        return this.id === other.id;
    }

    /**
     * Retourne une copie de la transaction
     * @returns {Transaction}
     */
    clone() {
        return new Transaction(
            this.id,
            this.amount,
            this.accountId,
            this.date,
            this.description,
            this.categoryId,
            this.current_month,
            this.expense_type
        );
    }
} 