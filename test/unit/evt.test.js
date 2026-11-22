import { beforeAll, describe, expect, test, vi } from 'vitest';
import { knownBug } from '../helpers/known-bug.js';
import { loadScripts } from '../helpers/load.js';

beforeAll(() => loadScripts(['js/core/Evt.js']));

describe('Evt', () => {
    test('dispatch appelle les écouteurs avec les données', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('ping', listener);
        evt.dispatch('ping', false, { n: 1 });
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].detail).toEqual({ n: 1 });
        expect(evt.hasListeners('ping')).toBe(true);
        expect(evt.getListenerCount('ping')).toBe(1);
    });

    test('écouteur « once »', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('ping', listener, true);
        evt.dispatch('ping');
        evt.dispatch('ping');
        expect(listener).toHaveBeenCalledTimes(1);
    });

    test('une erreur dans un écouteur n\'interrompt pas le dispatch', () => {
        const evt = new Evt();
        evt.listen('ping', () => {
            throw new Error('boum');
        });
        expect(() => evt.dispatch('ping')).not.toThrow();
        expect(console.error).toHaveBeenCalled();
    });

    test('paramètres invalides ignorés', () => {
        const evt = new Evt();
        evt.listen('', () => {});
        evt.listen('ping', 'pas une fonction');
        evt.dispatch('');
        expect(evt.getStats()).toEqual({ totalEvents: 0, totalListeners: 0, eventsWithListeners: 0 });
    });

    test('statistiques, debug et nettoyage', () => {
        const evt = new Evt();
        evt.enableDebug();
        evt.listen('a', () => {});
        evt.dispatch('a');
        expect(evt.getStats()).toEqual({ totalEvents: 1, totalListeners: 1, eventsWithListeners: 1 });
        evt.disableDebug();
        evt.removeAllListeners('a');
        expect(evt.hasListeners('a')).toBe(false);
        evt.cleanup();
        expect(evt.getStats().totalEvents).toBe(0);
    });

    // --- B15 ------------------------------------------------------------
    test('B15 — comportement actuel : un événement déjà émis rappelle immédiatement tout nouvel écouteur', () => {
        const evt = new Evt();
        evt.dispatch('url_change');
        const listener = vi.fn();
        evt.listen('url_change', listener);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    knownBug('B15 — attendu : removeListener arrête vraiment les notifications', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('ping', listener);
        evt.removeListener('ping', listener);
        evt.dispatch('ping');
        expect(listener).not.toHaveBeenCalled();
    });

    knownBug('B15 — attendu : la page web ne peut pas déclencher les événements internes', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('data_loaded', listener);
        // Un script de la page Bankin partage le même `document`.
        document.dispatchEvent(new CustomEvent('Event_data_loaded'));
        expect(listener).not.toHaveBeenCalled();
    });
});
