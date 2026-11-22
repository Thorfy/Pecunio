// Démarrage du content script (js/content/main.js).
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts);

describe('startPecunio', () => {
    test('B11 / B12 — hors page Bankin à graphiques : ni popup forcée, ni connexion, ni erreur', async () => {
        vi.useFakeTimers();
        const { startPecunio } = await import('/js/content/main.js');
        const controller = startPecunio();

        expect(controller).toBeInstanceOf(PageController);
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        expect(chrome.runtime.connect).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(15_000); // au-delà du délai d'authentification
        expect(console.error).not.toHaveBeenCalled();
        controller.stop();
    });
});
