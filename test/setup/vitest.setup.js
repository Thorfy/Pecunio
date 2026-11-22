// Préparation commune à tous les fichiers de test.
import { afterEach, beforeEach, vi } from 'vitest';
import { createFakeChrome } from '../helpers/fake-chrome.js';

// Un faux `chrome` neuf pour chaque test.
beforeEach(() => {
    globalThis.chrome = createFakeChrome();
});

// Le code de l'extension est très bavard dans la console. On le fait taire
// pendant les tests ; PECUNIO_TEST_LOGS=1 pour réafficher les logs.
if (!process.env.PECUNIO_TEST_LOGS) {
    beforeEach(() => {
        for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
            vi.spyOn(console, level).mockImplementation(() => {});
        }
    });
}

afterEach(() => {
    vi.useRealTimers();
});
