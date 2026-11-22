// Configuration ESLint (flat config).
//
// Le code de l'extension est en modules ES : chaque dépendance est importée
// explicitement, `no-undef` signale tout identifiant non importé.
import js from '@eslint/js';
import globals from 'globals';

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
            'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
            eqeqeq: ['error', 'smart'],
            'prefer-const': 'error',
            'no-var': 'error',
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
