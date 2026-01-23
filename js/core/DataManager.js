/**
 * DataManager - Gestionnaire centralisé des données
 * Responsable de la récupération, du cache et de la transformation des données
 */
class DataManager {
    static REQUIRED_HEADERS = Config.API.REQUIRED_HEADERS;
    static DOMAIN = Config.API.DOMAIN;
    static ENDPOINTS = Config.API.ENDPOINTS;
    static CACHE_DURATION = Config.API.CACHE_DURATION;

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
            let messageListener = null;
            let timeoutId = null;

            const cleanup = () => {
                if (messageListener) {
                    this.port.onMessage.removeListener(messageListener);
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            };

            messageListener = (message) => {
                if (!message || !message.data || Object.keys(message.data).length === 0) {
                    return false;
                }

                // Vérifier que tous les headers requis sont présents
                const hasAllHeaders = DataManager.REQUIRED_HEADERS.every(header => 
                    message.data.hasOwnProperty(header) && message.data[header]
                );

                if (!hasAllHeaders) {
                    console.warn('[DataManager] Missing required headers:', 
                        DataManager.REQUIRED_HEADERS.filter(h => !message.data[h]));
                    return false;
                }

                cleanup();
                this.authHeader = message.data;
                this._loadAllData()
                    .then(resolve)
                    .catch(reject);
            };

            this.port.onMessage.addListener(messageListener);

            // Timeout pour éviter un blocage infini
            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('Auth timeout: No authentication headers received after 10 seconds. Please refresh the Bankin page.'));
            }, 10000);

            // Gérer la déconnexion du port
            this.port.onDisconnect.addListener(() => {
                cleanup();
                reject(new Error('Port disconnected: Background script connection lost.'));
            });
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
        // Mapping des types de données (minuscules) vers les clés ENDPOINTS (majuscules)
        const endpointMap = {
            'transactions': 'TRANSACTIONS',
            'categories': 'CATEGORIES',
            'accounts': 'ACCOUNTS'
        };
        
        const endpointKey = endpointMap[dataType];
        if (!endpointKey) {
            throw new Error(`Unknown data type: ${dataType}. Expected one of: ${Object.keys(endpointMap).join(', ')}`);
        }
        
        const url = DataManager.ENDPOINTS[endpointKey];
        if (!url) {
            throw new Error(`Endpoint not found for data type: ${dataType} (key: ${endpointKey})`);
        }

        const allData = [];
        await this._fetchPaginatedData(url, allData);
        evt.dispatch('fresh_data_loaded');
        return allData;
    }

    /**
     * Récupère les données paginées depuis l'API avec retry automatique
     * @param {string} url - URL à récupérer
     * @param {Array} globalData - Tableau pour accumuler les données
     * @param {number} retryCount - Nombre de tentatives restantes
     * @returns {Promise<Array>} Données récupérées
     */
    async _fetchPaginatedData(url, globalData, retryCount = 3) {
        // Vérifier que l'authentification est complète
        if (!this.authHeader) {
            throw new Error('Cannot fetch data: Authentication headers not available. Please wait for initialization to complete.');
        }
        
        const myInit = {
            method: 'GET',
            headers: this.authHeader,
            mode: 'cors',
            cache: 'default'
        };

        try {
            const response = await fetch(DataManager.DOMAIN + url, myInit);
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new Error(`Authentication error! status: ${response.status}. Please refresh Bankin page.`);
                }
                if (response.status >= 500 && retryCount > 0) {
                    console.warn(`[DataManager] Server error ${response.status}, retrying... (${retryCount} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1s avant retry
                    return this._fetchPaginatedData(url, globalData, retryCount - 1);
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            // Valider la structure des données
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid response format: expected object');
            }

            if (data.resources && Array.isArray(data.resources) && data.resources.length) {
                Array.prototype.push.apply(globalData, data.resources);
            }

            // Récupérer la page suivante si elle existe
            if (data.pagination && data.pagination.next_uri && typeof data.pagination.next_uri === 'string' && data.pagination.next_uri.length) {
                await this._fetchPaginatedData(data.pagination.next_uri, globalData, retryCount);
            }

            return globalData;
        } catch (error) {
            if (retryCount > 0 && !error.message.includes('Authentication')) {
                console.warn(`[DataManager] Error fetching data from ${url}, retrying... (${retryCount} attempts left):`, error.message);
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this._fetchPaginatedData(url, globalData, retryCount - 1);
            }
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
            excludeCategories = Config.CATEGORIES.EXCEPTION_IDS
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
     * Récupère les données mises en cache
     */
    getCachedData() {
        return this.cachedData;
    }

    /**
     * Force le rechargement des données
     * Attend que l'authentification soit complète avant de recharger
     */
    async refreshData() {
        // Attendre que l'authentification soit terminée
        await this.waitForInitialization();
        
        // Vérifier que l'authentification a réussi
        if (!this.authHeader) {
            throw new Error('Cannot refresh data: Authentication not completed. Please refresh the Bankin page.');
        }
        
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