// Point d'entrée du content script (injected.js).
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { loadContentScripts } from '../helpers/load.js';

beforeAll(loadContentScripts);

describe('injected.js', () => {
    test('B11 / B12 — hors page Bankin à graphiques : ni popup forcée, ni connexion, ni erreur', async () => {
        vi.useFakeTimers();
        const start = vi.spyOn(PageController.prototype, 'start');
        await import('/injected.js');

        expect(start).toHaveBeenCalledTimes(1);
        expect(chrome.runtime.sendMessage).not.toHaveBeenCalled();
        expect(chrome.runtime.connect).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(15_000); // au-delà du délai d'authentification
        expect(console.error).not.toHaveBeenCalled();
        start.mock.instances[0].stop();
    });
});
