// Configuration ESLint (flat config).
//
// Le code de l'extension est en modules ES : chaque dépendance est importée
// explicitement, `no-undef` signale tout identifiant non importé.
import js from '@eslint/js';
import globals from 'globals';

/**
 * Classes de l'extension encore exposées en global aux tests
 * (test/helpers/load.js) ; les tests pourront importer explicitement à terme.
 */
const testGlobals = Object.fromEntries(
    [
        'Config', 'Logger', 'PageController', 'DateRange', 'TransactionFilter', 'CacheStore', 'Evt', 'Settings',
        'DataManager', 'DataManagerError', 'AuthenticationError', 'ValidationError', 'APIError', 'DataValidators',
        'Transaction', 'Account', 'Category', 'DataMerger', 'ReportStorage',
        'BaseChartData', 'BudgetChart', 'LineBarChart', 'SankeyChart', 'ExpenseTypeChart',
        'ReportFilters', 'ReportChartDataBuilder', 'PdfExporter',
        'InjectedStyles', 'LoadingScreen', 'AmountHider', 'ReviewPrompt', 'StatusBanner', 'ColorParser',
        'evt', 'settingClass',
    ].map((name) => [name, 'readonly']),
);

export default [
    {
        ignores: ['libs/**', 'public/**', 'node_modules/**', 'dist/**', '.output/**', '.wxt/**', 'coverage/**'],
    },
    js.configs.recommended,
    {
        // Code de l'extension (modules ES, navigateur + API chrome.*)
        files: ['js/**/*.js', 'entrypoints/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
            },
        },
        rules: {
            'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none' }],
            // Règles signalées sans bloquer, à durcir en phase 3c
            'no-prototype-builtins': 'warn',
            'no-empty': 'warn',
            'no-useless-escape': 'warn',
            'no-case-declarations': 'warn',
            'no-async-promise-executor': 'warn',
            eqeqeq: ['warn', 'smart'],
            'prefer-const': 'warn',
            'no-var': 'warn',
        },
    },
    {
        // Tests (Vitest, modules ES)
        files: ['test/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.webextensions,
                ...testGlobals,
            },
        },
    },
    {
        // Outillage (Node, modules ES)
        files: ['*.config.js', 'scripts/**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
    },
];
