import { DateRange } from '../core/DateRange.js';
import { TransactionFilter } from '../core/TransactionFilter.js';
import { Account } from '../models/Account.js';
import { Category } from '../models/Category.js';
import { Transaction } from '../models/Transaction.js';

/**
 * DataMerger - Service pour fusionner et traiter les données de transactions
 * Responsable de la transformation et de l'export des données
 */
export class DataMerger {
    constructor(transactions, categorizations, accounts, startDate = null, endDate = null, accountsSelected = null) {
        this.transactions = this._validateAndTransformTransactions(transactions);
        this.accounts = this._validateAndTransformAccounts(accounts);
        this.categorizations = this._validateAndTransformCategories(categorizations);
        
        this.accountsMap = this._buildAccountMap();
        this.categoryMap = this._buildCategoryMap();
        
        // Bornes de période en `YYYY-MM-DD` (heure locale), voir DateRange
        this.startDate = DateRange.toDateOnly(startDate);
        this.endDate = DateRange.toDateOnly(endDate);
        this.accountsSelected = accountsSelected;
    }

    /**
     * Valide et transforme les transactions brutes
     * @param {Array} rawTransactions - Transactions brutes
     * @returns {Array<Transaction>} Transactions validées
     */
    _validateAndTransformTransactions(rawTransactions) {
        if (!Array.isArray(rawTransactions)) {
            console.warn('[DataMerger] Invalid transactions data, using empty array');
            return [];
        }

        
        const validTransactions = rawTransactions
            .map(rawTransaction => {
                try {
                    return Transaction.fromRaw(rawTransaction);
                } catch (error) {
                    console.warn('[DataMerger] Invalid transaction skipped:', error.message);
                    return null;
                }
            })
            .filter(transaction => transaction && transaction.isValid());

        return validTransactions;
    }

    /**
     * Valide et transforme les comptes bruts
     * @param {Array} rawAccounts - Comptes bruts
     * @returns {Array<Account>} Comptes validés
     */
    _validateAndTransformAccounts(rawAccounts) {
        if (!Array.isArray(rawAccounts)) {
            console.warn('[DataMerger] Invalid accounts data, using empty array');
            return [];
        }

        return rawAccounts
            .map(rawAccount => {
                try {
                    return Account.fromRaw(rawAccount);
                } catch (error) {
                    console.warn('[DataMerger] Invalid account skipped:', error.message);
                    return null;
                }
            })
            .filter(account => account && account.isValid());
    }

    /**
     * Valide et transforme les catégories brutes
     * @param {Array} rawCategories - Catégories brutes
     * @returns {Array<Category>} Catégories validées
     */
    _validateAndTransformCategories(rawCategories) {
        if (!Array.isArray(rawCategories)) {
            console.warn('[DataMerger] Invalid categories data, using empty array');
            return [];
        }

        const flatCategories = [];
        rawCategories.forEach(group => {
            try {
                flatCategories.push(Category.fromRaw(group));
                if (group.categories && Array.isArray(group.categories)) {
                    group.categories.forEach(category => {
                        flatCategories.push(Category.fromRaw(category, group.id));
                    });
                }
            } catch (error) {
                console.warn('[DataMerger] Invalid category group skipped:', error.message);
            }
        });

        return flatCategories;
    }

    /**
     * Construit une Map des comptes pour la recherche rapide
     * @returns {Map<number, Account>}
     */
    _buildAccountMap() {
        const accountsMap = new Map();
        this.accounts.forEach(account => {
            accountsMap.set(account.id, account);
        });
        return accountsMap;
    }

    /**
     * Construit une Map des catégories pour la recherche rapide
     * @returns {Map<number, Category>}
     */
    _buildCategoryMap() {
        const categoryMap = new Map();
        this.categorizations.forEach(category => {
            categoryMap.set(category.id, category);
        });
        return categoryMap;
    }

    /**
     * Fusionne les données avec leurs catégories et comptes correspondants
     * @returns {Array<Object>} Données fusionnées
     */
    mergeData() {
        const filteredTransactions = this._filterTransactions();
        const mergedData = this._mergeTransactionsWithMetadata(filteredTransactions);
        
        // Trier par date (chaînes YYYY-MM-DD)
        mergedData.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
        
        return mergedData;
    }

    /**
     * Filtre les transactions (période sur la date budgétaire, comptes sélectionnés).
     * L'export garde toutes les catégories, y compris virements internes et
     * épargne ; le rapport PDF les exclut ensuite (ReportFilters).
     * @returns {Array<Transaction>} Transactions filtrées
     */
    _filterTransactions() {
        return TransactionFilter.apply(this.transactions, {
            startDate: this.startDate,
            endDate: this.endDate,
            accountsSelected: this.accountsSelected,
        });
    }

    /**
     * Fusionne les transactions avec leurs métadonnées
     * @param {Array<Transaction>} transactions - Transactions à fusionner
     * @returns {Array<Object>} Données fusionnées
     */
    _mergeTransactionsWithMetadata(transactions) {
        return transactions.map(transaction => {
            const category = this.categoryMap.get(transaction.categoryId) || null;
            const account = this.accountsMap.get(transaction.accountId) || null;
            const parent = category && category.parentId != null ? this.categoryMap.get(category.parentId) : null;

            return {
                transactionId: transaction.id,
                // Date réelle de la transaction + mois de rattachement Bankin (décision B10)
                date: DateRange.toDateOnly(transaction.date),
                budgetMonth: transaction.getBudgetMonth(),
                amount: transaction.amount,
                description: transaction.description,
                // Compte supprimé ou fermé : on garde son id (bug B8)
                accountId: account ? account.id : transaction.accountId,
                accountName: account ? account.getDisplayName() : DataMerger.UNKNOWN_ACCOUNT,
                categoryId: category ? category.id : null,
                categoryName: category ? category.name : 'Uncategorized',
                parentCategoryId: category ? category.parentId : null,
                parentCategoryName: parent ? parent.name : 'Uncategorized',
                expenseType: transaction.expense_type
            };
        });
    }

    static UNKNOWN_ACCOUNT = 'Compte inconnu';

    static CSV_COLUMNS = [
        ['Transaction ID', 'transactionId'],
        ['Date', 'date'],
        ['Budget Month', 'budgetMonth'],
        ['Amount', 'amount'],
        ['Description', 'description'],
        ['Account ID', 'accountId'],
        ['Account Name', 'accountName'],
        ['Category ID', 'categoryId'],
        ['Category Name', 'categoryName'],
        ['Parent Category ID', 'parentCategoryId'],
        ['Parent Category Name', 'parentCategoryName'],
        ['Expense Type', 'expenseType'],
    ];

    /**
     * Cellule CSV (RFC 4180) : textes entre guillemets avec guillemets doublés ;
     * un texte commençant par = + - @ (ou tabulation / retour) est préfixé d'une
     * apostrophe pour qu'un tableur ne l'exécute pas comme une formule (bug B7).
     * @param {unknown} value
     * @returns {string}
     */
    static escapeCsvCell(value) {
        if (value == null) return '';
        if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
        let text = String(value);
        if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
        return `"${text.replace(/"/g, '""')}"`;
    }

    /**
     * Convertit les données fusionnées au format CSV
     * @param {Array<Object>} data - Données à convertir
     * @returns {string} Contenu CSV
     */
    convertToCSV(data) {
        const header = DataMerger.CSV_COLUMNS.map(([label]) => label).join(',');
        const rows = data.map(row =>
            DataMerger.CSV_COLUMNS.map(([, key]) => DataMerger.escapeCsvCell(row[key])).join(',')
        );
        return [header, ...rows].join('\r\n');
    }

    /**
     * Exporte les données fusionnées au format CSV (fichier téléchargé).
     * Fichier en UTF-8 avec BOM pour qu'Excel affiche correctement les accents.
     */
    exportToCSV() {
        const mergedData = this.mergeData();
        const csvContent = this.convertToCSV(mergedData);
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = `transaction_export_${DateRange.getTodayInputValue()}.csv`;
        document.body.appendChild(link);
        try {
            link.click();
        } finally {
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 0);
        }
        return mergedData.length;
    }

    /**
     * Retourne des statistiques sur les données
     * @returns {Object} Statistiques
     */
    getStats() {
        const mergedData = this.mergeData();
        const totalAmount = mergedData.reduce((sum, row) => sum + row.amount, 0);
        const expenses = mergedData.filter(row => row.amount < 0);
        const income = mergedData.filter(row => row.amount > 0);
        
        return {
            totalTransactions: mergedData.length,
            totalAmount: totalAmount,
            totalExpenses: expenses.reduce((sum, row) => sum + Math.abs(row.amount), 0),
            totalIncome: income.reduce((sum, row) => sum + row.amount, 0),
            dateRange: {
                start: this.startDate,
                end: this.endDate
            },
            accountsCount: this.accountsSelected ? this.accountsSelected.length : this.accounts.length
        };
    }
} 