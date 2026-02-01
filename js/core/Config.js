/**
 * Config - Configuration centralisée de l'extension
 * Contient toutes les constantes et paramètres de configuration
 */
class Config {
    // Configuration de l'API Bankin
    static API = {
        DOMAIN: "https://sync.bankin.com",
        ENDPOINTS: {
            TRANSACTIONS: "/v2/transactions?limit=500",
            CATEGORIES: "/v2/categories?limit=200",
            ACCOUNTS: "/v2/accounts?limit=500"
        },
        REQUIRED_HEADERS: ["Authorization", "Bankin-Version", "Client-Id", "Client-Secret"],
        CACHE_DURATION: 2 * 60 * 1000 // 2 minutes en millisecondes
    };

    // Configuration des catégories
    static CATEGORIES = {
        EXCEPTION_IDS: [326, 282], // Catégories à exclure des calculs
        BUDGET_CATEGORY_ID: 2, // ID de la catégorie budget
        EXPENSES_CATEGORY_ID: 163 // ID de la catégorie dépenses
    };

    // Configuration des URLs
    static URLS = {
        BANKIN_APP: "https://app2.bankin.com",
        ACCOUNTS_PAGE: "https://app2.bankin.com/accounts",
        CATEGORIES_PAGE: "https://app2.bankin.com/categories",
        SIGNIN_PAGE: "https://app2.bankin.com/signin"
    };

    // Configuration des sélecteurs CSS
    static SELECTORS = {
        HOME_BLOCK: ".homeBlock",
        RIGHT_COLUMN: ".rightColumn",
        REFRESH_ICON: ".refreshIcon",
        MONTH_SELECTOR: "#monthSelector",
        MONTH_SELECTOR_ACTIVE: "#monthSelector .active .dib",
        CATEGORY_CHART: ".categoryChart",
        CANVAS_DIV: ".canvasDiv",
        HIDE_BUTTON: "#hideButton",
        BLURRY_ELEMENTS: ".amountGreen,.amountRed,.amountBlack",
        HEADER_AMOUNT: ".dbl.fs14.fw7.lh18.elp",
        HEADER_TEXT: ".dbl.fs1.elp"
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

    // Configuration des charts
    static CHART = {
        DEFAULT_HEIGHT: '600px',
        BUDGET_CHART_HEIGHT: '400px',
        DEFAULT_TYPE: 'bar',
        ANNOTATION: {
            type: 'line',
            borderColor: 'black',
            borderDash: [6, 6],
            borderDashOffset: 0,
            borderWidth: 3,
            label: {
                enabled: true,
                content: (ctx) => 'Average: ' + Config.CHART.calculateAverage(ctx).toFixed(2),
                position: 'end'
            },
            scaleID: 'y',
            value: (ctx) => Config.CHART.calculateAverage(ctx)
        },
        COLORS: {
            PRIMARY: 'rgba(54, 162, 235, 0.6)',
            SECONDARY: 'rgba(255, 99, 132, 0.6)',
            GRID: "#e9f5f9",
            BORDER: "#d3eaf2",
            TICK: "#e9f5f9"
        }
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
        HIDDER_DELAY: 500 // 500ms pour l'initialisation du Hidder
    };

    // Configuration des mois
    static MONTHS = {
        NAMES: ["All Months", "January", "February", "March", "April", "May", "June", 
                "July", "August", "September", "October", "November", "December"],
        SHORT_NAMES: ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", 
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    };

    // Méthodes utilitaires
    static calculateAverage(ctx) {
        const values = ctx.chart.data.datasets[0].data;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    static getMonthName(monthNumber) {
        return Config.MONTHS.SHORT_NAMES[monthNumber] || '';
    }

    static getFullMonthName(monthNumber) {
        return Config.MONTHS.NAMES[monthNumber] || '';
    }

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
     * Méthode utilitaire pour formater une date pour les inputs HTML
     */
    static toDateInputValue(date) {
        if (!date) {
            return new Date().toISOString().split('T')[0];
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) {
            return new Date().toISOString().split('T')[0];
        }
        return d.toISOString().split('T')[0];
    }
} 