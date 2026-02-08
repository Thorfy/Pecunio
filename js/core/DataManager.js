/**
 * Erreurs typées pour DataManager
 */
class DataManagerError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'DataManagerError';
        this.code = code;
        this.details = details;
    }
}

class AuthenticationError extends DataManagerError {
    constructor(message, details = {}) {
        super(message, 'AUTH_ERROR', details);
        this.name = 'AuthenticationError';
    }
}

class ValidationError extends DataManagerError {
    constructor(message, dataType, invalidData = null) {
        super(message, 'VALIDATION_ERROR', { dataType, invalidData });
        this.name = 'ValidationError';
        this.dataType = dataType;
        this.invalidData = invalidData;
    }
}

class APIError extends DataManagerError {
    constructor(message, statusCode, url, details = {}) {
        super(message, 'API_ERROR', { statusCode, url, ...details });
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.url = url;
    }
}

/**
 * Validateurs de données pour DataManager
 */
class DataValidators {
    /**
     * Valide une transaction
     * @param {Object} transaction - Transaction à valider
     * @returns {{valid: boolean, errors: Array<string>}}
     */
    static validateTransaction(transaction) {
        const errors = [];

        if (!transaction || typeof transaction !== 'object') {
            return { valid: false, errors: ['Transaction must be an object'] };
        }

        if (!transaction.id && transaction.id !== 0) {
            errors.push('Transaction missing required field: id');
        }

        if (transaction.amount === undefined || transaction.amount === null || typeof transaction.amount !== 'number') {
            errors.push('Transaction missing or invalid field: amount (must be a number)');
        }

        if (!transaction.date) {
            errors.push('Transaction missing required field: date');
        } else {
            const date = new Date(transaction.date);
            if (isNaN(date.getTime())) {
                errors.push(`Transaction has invalid date: ${transaction.date}`);
            }
        }

        if (!transaction.account || typeof transaction.account !== 'object') {
            errors.push('Transaction missing required field: account (object)');
        } else if (!transaction.account.id && transaction.account.id !== 0) {
            errors.push('Transaction.account missing required field: id');
        }

        if (!transaction.category || typeof transaction.category !== 'object') {
            errors.push('Transaction missing required field: category (object)');
        } else if (!transaction.category.id && transaction.category.id !== 0) {
            errors.push('Transaction.category missing required field: id');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valide une catégorie
     * @param {Object} category - Catégorie à valider
     * @returns {{valid: boolean, errors: Array<string>}}
     */
    static validateCategory(category) {
        const errors = [];

        if (!category || typeof category !== 'object') {
            return { valid: false, errors: ['Category must be an object'] };
        }

        if (!category.id && category.id !== 0) {
            errors.push('Category missing required field: id');
        }

        if (!category.name || typeof category.name !== 'string' || category.name.trim() === '') {
            errors.push('Category missing or invalid field: name (must be a non-empty string)');
        }

        // Les sous-catégories sont optionnelles mais doivent être un tableau si présentes
        if (category.categories !== undefined && !Array.isArray(category.categories)) {
            errors.push('Category.categories must be an array if present');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valide un compte
     * @param {Object} account - Compte à valider
     * @returns {{valid: boolean, errors: Array<string>}}
     */
    static validateAccount(account) {
        const errors = [];

        if (!account || typeof account !== 'object') {
            return { valid: false, errors: ['Account must be an object'] };
        }

        if (!account.id && account.id !== 0) {
            errors.push('Account missing required field: id');
        }

        if (!account.name || typeof account.name !== 'string' || account.name.trim() === '') {
            errors.push('Account missing or invalid field: name (must be a non-empty string)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Valide un tableau de données
     * @param {Array} dataArray - Tableau de données à valider
     * @param {Function} validator - Fonction de validation pour chaque élément
     * @param {string} dataType - Type de données (pour les logs)
     * @returns {{valid: boolean, validItems: Array, invalidItems: Array, errors: Array<string>}}
     */
    static validateArray(dataArray, validator, dataType = 'data') {
        if (!Array.isArray(dataArray)) {
            return {
                valid: false,
                validItems: [],
                invalidItems: [],
                errors: [`Expected array for ${dataType}, got ${typeof dataArray}`]
            };
        }

        const validItems = [];
        const invalidItems = [];
        const allErrors = [];

        dataArray.forEach((item, index) => {
            const validation = validator(item);
            if (validation.valid) {
                validItems.push(item);
            } else {
                invalidItems.push({
                    index,
                    item,
                    errors: validation.errors
                });
                allErrors.push(`Item ${index}: ${validation.errors.join(', ')}`);
            }
        });

        return {
            valid: invalidItems.length === 0,
            validItems,
            invalidItems,
            errors: allErrors
        };
    }
}

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
                reject(new AuthenticationError(
                    'Auth timeout: No authentication headers received after 10 seconds. Please refresh the Bankin page.',
                    { timeout: 10000 }
                ));
            }, 10000);

            // Gérer la déconnexion du port
            this.port.onDisconnect.addListener(() => {
                cleanup();
                reject(new AuthenticationError(
                    'Port disconnected: Background script connection lost.',
                    { reason: 'port_disconnect' }
                ));
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
     * Charge les données avec gestion du cache et validation
     */
    async _loadDataWithCache(dataType) {
        const cacheKey = Config.getCacheKey(dataType);
        const timeKey = Config.getCacheTimeKey(dataType);

        // Vérifier le cache
        const cachedData = settingClass.getSetting(cacheKey);
        const cachedTime = settingClass.getSetting(timeKey);

        if (cachedData && cachedTime && (Date.now() - cachedTime < DataManager.CACHE_DURATION)) {
            // Valider les données en cache aussi
            try {
                const validatedCache = this._validateFetchedData(cachedData, dataType);
                evt.dispatch(`cache_data_${dataType}_loaded`);
                return validatedCache;
            } catch (error) {
                console.warn(`[DataManager] Cached ${dataType} data is invalid, fetching fresh data:`, error.message);
                // Si le cache est invalide, continuer pour charger des données fraîches
            }
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
     * Récupère les données depuis l'API Bankin avec validation
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
            throw new ValidationError(
                `Unknown data type: ${dataType}. Expected one of: ${Object.keys(endpointMap).join(', ')}`,
                dataType
            );
        }
        
        const url = DataManager.ENDPOINTS[endpointKey];
        if (!url) {
            throw new ValidationError(
                `Endpoint not found for data type: ${dataType} (key: ${endpointKey})`,
                dataType
            );
        }

        const allData = [];
        await this._fetchPaginatedData(url, allData);
        
        // Valider les données récupérées selon leur type
        const validatedData = this._validateFetchedData(allData, dataType);
        
        evt.dispatch('fresh_data_loaded');
        return validatedData;
    }

    /**
     * Valide les données récupérées selon leur type
     * @param {Array} data - Données à valider
     * @param {string} dataType - Type de données ('transactions', 'categories', 'accounts')
     * @returns {Array} Données validées (seulement les éléments valides)
     */
    _validateFetchedData(data, dataType) {
        let validator;
        
        switch (dataType) {
            case 'transactions':
                validator = DataValidators.validateTransaction;
                break;
            case 'categories':
                validator = DataValidators.validateCategory;
                break;
            case 'accounts':
                validator = DataValidators.validateAccount;
                break;
            default:
                console.warn(`[DataManager] No validator for data type: ${dataType}`);
                return data;
        }

        const validation = DataValidators.validateArray(data, validator, dataType);
        
        if (!validation.valid && validation.invalidItems.length > 0) {
            // Logger les données invalides pour debug
            console.warn(`[DataManager] Found ${validation.invalidItems.length} invalid ${dataType} out of ${data.length}:`);
            validation.invalidItems.forEach(({ index, item, errors }) => {
                console.warn(`  [${dataType}][${index}] Errors: ${errors.join(', ')}`);
                console.warn(`  [${dataType}][${index}] Data:`, JSON.stringify(item, null, 2));
            });
        }

        if (validation.validItems.length === 0 && data.length > 0) {
            throw new ValidationError(
                `All ${dataType} data is invalid. No valid items found.`,
                dataType,
                validation.invalidItems
            );
        }

        return validation.validItems;
    }

    /**
     * Récupère les données paginées depuis l'API avec retry automatique amélioré
     * @param {string} url - URL à récupérer
     * @param {Array} globalData - Tableau pour accumuler les données
     * @param {number} retryCount - Nombre de tentatives restantes
     * @param {number} baseDelay - Délai de base pour le retry en ms (augmente exponentiellement)
     * @returns {Promise<Array>} Données récupérées
     */
    async _fetchPaginatedData(url, globalData, retryCount = 3, baseDelay = 1000) {
        // Vérifier que l'authentification est complète
        if (!this.authHeader) {
            throw new AuthenticationError(
                'Cannot fetch data: Authentication headers not available. Please wait for initialization to complete.'
            );
        }
        
        const myInit = {
            method: 'GET',
            headers: this.authHeader,
            mode: 'cors',
            cache: 'default'
        };

        const fullUrl = DataManager.DOMAIN + url;

        try {
            const response = await fetch(fullUrl, myInit);
            
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    throw new AuthenticationError(
                        `Authentication error! status: ${response.status}. Please refresh Bankin page.`,
                        { statusCode: response.status, url: fullUrl }
                    );
                }
                
                // Retry pour les erreurs serveur (5xx) et certaines erreurs réseau
                if ((response.status >= 500 || response.status === 429) && retryCount > 0) {
                    const delay = baseDelay * (4 - retryCount); // Backoff exponentiel
                    console.warn(`[DataManager] Server error ${response.status} for ${url}, retrying in ${delay}ms... (${retryCount} attempts left)`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this._fetchPaginatedData(url, globalData, retryCount - 1, baseDelay);
                }
                
                throw new APIError(
                    `HTTP error! status: ${response.status}`,
                    response.status,
                    fullUrl
                );
            }

            const data = await response.json();
            
            // Valider la structure des données
            if (!data || typeof data !== 'object') {
                throw new ValidationError(
                    'Invalid response format: expected object',
                    'api_response',
                    data
                );
            }

            // Valider la présence de resources ou pagination
            if (!data.resources && !data.pagination) {
                throw new ValidationError(
                    'Invalid API response: missing both resources and pagination',
                    'api_response',
                    data
                );
            }

            if (data.resources && Array.isArray(data.resources) && data.resources.length) {
                Array.prototype.push.apply(globalData, data.resources);
            }

            // Récupérer la page suivante si elle existe
            if (data.pagination && data.pagination.next_uri && typeof data.pagination.next_uri === 'string' && data.pagination.next_uri.length) {
                await this._fetchPaginatedData(data.pagination.next_uri, globalData, retryCount, baseDelay);
            }

            return globalData;
        } catch (error) {
            // Ne pas retry pour les erreurs d'authentification ou de validation
            if (error instanceof AuthenticationError || error instanceof ValidationError) {
                throw error;
            }

            // Retry pour les erreurs réseau et autres erreurs temporaires
            if (retryCount > 0) {
                const delay = baseDelay * (4 - retryCount); // Backoff exponentiel
                console.warn(`[DataManager] Error fetching data from ${url}, retrying in ${delay}ms... (${retryCount} attempts left):`, error.message);
                await new Promise(resolve => setTimeout(resolve, delay));
                return this._fetchPaginatedData(url, globalData, retryCount - 1, baseDelay);
            }
            
            // Si c'est déjà une APIError, la relancer
            if (error instanceof APIError) {
                throw error;
            }
            
            // Sinon, créer une APIError générique
            console.error(`[DataManager] Error fetching data from ${url}:`, error);
            throw new APIError(
                `Failed to fetch data: ${error.message}`,
                null,
                fullUrl,
                { originalError: error.message }
            );
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
            throw new AuthenticationError(
                'Cannot refresh data: Authentication not completed. Please refresh the Bankin page.',
                { action: 'refreshData' }
            );
        }
        
        // Vider le cache (suppression explicite pour forcer un rechargement)
        const cacheKeys = [
            Config.getCacheKey('transactions'),
            Config.getCacheTimeKey('transactions'),
            Config.getCacheKey('categories'),
            Config.getCacheTimeKey('categories'),
            Config.getCacheKey('accounts'),
            Config.getCacheTimeKey('accounts')
        ];
        for (const key of cacheKeys) {
            await settingClass.removeSetting(key);
        }

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