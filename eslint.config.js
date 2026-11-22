// Configuration ESLint (flat config).
//
// Le code de l'extension n'utilise pas encore de modules : chaque fichier est un
// script classique et les classes sont partagées via le scope global, dans
// l'ordre défini par manifest.json / popup.html / report.html.
// On déclare donc ces classes comme globales connues. Cette liste disparaîtra
// avec la migration vers les modules ES (phase 3 du plan de modernisation).
import js from '@eslint/js';
import globals from 'globals';

/** Classes et instances partagées entre les scripts de l'extension. */
const projectGlobals = Object.fromEntries(
    [
        // core
        'Config',
        'Evt',
        'Settings',
        'DataManager',
        'DataManagerError',
        'AuthenticationError',
        'ValidationError',
        'APIError',
        'DataValidators',
        // models
        'Transaction',
        'Account',
        'Category',
        // services
        'DataMerger',
        'ReportStorage',
        // charts
        'BaseChartData',
        'BudgetChart',
        'LineBarChart',
        'SankeyChart',
        'ExpenseTypeChart',
        // report
        'ReportFilters',
        'ReportChartDataBuilder',
        'PdfExporter',
        // ui / utils
        'InjectedStyles',
        'LoadingScreen',
        'AmountHider',
        'ReviewPrompt',
        'ColorParser',
        // instances créées par injected.js / popup.js
        'evt',
        'settingClass',
        'dataManager',
        // librairies tierces chargées depuis libs/
        'Chart',
        'Choices',
        'html2pdf',
    ].map((name) => [name, 'readonly']),
);

export default [
    {
        ignores: ['libs/**', 'node_modules/**', 'dist/**', '.output/**', 'coverage/**'],
    },
    js.configs.recommended,
    {
        // Code de l'extension (scripts classiques, navigateur + API chrome.*)
        files: ['bg.js', 'injected.js', 'popup.js', 'report.js', 'js/**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
                ...globals.webextensions,
                ...projectGlobals,
            },
        },
        rules: {
            // Les déclarations de haut niveau sont volontairement globales (cf. ci-dessus)
            'no-unused-vars': ['warn', { vars: 'local', args: 'none', caughtErrors: 'none' }],
            'no-redeclare': ['error', { builtinGlobals: false }],
            // Règles signalées sans bloquer, à durcir au fil des phases
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
        // Outillage (Node, modules ES)
        files: ['*.config.js', 'scripts/**/*.{js,mjs}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: globals.node,
        },
    },
];
