import { defineConfig } from 'vitest/config';

export default defineConfig({
    // Chart.js 3 et ses plugins n'ont pas de champ « exports » : sans cela, Node
    // charge la version UMD de chart.js et le plugin Sankey la version ESM
    // (deux instances incompatibles). On résout comme Vite le fait pour le build.
    resolve: {
        mainFields: ['module', 'main'],
    },
    test: {
        server: {
            deps: {
                inline: ['chart.js', 'chartjs-chart-sankey', 'chartjs-adapter-date-fns'],
            },
        },
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
                'js/charts/base/**': { statements: 85, branches: 80, functions: 90, lines: 85 },
            },
        },
    },
});
