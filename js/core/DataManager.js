import { Config } from './Config.js';
import { evt } from './events.js';

/**
 * Erreurs typées pour DataManager
 */
export class DataManagerError extends Error {
    constructor(message, code, details = {}) {
        super(message);
        this.name = 'DataManagerError';
        this.code = code;
        this.details = details;
    }
}

export class AuthenticationError extends DataManagerError {
    constructor(message, details = {}) {
        super(message, 'AUTH_ERROR', details);
        this.name = 'AuthenticationError';
    }
}

export class ValidationError extends DataManagerError {
    constructor(message, dataType, invalidData = null) {
        super(message, 'VALIDATION_ERROR', { dataType, invalidData });
        this.name = 'ValidationError';
        this.dataType = dataType;
        this.invalidData = invalidData;
    }
}

export class APIError extends DataManagerError {
    constructor(message, statusCode, url, details = {}) {
        super(message, 'API_ERROR', { statusCode, url, ...details });
        this.name = 'APIError';
        this.statusCode = statusCode;
        this.url = url;
        /** Erreur temporaire : une nouvelle tentative a des chances de réussir (5xx, 429). */
        this.retryable = false;
    }
}

/**
 * Validateurs de données pour DataManager
 */
export class DataValidators {
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
export class DataManager {
    static REQUIRED_HEADERS = Config.API.REQUIRED_HEADERS;
    static DOMAIN = Config.API.DOMAIN;
    static ENDPOINTS = Config.API.ENDPOINTS;
    static CACHE_DURATION = Config.API.CACHE_DURATION;

    /**
     * @param {{ cacheStore?: import('./CacheStore.js').CacheStore }} [deps] cache de l'API
     */
    constructor({ cacheStore } = {}) {
        this.cacheStore = cacheStore;
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

    /** Ferme la connexion au service worker (déconnexion de Bankin). */
    dispose() {
        try {
            this.port.disconnect();
        } catch {
            // port déjà fermé
        }
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
                    Object.hasOwn(message.data, header) && message.data[header]
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
        await this.cacheStore.waitForInitialization();

        if (this.cacheStore.isFresh(dataType, DataManager.CACHE_DURATION)) {
            try {
                const validatedCache = this._validateFetchedData(this.cacheStore.get(dataType), dataType);
                return validatedCache;
            } catch (error) {
                console.warn(`[DataManager] Cached ${dataType} data is invalid, fetching fresh data:`, error.message);
            }
        }

        const freshData = await this._fetchDataFromAPI(dataType);
        await this.cacheStore.set(dataType, freshData);
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
            validation.invalidItems.forEach(({ index, errors }) => {
                // Pas de contenu de la transaction : ce sont des données bancaires
                console.warn(`  [${dataType}][${index}] Errors: ${errors.join(', ')}`);
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
     * Récupère toutes les pages d'une ressource de l'API (pagination `next_uri`).
     * Les pages sont lues l'une après l'autre ; chaque page a ses propres nouvelles
     * tentatives, si bien qu'une erreur ne fait jamais relire une page déjà
     * ajoutée (bug B3).
     * @param {string} url - Chemin de la première page (ex. /v2/transactions?limit=500)
     * @param {Array} [globalData] - Tableau où accumuler les ressources
     * @param {number} [retryCount] - Nouvelles tentatives par page (erreurs réseau, 5xx, 429)
     * @param {number} [baseDelay] - Délai de base entre deux tentatives, en ms (linéaire)
     * @returns {Promise<Array>} Ressources de toutes les pages
     */
    async _fetchPaginatedData(url, globalData = [], retryCount = 3, baseDelay = 1000) {
        if (!this.authHeader) {
            throw new AuthenticationError(
                'Cannot fetch data: Authentication headers not available. Please wait for initialization to complete.'
            );
        }

        let nextUrl = url;
        while (nextUrl) {
            const page = await this._fetchPageWithRetry(nextUrl, retryCount, baseDelay);
            if (Array.isArray(page.resources)) {
                for (const resource of page.resources) globalData.push(resource);
            }
            const next = page.pagination && page.pagination.next_uri;
            nextUrl = typeof next === 'string' && next.length > 0 ? next : null;
        }
        return globalData;
    }

    /**
     * Récupère une page avec nouvelles tentatives sur les erreurs temporaires.
     * Pas de nouvelle tentative sur les erreurs d'authentification, de validation
     * ou les erreurs HTTP 4xx (hors 429).
     */
    async _fetchPageWithRetry(url, retryCount, baseDelay) {
        for (let attempt = 0; ; attempt++) {
            try {
                return await this._fetchPage(url);
            } catch (error) {
                const retryable = error instanceof APIError
                    ? error.retryable === true
                    : !(error instanceof DataManagerError);
                if (!retryable || attempt >= retryCount) {
                    if (error instanceof DataManagerError) throw error;
                    throw new APIError(
                        `Failed to fetch data: ${error.message}`,
                        null,
                        DataManager.DOMAIN + url,
                        { originalError: error.message }
                    );
                }
                const delay = baseDelay * (attempt + 1);
                console.warn(`[DataManager] ${error.message} (${url}), new attempt in ${delay}ms (${retryCount - attempt} left)`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /** Récupère et valide une seule page de l'API. */
    async _fetchPage(url) {
        const fullUrl = DataManager.DOMAIN + url;
        const response = await fetch(fullUrl, {
            method: 'GET',
            headers: this.authHeader,
            mode: 'cors',
            cache: 'default'
        });

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new AuthenticationError(
                    `Authentication error! status: ${response.status}. Please refresh Bankin page.`,
                    { statusCode: response.status, url: fullUrl }
                );
            }
            const error = new APIError(`HTTP error! status: ${response.status}`, response.status, fullUrl);
            error.retryable = response.status >= 500 || response.status === 429;
            throw error;
        }

        const data = await response.json();
        if (!data || typeof data !== 'object') {
            throw new ValidationError('Invalid response format: expected object', 'api_response', data);
        }
        if (!data.resources && !data.pagination) {
            throw new ValidationError('Invalid API response: missing both resources and pagination', 'api_response', data);
        }
        return data;
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
        
        await this.cacheStore.waitForInitialization();
        await this.cacheStore.clear();

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