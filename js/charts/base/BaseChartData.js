/**
 * Interface IChart - Contrat que tous les charts doivent respecter
 * 
 * Tous les charts doivent implémenter :
 * - async prepareData(...args): Promise<Object> - Prépare les données pour le chart
 *   - Retourne les données formatées pour Chart.js ou le format spécifique au chart
 *   - Les paramètres peuvent varier selon le type de chart
 * 
 * Les charts qui utilisent Chart.js directement doivent aussi implémenter :
 * - async getChartJsConfig(): Promise<Object> - Retourne la configuration Chart.js complète
 *   - Doit retourner un objet avec les propriétés : type, data, options, plugins
 * 
 * Exemples :
 * - LineBarChart : prepareData() + getChartJsConfig()
 * - BudgetChart : prepareData(yearLeft, monthLeft, yearRight, monthRight, calcType) - pas de getChartJsConfig (géré en interne)
 * - SankeyChart : prepareData() - pas de getChartJsConfig (créé directement dans injected.js)
 * 
 * @interface IChart
 */
// Note: En JavaScript, on ne peut pas forcer l'implémentation d'une interface,
// mais cette documentation sert de contrat pour tous les charts

/**
 * Classe de base pour tous les charts Pecunio
 * Centralise la logique commune : filtrage des données, gestion des catégories, parsing des couleurs
 * 
 * Implémente IChart
 */
class BaseChartData {
    constructor(transactions, categories, accountsSelected = null, settings = null, settingsInstance = null) {
        this.transactions = transactions || [];
        this.categories = categories || [];
        this.accountsSelected = accountsSelected;
        this.settings = settings;
        this.settingsInstance = settingsInstance; // Instance de Settings injectée
        
        // Initialisation du lookup des catégories
        this.categoryLookup = new Map();
        this._initializeCategoryLookup();
    }

    /**
     * Initialise le lookup des catégories pour un accès rapide
     */
    _initializeCategoryLookup() {
        if (!this.categories || !Array.isArray(this.categories)) {
            console.warn('[BaseChartData] _initializeCategoryLookup: No categories provided or invalid format');
            return;
        }

        this.categories.forEach(parentCategory => {
            if (parentCategory && parentCategory.id != null && parentCategory.name) {
                this.categoryLookup.set(parentCategory.id, parentCategory.name);
                
                // Ajouter aussi les catégories enfants
                if (parentCategory.categories && Array.isArray(parentCategory.categories)) {
                    parentCategory.categories.forEach(childCategory => {
                        if (childCategory && childCategory.id != null) {
                            this.categoryLookup.set(childCategory.id, parentCategory.name);
                        }
                    });
                }
            }
        });
    }

    /**
     * Applique les filtres de paramètres sur les données de transactions
     * @param {Object} options - Options de filtrage
     * @param {string} options.startDate - Date de début (optionnel)
     * @param {string} options.endDate - Date de fin (optionnel)
     * @param {Array} options.accountsSelected - Comptes sélectionnés (optionnel)
     * @param {Array} options.exceptionCategories - Catégories à exclure (optionnel)
     * @returns {Array} Transactions filtrées
     */
    applySettingOnData(options = {}) {
        // Utiliser l'instance injectée ou fallback sur settingClass global (pour compatibilité)
        const settingsProvider = this.settingsInstance || (typeof settingClass !== 'undefined' ? settingClass : null);
        
        const {
            startDate = settingsProvider ? settingsProvider.getSetting('startDate') : null,
            endDate = settingsProvider ? settingsProvider.getSetting('endDate') : null,
            accountsSelected = this.accountsSelected,
            exceptionCategories = Config.CATEGORIES.EXCEPTION_IDS
        } = options;

        if (!this.transactions || !Array.isArray(this.transactions)) {
            console.warn('[BaseChartData] applySettingOnData: No transactions to process or not an array.');
            return [];
        }

        const startDateParsed = startDate ? Date.parse(startDate) : null;
        const endDateParsed = endDate ? Date.parse(endDate) : null;

        return this.transactions.filter(transaction => {
            if (!transaction || !transaction.date || !transaction.account || transaction.account.id == null) {
                return false;
            }
            
            // Traitement de la date avec current_month (sans muter l'objet original)
            const dateForProcessing = this.getAdjustedDate(transaction);
            if (!dateForProcessing) {
                return false;
            }
            
            const modifiedDateForComparison = dateForProcessing.toDateString();

            // Filtre par date
            let dateFilterPassed = true;
            if (startDateParsed && endDateParsed) {
                dateFilterPassed = Date.parse(modifiedDateForComparison) >= startDateParsed && 
                                 Date.parse(modifiedDateForComparison) <= endDateParsed;
            } else if (startDateParsed) {
                dateFilterPassed = Date.parse(modifiedDateForComparison) >= startDateParsed;
            } else if (endDateParsed) {
                dateFilterPassed = Date.parse(modifiedDateForComparison) <= endDateParsed;
            }

            // Filtre par compte
            let accountFilterPassed = true;
            if (accountsSelected && accountsSelected.length > 0) {
                accountFilterPassed = accountsSelected.includes(parseInt(transaction.account.id));
            }
            
            return dateFilterPassed && accountFilterPassed;
        });
    }

    /**
     * Applique les filtres de paramètres avec filtrage par mois/année spécifiques
     * @param {string} targetMonth - Mois cible (nom du mois)
     * @param {number} targetYear - Année cible
     * @param {Array} exceptionCategories - Catégories à exclure (optionnel)
     * @returns {Array} Transactions filtrées
     */
    applySettingOnDataByMonth(targetMonth, targetYear, exceptionCategories = Config.CATEGORIES.EXCEPTION_IDS) {
        if (!this.transactions || !Array.isArray(this.transactions)) {
            return [];
        }

        return this.transactions.filter(transaction => {
            if (!transaction || !transaction.date) {
                return false;
            }

            // Utiliser la date ajustée qui tient compte de current_month
            const transactionDate = this.getAdjustedDate(transaction);
            if (!transactionDate) {
                return false;
            }
            
            // S'assurer que la date est au premier jour du mois pour la comparaison
            const dateForComparison = new Date(transactionDate);
            dateForComparison.setDate(1);
            
            const transactionMonth = dateForComparison.toLocaleString('default', { month: 'long' });
            const transactionYear = dateForComparison.getUTCFullYear();
            
            return transactionMonth === targetMonth && transactionYear === parseInt(targetYear);
        });
    }

    /**
     * Fusionne les transactions par catégorie
     * @param {Array} allTransactions - Toutes les transactions
     * @param {Array} allCategories - Toutes les catégories
     * @param {Array} exceptionCategories - Catégories à exclure (optionnel)
     * @returns {Object|Map} Données organisées par catégorie
     */
    mergeTransactionByCategory(allTransactions, allCategories, exceptionCategories = Config.CATEGORIES.EXCEPTION_IDS) {
        const preparedData = new Map();

        allTransactions.forEach(transaction => {
            if (exceptionCategories.includes(transaction.category.id)) {
                return; // Ignorer les catégories d'exception
            }

            allCategories.forEach(category => {
                if (!preparedData.has(category.id)) {
                    preparedData.set(category.id, []);
                }

                // Vérifier si la transaction appartient à cette catégorie parent
                if (transaction.category.id === category.id) {
                    preparedData.get(category.id).push(transaction);
                } else {
                    // Vérifier les catégories enfants
                    category.categories.forEach(childCategory => {
                        if (!preparedData.has(childCategory.id)) {
                            preparedData.set(childCategory.id, []);
                        }

                        if (transaction.category.id === childCategory.id) {
                            preparedData.get(category.id).push(transaction);
                            preparedData.get(childCategory.id).push(transaction);
                        }
                    });
                }
            });
        });

        return preparedData;
    }

    /**
     * Version legacy pour compatibilité avec ChartData.js
     * @param {Array} allTransactions - Toutes les transactions
     * @param {Array} allCategories - Toutes les catégories
     * @param {Array} exceptionCategories - Catégories à exclure (optionnel)
     * @returns {Array} Données organisées par catégorie (format legacy)
     */
    mergeTransactionByCategoryLegacy(allTransactions, allCategories, exceptionCategories = Config.CATEGORIES.EXCEPTION_IDS) {
        const preparedData = [];

        allTransactions.forEach(transaction => {
            allCategories.forEach(category => {
                if (!preparedData[category.id]) {
                    preparedData[category.id] = [];
                }

                if (transaction.category.id === category.id && !exceptionCategories.includes(transaction.category.id)) {
                    preparedData[category.id].push(transaction);
                } else {
                    category.categories.forEach(childCategory => {
                        if (transaction.category.id === childCategory.id && !exceptionCategories.includes(transaction.category.id)) {
                            preparedData[category.id].push(transaction);
                        }
                    });
                }
            });
        });

        return preparedData;
    }


    /**
     * Obtient la date ajustée d'une transaction en tenant compte de current_month
     * Ne mute pas l'objet transaction original
     * @param {Object} transaction - Transaction à traiter
     * @returns {Date} Date ajustée selon current_month
     */
    getAdjustedDate(transaction) {
        if (!transaction || !transaction.date) {
            return null;
        }
        
        let adjustedDate = new Date(transaction.date);
        if (transaction.current_month != null && typeof transaction.current_month === 'number' && !isNaN(transaction.current_month)) {
            adjustedDate.setDate(1);
            adjustedDate.setMonth(adjustedDate.getMonth() + transaction.current_month);
        }
        
        return adjustedDate;
    }

    /**
     * Obtient le nom d'une catégorie par son ID
     * @param {number} categoryId - ID de la catégorie
     * @returns {string|null} Nom de la catégorie ou null si non trouvée
     */
    getCategoryNameById(categoryId) {
        return this.categoryLookup.get(categoryId) || null;
    }

    /**
     * Vérifie si une catégorie est une catégorie d'exception
     * @param {number} categoryId - ID de la catégorie
     * @returns {boolean} True si c'est une catégorie d'exception
     */
    isExceptionCategory(categoryId) {
        return Config.CATEGORIES.EXCEPTION_IDS.includes(categoryId);
    }

    /**
     * Obtient toutes les catégories non-exception
     * @returns {Array} Catégories valides
     */
    getValidCategories() {
        return this.categories.filter(category => !this.isExceptionCategory(category.id));
    }

    /**
     * Méthode utilitaire pour formater une date en chaîne YYYY-MM
     * @param {Date} date - Date à formater
     * @returns {string} Date formatée
     */
    formatDateToYearMonth(date) {
        const month = `${date.getMonth() + 1}`.padStart(2, "0");
        const year = date.getUTCFullYear();
        return [year, month].join("-");
    }

    /**
     * Méthode utilitaire pour obtenir le nom court d'un mois
     * @param {number} monthNumber - Numéro du mois (1-12)
     * @returns {string} Nom court du mois
     */
    getMonthName(monthNumber) {
        const monthNames = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        return monthNames[monthNumber] || '';
    }

    /**
     * Méthode utilitaire pour calculer la médiane d'un tableau
     * @param {Array} arr - Tableau de nombres
     * @returns {number} Médiane
     */
    static calculateMedian(arr) {
        if (!arr || arr.length === 0) return 0;
        const numericArr = arr.filter(val => typeof val === 'number' && !isNaN(val));
        if (numericArr.length === 0) return 0;
        const sortedArr = [...numericArr].sort((a, b) => a - b);
        const mid = Math.floor(sortedArr.length / 2);
        return sortedArr.length % 2 === 0 ? (sortedArr[mid - 1] + sortedArr[mid]) / 2 : sortedArr[mid];
    }

    /**
     * Méthode utilitaire pour calculer la moyenne d'un tableau
     * @param {Array} arr - Tableau de nombres
     * @returns {number} Moyenne
     */
    static calculateAverage(arr) {
        if (!arr || arr.length === 0) return 0;
        const numericArr = arr.filter(val => typeof val === 'number' && !isNaN(val));
        if (numericArr.length === 0) return 0;
        const sum = numericArr.reduce((acc, val) => acc + val, 0);
        return sum / numericArr.length;
    }
} 