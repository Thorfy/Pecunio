/**
 * ReportFilters - Filtrage et statistiques pour le rapport PDF
 * Réutilise Config.CATEGORIES.EXCEPTION_IDS pour cohérence avec l'app
 */
class ReportFilters {
    /**
     * Filtre les données comme l'app : exclut les catégories (virements internes, etc.)
     * @param {Array<Object>} mergedData - Données fusionnées (mergeData du DataMerger)
     * @param {Object} params - Paramètres (exceptionCategoryIds optionnel)
     * @returns {Array<Object>}
     */
    static applyReportFilters(mergedData, params = {}) {
        const exceptionIds = (params.exceptionCategoryIds && Array.isArray(params.exceptionCategoryIds))
            ? params.exceptionCategoryIds
            : (typeof Config !== 'undefined' && Config.CATEGORIES && Config.CATEGORIES.EXCEPTION_IDS
                ? Config.CATEGORIES.EXCEPTION_IDS
                : [326, 282]);

        return mergedData.filter(row => {
            const id = row.categoryId != null ? row.categoryId : row.parentCategoryId;
            return id == null || !exceptionIds.includes(Number(id));
        });
    }

    /**
     * Calcule les statistiques globales (nombre, revenus, dépenses)
     * @param {Array<Object>} filteredData - Données déjà filtrées
     * @returns {{ totalTransactions: number, totalIncome: number, totalExpenses: number }}
     */
    static computeStats(filteredData) {
        const expenses = filteredData.filter(row => row.amount < 0);
        const income = filteredData.filter(row => row.amount > 0);
        return {
            totalTransactions: filteredData.length,
            totalIncome: income.reduce((sum, row) => sum + row.amount, 0),
            totalExpenses: expenses.reduce((sum, row) => sum + Math.abs(row.amount), 0)
        };
    }

    /**
     * Filtre pour le graphique Revenus vs Dépenses : exclut épargne, remboursements
     * @param {Array<Object>} filteredData - Données déjà filtrées par catégories
     * @returns {Array<Object>}
     */
    static filterIncomeExpenseData(filteredData) {
        const remboursementKeys = ['remboursement', 'refund', 'avoir'];
        const isRemboursement = (row) => {
            const desc = (row.description || '').toLowerCase();
            const cat = ((row.categoryName || '') + ' ' + (row.parentCategoryName || '')).toLowerCase();
            return remboursementKeys.some(k => (desc + ' ' + cat).includes(k));
        };
        return filteredData.filter(row => {
            if (row.expenseType === 'SAVING') return false;
            if (isRemboursement(row)) return false;
            return true;
        });
    }

    /**
     * Calcule totaux revenus et dépenses pour le graphique Revenus vs Dépenses
     * @param {Array<Object>} filteredData - Données déjà filtrées
     * @returns {{ totalIncome: number, totalExpenses: number }}
     */
    static computeIncomeExpenseForChart(filteredData) {
        const data = ReportFilters.filterIncomeExpenseData(filteredData);
        const totalIncome = data.filter(row => row.amount > 0).reduce((sum, row) => sum + row.amount, 0);
        const totalExpenses = data.filter(row => row.amount < 0).reduce((sum, row) => sum + Math.abs(row.amount), 0);
        return { totalIncome, totalExpenses };
    }

    /**
     * Statistiques pour l’en-tête du rapport (mêmes règles que le graphique Revenus vs Dépenses :
     * exclut épargne, remboursements, etc.)
     * @param {Array<Object>} filteredData - Données déjà filtrées par catégories
     * @returns {{ totalTransactions: number, totalIncome: number, totalExpenses: number }}
     */
    static computeStatsLikeIncomeExpenseChart(filteredData) {
        const data = ReportFilters.filterIncomeExpenseData(filteredData);
        const expenses = data.filter(row => row.amount < 0);
        const income = data.filter(row => row.amount > 0);
        return {
            totalTransactions: data.length,
            totalIncome: income.reduce((sum, row) => sum + row.amount, 0),
            totalExpenses: expenses.reduce((sum, row) => sum + Math.abs(row.amount), 0)
        };
    }
}
