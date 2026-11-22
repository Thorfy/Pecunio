import { Config } from '../../core/Config.js';
import { DateRange } from '../../core/DateRange.js';
import { TransactionFilter } from '../../core/TransactionFilter.js';

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
export class BaseChartData {
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
     * Détruit l'instance Chart.js du graphique et ses écouteurs.
     * Appelé avant chaque reconstruction (PageController) pour ne rien laisser en mémoire.
     */
    destroy() {
        const chart = this.chartInstance;
        if (!chart) return;
        if (chart._pecunioAmountVisibilityHandler) {
            window.removeEventListener('pecunio_amounts_visibility_changed', chart._pecunioAmountVisibilityHandler);
            chart._pecunioAmountVisibilityHandler = null;
        }
        chart.destroy();
        this.chartInstance = null;
    }

    /**
     * Attache l'écouteur de visibilité des montants (blur). Met à jour la globale et appelle chart.update().
     * @param {Chart} chart - Instance Chart.js
     */
    static _attachAmountVisibilityListener(chart) {
        const handler = (e) => {
            if (!chart.canvas || !chart.canvas.isConnected) {
                window.removeEventListener('pecunio_amounts_visibility_changed', handler);
                return;
            }
            window.__pecunioIsBlurry = !!e.detail.isBlurry;
            chart.update();
        };
        window.addEventListener('pecunio_amounts_visibility_changed', handler);
        chart._pecunioAmountVisibilityHandler = handler;
    }

    /**
     * Applique la période et les comptes des réglages (voir TransactionFilter).
     * N'exclut pas les catégories d'exception : chaque graphique le fait lui-même.
     * @param {Object} [options] - Surcharge des réglages
     * @param {string|null} [options.startDate]
     * @param {string|null} [options.endDate]
     * @param {Array<number>|null} [options.accountsSelected]
     * @returns {Array} Transactions filtrées
     */
    applySettingOnData(options = {}) {
        if (!this.transactions || !Array.isArray(this.transactions)) {
            console.warn('[BaseChartData] applySettingOnData: No transactions to process or not an array.');
            return [];
        }

        // Instance de Settings fournie au constructeur
        const settingsProvider = this.settingsInstance;
        const setting = (key) => (settingsProvider ? settingsProvider.getSetting(key) : null);

        const {
            startDate = setting('startDate'),
            endDate = DateRange.getEffectiveEndDate({ endDate: setting('endDate'), noEndDate: !!setting('noEndDate') }),
            accountsSelected = this.accountsSelected
        } = options;

        return TransactionFilter.apply(
            this.transactions.filter(t => t && t.account && t.account.id != null),
            { startDate, endDate, accountsSelected }
        );
    }

    /**
     * Transactions d'un mois donné (mois de rattachement Bankin).
     * @param {string|number} targetMonth - Mois tel qu'affiché par Bankin (« février »),
     *   en français ou en anglais, ou numéro 1-12 — indépendant de la langue du navigateur (bug B19)
     * @param {string|number} targetYear - Année
     * @returns {Array} Transactions filtrées
     */
    applySettingOnDataByMonth(targetMonth, targetYear) {
        if (!this.transactions || !Array.isArray(this.transactions)) {
            return [];
        }
        const month = DateRange.monthIndexFromLabel(targetMonth);
        const year = parseInt(targetYear, 10);
        if (month == null || isNaN(year)) {
            console.warn('[BaseChartData] applySettingOnDataByMonth: unknown month', targetMonth, targetYear);
            return [];
        }
        const wanted = `${year}-${String(month).padStart(2, '0')}`;
        return this.transactions.filter(transaction => DateRange.getBudgetMonth(transaction) === wanted);
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
                    // Vérifier les catégories enfants (absentes pour certaines catégories : bug B17)
                    (category.categories || []).forEach(childCategory => {
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
                    (category.categories || []).forEach(childCategory => {
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
        return DateRange.toLocalDate(DateRange.getBudgetDate(transaction));
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