// Tests de bout en bout (Playwright) : l'extension construite (.output/chrome-mv3)
// est chargée dans Chromium, face à un Bankin simulé (e2e/bankin-simulator.js).
// Lancer avec `npm run test:e2e` (construit l'extension avant).
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: 'e2e',
    // Un seul navigateur à la fois : chaque test lance son propre Chromium avec l'extension
    workers: 1,
    timeout: 30_000,
    expect: { timeout: 10_000 },
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
});
