import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'happy-dom',
        include: ['test/**/*.test.js'],
        setupFiles: ['test/setup/vitest.setup.js'],
        restoreMocks: true,
        coverage: {
            provider: 'v8',
            include: ['js/**/*.js'],
            exclude: ['js/lib/**'],
            reporter: ['text', 'html', 'json-summary'],
            // Seuils sur la logique de calcul et de données.
            // Le rendu des graphiques et l'interface (js/ui, render/createUI des
            // graphiques) seront couverts par les tests d'intégration (phase 5).
            thresholds: {
                'js/models/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
                'js/services/**': { statements: 95, branches: 80, functions: 95, lines: 95 },
                'js/report/**': { statements: 90, branches: 75, functions: 90, lines: 90 },
                'js/core/**': { statements: 85, branches: 80, functions: 85, lines: 85 },
                'js/bankin/**': { statements: 95, branches: 90, functions: 95, lines: 95 },
                'js/charts/base/**': { statements: 85, branches: 80, functions: 90, lines: 85 },
            },
        },
    },
});
