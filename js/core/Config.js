/**
 * Config - Configuration centralisée de l'extension
 * Contient toutes les constantes et paramètres de configuration
 */
export class Config {
    /** Logs de debug (voir Logger) ; aussi activables avec localStorage `pecunio_debug = 1`. */
    static DEBUG = false;

    // Configuration de l'API Bankin
    static API = {
        DOMAIN: "https://sync.bankin.com",
        ENDPOINTS: {
            TRANSACTIONS: "/v2/transactions?limit=500",
            CATEGORIES: "/v2/categories?limit=200",
            ACCOUNTS: "/v2/accounts?limit=500"
        },
        REQUIRED_HEADERS: ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"],
        // Durée pendant laquelle le cache est utilisé sans rappeler l'API. Les graphiques
        // s'affichent de toute façon depuis le cache ; au-delà, les données sont
        // rechargées en arrière-plan (le bouton ↻ force un rechargement).
        CACHE_DURATION: 10 * 60 * 1000 // 10 minutes
    };

    // Catégories Bankin (identifiants de l'API, identiques pour tous les utilisateurs)
    static CATEGORIES = {
        EXCEPTION_IDS: [326, 282], // Catégories à exclure des calculs (virements internes, épargne)
        BUDGET_CATEGORY_ID: 2, // « Entrées d'argent » : alimente le Budget du diagramme de flux
        EXPENSES_CATEGORY_ID: 163 // identifiant du nœud « Dépenses » du diagramme de flux
    };

    // Configuration des paramètres de stockage
    static STORAGE_KEYS = /** @type {const} */ ({
        START_DATE: 'startDate',
        END_DATE: 'endDate',
        ACCOUNTS_SELECTED: 'accountsSelected',
        IS_BLURRY: 'isBlurry',
        CHART_TYPE: 'chartType',
        CACHE_PREFIX: 'cache_data_',
        CACHE_TIME_PREFIX: 'cache_time_'
    });

    /** Messages envoyés au service worker (chrome.runtime.sendMessage). */
    static RUNTIME_MESSAGES = /** @type {const} */ ({
        /** Page de connexion Bankin affichée : oublier les en-têtes d'authentification (D8). */
        SIGNED_OUT: 'pecunio_signed_out',
    });

    // Configuration du rapport PDF
    static REPORT = {
        STORAGE_KEYS: {
            MERGED: 'pecunio_report_mergedData',
            STATS: 'pecunio_report_stats',
            PARAMS: 'pecunio_report_params'
        },
        PDF: {
            DEFAULT_FILENAME_PREFIX: 'pecunio_rapport_',
            IMAGE_QUALITY: 1,
            JPEG_QUALITY: 1,
            FONT_READY_DELAY_MS: 400
        }
    };

    // Configuration des charts
    static CHART = {
        /** Hauteur fixe du graphique temporel (évite la boucle de redimensionnement, bug B23) */
        LINE_CHART_HEIGHT: '580px'
    };

    // Configuration des assets
    static ASSETS = {
        LOADING_GIF: "asset/Loading.gif",
        EYE_OPEN: "asset/eye.png",
        EYE_CLOSED: "asset/eyeClose.png",
        ICON: "asset/icon.png"
    };

    // Configuration des intervalles
    static INTERVALS = {
        URL_CHECK: 1000, // 1 seconde pour vérifier les changements d'URL
        HIDDER_DELAY: 150 // ms avant d'injecter le bouton masquer montants (DOM Bankin)
    };

    // Configuration du prompt de review
    static REVIEW = {
        DEBUG: false // true = affiche la modale de review à chaque chargement (ignorer compteur/état)
    };

    static getCacheKey(dataType) {
        return Config.STORAGE_KEYS.CACHE_PREFIX + dataType;
    }

    static getCacheTimeKey(dataType) {
        return Config.STORAGE_KEYS.CACHE_TIME_PREFIX + dataType;
    }

    static isExceptionCategory(categoryId) {
        return Config.CATEGORIES.EXCEPTION_IDS.includes(categoryId);
    }

    static getAssetURL(assetName) {
        return chrome.runtime.getURL(Config.ASSETS[assetName]);
    }

    /**
     * Indique si le mode masquage des montants (flou) est actif.
     * Centralise l'accès à l'état blur pour les charts et l'UI.
     * @returns {boolean}
     */
    static isBlurry() {
        return typeof window !== 'undefined' && !!window.__pecunioIsBlurry;
    }
}
