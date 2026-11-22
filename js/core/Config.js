/**
 * Config - Configuration centralisée de l'extension
 * Contient toutes les constantes et paramètres de configuration
 */
export class Config {
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

    // Configuration des catégories
    static CATEGORIES = {
        EXCEPTION_IDS: [326, 282], // Catégories à exclure des calculs (virements internes, épargne)
        BUDGET_CATEGORY_ID: 2, // « Entrées d'argent » : alimente le Budget du diagramme de flux
        EXPENSES_CATEGORY_ID: 163 // identifiant du nœud « Dépenses » du diagramme de flux
    };

    // Configuration des URLs
    static URLS = {
        CATEGORIES_PAGE: "https://app2.bankin.com/categories"
    };

    // Configuration des sélecteurs CSS
    static SELECTORS = {
        HOME_BLOCK: ".homeBlock",
        REFRESH_ICON: ".refreshIcon",
        MONTH_SELECTOR: "#monthSelector",
        MONTH_SELECTOR_ACTIVE: "#monthSelector .active .dib",
        CATEGORY_CHART: ".categoryChart",
        HIDE_BUTTON: "#hideButton",
        /** Sélecteurs complets pour le flou (liste, header, légendes donut) */
        BLURRY_SELECTORS: [
            ".amountGreen,.amountRed,.amountBlack",
            "#contentList .dtc.vam.tar.w30 span",
            ".pecunio-donut-wrapper .mt2.tac span.fs2.fw7",
            ".pecunio-donut-wrapper #donutChart text"
        ].join(","),
        HEADER_AMOUNT: ".dbl.fs14.fw7.lh18.elp",
        HEADER_TEXT: ".dbl.fs1.elp",
        BUTTON_CONTAINER: ".dbl.fs1.elp",
        CATEGORY_PAGE_BUTTON_CONTAINER: ".pecunio-donut-wrapper .mt2.tac, .scrollable.categoryChart .mt2.tac"
    };

    // Configuration des paramètres de stockage
    static STORAGE_KEYS = {
        START_DATE: 'startDate',
        END_DATE: 'endDate',
        ACCOUNTS: 'accounts',
        ACCOUNTS_SELECTED: 'accountsSelected',
        IS_BLURRY: 'isBlurry',
        CHART_TYPE: 'chartType',
        CACHE_PREFIX: 'cache_data_',
        CACHE_TIME_PREFIX: 'cache_time_'
    };

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
