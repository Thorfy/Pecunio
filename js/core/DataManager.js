/**
 * DataManager - Gestionnaire centralisé des données
 * Responsable de la récupération, du cache et de la transformation des données
 */
class DataManager {
    static REQUIRED_HEADERS = Config.API.REQUIRED_HEADERS;
    static DOMAIN = Config.API.DOMAIN;
    static ENDPOINTS = Config.API.ENDPOINTS;
    static CACHE_DURATION = Config.API.CACHE_DURATION;
    static EXCEPTION_CATEGORIES = Config.CATEGORIES.EXCEPTION_IDS;

    constructor() {
        this.port = chrome.runtime.connect();
        this.authHeader = null;
        this.cachedData = {
            transactions: null,
            categories: null,
            accounts: null,
            cacheTime: {}
        };
        this.initializationPromise = this._initializeAuth();
    }

    /**
     * Initialise l'authentification et charge les données
     */
    async _initializeAuth() {
        return new Promise((resolve, reject) => {
            this.port.onMessage.addListener(message => {
                if (!message.data || Object.keys(message.data).length === 0) {
                    return false;
                }

                // Vérifier que tous les headers requis sont présents
                const hasAllHeaders = DataManager.REQUIRED_HEADERS.every(header => 
                    message.data.hasOwnProperty(header)
                );

                if (!hasAllHeaders) {
                    return false;
                }

                this.authHeader = message.data;
                this._loadAllData().then(resolve).catch(reject);
            });

            // Timeout pour éviter un blocage infini
            setTimeout(() => reject(new Error('Auth timeout')), 10000);
        });
    }

    /**
     * Charge toutes les données (transactions, catégories, comptes)
     */
    async _loadAllData() {
        try {
            const [transactions, categories, accounts] = await Promise.all([
                this._loadDataWithCache('transactions'),
                this._loadDataWithCache('categories'),
                this._loadDataWithCache('accounts')
            ]);

            this.cachedData = {
                transactions,
                categories,
                accounts,
                cacheTime: {
                    transactions: Date.now(),
                    categories: Date.now(),
                    accounts: Date.now()
                }
            };

            evt.dispatch('data_loaded');
            return this.cachedData;
        } catch (error) {
            console.error('[DataManager] Error loading data:', error);
            throw error;
        }
    }

    /**
     * Charge les données avec gestion du cache
     */
    async _loadDataWithCache(dataType) {
        const cacheKey = Config.getCacheKey(dataType);
        const timeKey = Config.getCacheTimeKey(dataType);

        // Vérifier le cache
        const cachedData = settingClass.getSetting(cacheKey);
        const cachedTime = settingClass.getSetting(timeKey);

        if (cachedData && cachedTime && (Date.now() - cachedTime < DataManager.CACHE_DURATION)) {
            evt.dispatch(`cache_data_${dataType}_loaded`);
            return cachedData;
        }

        // Charger les données fraîches
        const freshData = await this._fetchDataFromAPI(dataType);
        
        // Mettre en cache
        const cacheObject = {
            [cacheKey]: freshData,
            [timeKey]: Date.now()
        };
        await settingClass.setSettings(cacheObject);

        return freshData;
    }

    /**
     * Récupère les données depuis l'API Bankin
     */
    async _fetchDataFromAPI(dataType) {
        const url = DataManager.ENDPOINTS[dataType];
        if (!url) {
            throw new Error(`Unknown data type: ${dataType}`);
        }

        const allData = [];
        await this._fetchPaginatedData(url, allData);
        evt.dispatch('fresh_data_loaded');
        return allData;
    }

    /**
     * Récupère les données paginées depuis l'API
     */
    async _fetchPaginatedData(url, globalData) {
        const myInit = {
            method: 'GET',
            headers: this.authHeader,
            mode: 'cors',
            cache: 'default'
        };

        try {
            const response = await fetch(DataManager.DOMAIN + url, myInit);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.resources && data.resources.length) {
                Array.prototype.push.apply(globalData, data.resources);
            }

            // Récupérer la page suivante si elle existe
            if (data.pagination && data.pagination.next_uri && data.pagination.next_uri.length) {
                await this._fetchPaginatedData(data.pagination.next_uri, globalData);
            }

            return globalData;
        } catch (error) {
            console.error(`[DataManager] Error fetching data from ${url}:`, error);
            throw error;
        }
    }

    /**
     * Filtre les transactions selon les critères donnés
     */
    filterTransactions(transactions, options = {}) {
        const {
            startDate = null,
            endDate = null,
            accountsSelected = null,
            excludeCategories = DataManager.EXCEPTION_CATEGORIES
        } = options;

        return transactions.filter(transaction => {
            // Vérifier les données requises
            if (!transaction || !transaction.date || !transaction.category || !transaction.account) {
                return false;
            }

                    // Exclure les catégories d'exception
        if (Config.isExceptionCategory(transaction.category.id)) {
            return false;
        }

            // Traiter la date
            let transactionDate = new Date(transaction.date);
            if (transaction.current_month != null && typeof transaction.current_month === 'number') {
                transactionDate.setDate(1);
                transactionDate.setMonth(transactionDate.getMonth() + transaction.current_month);
            }

            // Filtrer par date
            if (startDate || endDate) {
                const dateString = transactionDate.toDateString();
                const dateTimestamp = Date.parse(dateString);

                if (startDate && dateTimestamp < Date.parse(startDate)) {
                    return false;
                }
                if (endDate && dateTimestamp > Date.parse(endDate)) {
                    return false;
                }
            }

            // Filtrer par compte
            if (accountsSelected && accountsSelected.length > 0) {
                const accountId = parseInt(transaction.account.id);
                if (!accountsSelected.includes(accountId)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Organise les transactions par catégorie
     */
    organizeTransactionsByCategory(transactions, categories) {
        const organizedData = new Map();

        // Initialiser toutes les catégories
        categories.forEach(category => {
            organizedData.set(category.id, []);
            
            if (category.categories) {
                category.categories.forEach(childCategory => {
                    organizedData.set(childCategory.id, []);
                });
            }
        });

        // Organiser les transactions
        transactions.forEach(transaction => {
            const categoryId = transaction.category.id;
            
            // Ajouter à la catégorie enfant
            if (organizedData.has(categoryId)) {
                organizedData.get(categoryId).push(transaction);
            }

            // Ajouter à la catégorie parent si c'est une sous-catégorie
            categories.forEach(parentCategory => {
                if (parentCategory.categories) {
                    parentCategory.categories.forEach(childCategory => {
                        if (childCategory.id === categoryId) {
                            organizedData.get(parentCategory.id).push(transaction);
                        }
                    });
                }
            });
        });

        return organizedData;
    }

    /**
     * Crée une Map pour la recherche rapide des catégories
     */
    createCategoryLookup(categories) {
        const lookup = new Map();
        
        categories.forEach(parentCategory => {
            if (parentCategory.id != null && parentCategory.name) {
                lookup.set(parentCategory.id, parentCategory.name);
                
                if (parentCategory.categories) {
                    parentCategory.categories.forEach(childCategory => {
                        if (childCategory.id != null) {
                            lookup.set(childCategory.id, parentCategory.name);
                        }
                    });
                }
            }
        });

        return lookup;
    }

    /**
     * Parse une couleur CSS depuis une classe
     */
    static parseColorCSS(strClass) {
        const styleElement = document.createElement("div");
        styleElement.className = strClass;
        document.body.appendChild(styleElement);
        const colorVal = window.getComputedStyle(styleElement).backgroundColor;
        styleElement.remove();
        return colorVal;
    }

    /**
     * Récupère les données mises en cache
     */
    getCachedData() {
        return this.cachedData;
    }

    /**
     * Force le rechargement des données
     */
    async refreshData() {
        // Vider le cache
        const cacheObject = {
            cache_data_transactions: "",
            cache_time_transactions: "",
            cache_data_categories: "",
            cache_time_categories: "",
            cache_data_accounts: "",
            cache_time_accounts: ""
        };
        await settingClass.setSettings(cacheObject);
        
        // Recharger les données
        return this._loadAllData();
    }

    /**
     * Attend que l'initialisation soit terminée
     */
    async waitForInitialization() {
        return this.initializationPromise;
    }
} 