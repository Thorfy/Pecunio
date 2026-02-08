/**
 * DataMerger - Service pour fusionner et traiter les données de transactions
 * Responsable de la transformation et de l'export des données
 */
class DataMerger {
    constructor(transactions, categorizations, accounts, startDate = null, endDate = null, accountsSelected = null) {
        this.transactions = this._validateAndTransformTransactions(transactions);
        this.accounts = this._validateAndTransformAccounts(accounts);
        this.categorizations = this._validateAndTransformCategories(categorizations);
        
        this.accountsMap = this._buildAccountMap();
        this.categoryMap = this._buildCategoryMap();
        
        this.startDate = startDate ? new Date(startDate) : null;
        this.endDate = endDate ? new Date(endDate) : null;
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

        console.log('[DataMerger] Validating', rawTransactions.length, 'raw transactions');
        
        const validTransactions = rawTransactions
            .map(rawTransaction => {
                try {
                    return Transaction.fromRaw(rawTransaction);
                } catch (error) {
                    console.warn('[DataMerger] Invalid transaction skipped:', error.message, rawTransaction);
                    return null;
                }
            })
            .filter(transaction => {
                if (!transaction) return false;
                const isValid = transaction.isValid();
                if (!isValid) {
                    console.warn('[DataMerger] Invalid transaction filtered out:', transaction);
                }
                return isValid;
            });
            
        console.log('[DataMerger] Valid transactions after validation:', validTransactions.length);
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
        
        // Trier les transactions par date
        mergedData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        return mergedData;
    }

    /**
     * Filtre les transactions selon les critères définis
     * @returns {Array<Transaction>} Transactions filtrées
     */
    _filterTransactions() {
        console.log('[DataMerger] Filtering transactions...');
        console.log('[DataMerger] Total transactions before filter:', this.transactions.length);
        console.log('[DataMerger] Date range:', this.startDate, 'to', this.endDate);
        console.log('[DataMerger] Selected accounts:', this.accountsSelected);
        
        const toDateOnly = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const startStr = this.startDate ? toDateOnly(this.startDate) : null;
        const endStr = this.endDate ? toDateOnly(this.endDate) : null;

        const filtered = this.transactions.filter(transaction => {
            const adjustedDate = transaction.getAdjustedDate();
            const dateOnly = toDateOnly(adjustedDate);

            // Filtre par date (comparaison en date seule pour éviter les soucis de fuseau horaire)
            if (startStr && endStr) {
                if (dateOnly < startStr || dateOnly > endStr) {
                    console.log(`[DataMerger] Transaction ${transaction.id} filtered out by date: ${dateOnly} not in range [${startStr}, ${endStr}]`);
                    return false;
                }
            }

            // Filtre par compte
            if (this.accountsSelected && this.accountsSelected.length > 0) {
                if (!this.accountsSelected.includes(transaction.accountId)) {
                    console.log(`[DataMerger] Transaction ${transaction.id} filtered out by account: ${transaction.accountId} not in selected`);
                    return false;
                }
            }

            return true;
        });
        
        console.log('[DataMerger] Transactions after filter:', filtered.length);
        return filtered;
    }

    /**
     * Fusionne les transactions avec leurs métadonnées
     * @param {Array<Transaction>} transactions - Transactions à fusionner
     * @returns {Array<Object>} Données fusionnées
     */
    _mergeTransactionsWithMetadata(transactions) {
        return transactions.map(transaction => {
            const category = this.categoryMap.get(transaction.categoryId) || {};
            const account = this.accountsMap.get(transaction.accountId) || {};
            
            return {
                transactionId: transaction.id,
                date: transaction.getAdjustedDate().toISOString().split('T')[0],
                amount: transaction.amount,
                description: transaction.description,
                accountId: account.id || null,
                accountName: account.getDisplayName(),
                categoryId: category.id || null,
                categoryName: category.name || 'Uncategorized',
                parentCategoryId: category.parentId || null,
                parentCategoryName: category.parentId ? 
                    (this.categoryMap.get(category.parentId)?.name || 'Uncategorized') : 
                    'Uncategorized',
                expenseType: transaction.expense_type
            };
        });
    }

    /**
     * Convertit les données fusionnées au format CSV
     * @param {Array<Object>} data - Données à convertir
     * @returns {string} Contenu CSV
     */
    convertToCSV(data) {
        const header = [
            "Transaction ID", "Date", "Amount", "Description", 
            "Account ID", "Account Name", "Category ID", "Category Name", 
            "Parent Category ID", "Parent Category Name", "Expense Type"
        ];
        
        const csvRows = [header.join(",")];

        data.forEach(row => {
            const values = [
                row.transactionId,
                row.date,
                row.amount,
                `"${row.description}"`,
                row.accountId,
                `"${row.accountName}"`,
                row.categoryId,
                `"${row.categoryName}"`,
                row.parentCategoryId,
                `"${row.parentCategoryName}"`,
                row.expenseType
            ];
            csvRows.push(values.join(","));
        });

        return csvRows.join("\r\n");
    }

    /**
     * Exporte les données fusionnées au format CSV
     */
    exportToCSV() {
        try {
            const mergedData = this.mergeData();
            const csvContent = this.convertToCSV(mergedData);
            const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);

            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `transaction_export_${new Date().toLocaleDateString()}.csv`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log(`[DataMerger] Exported ${mergedData.length} transactions to CSV`);
        } catch (error) {
            console.error('[DataMerger] Error exporting to CSV:', error);
            throw error;
        }
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