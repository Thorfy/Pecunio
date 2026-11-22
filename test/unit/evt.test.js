import { describe, expect, test, vi } from 'vitest';
import { Evt } from '../../js/core/Evt.js';
import { evt as sharedEvt } from '../../js/core/events.js';

describe('Evt', () => {
    test('dispatch appelle les écouteurs avec les données, dans l\'ordre', () => {
        const evt = new Evt();
        const calls = [];
        evt.listen('ping', (data) => calls.push(['a', data]));
        evt.listen('ping', (data) => calls.push(['b', data]));
        evt.dispatch('ping', { n: 1 });
        expect(calls).toEqual([['a', { n: 1 }], ['b', { n: 1 }]]);
        expect(evt.listenerCount('ping')).toBe(2);
    });

    test('événement sans écouteur : rien ne se passe', () => {
        expect(() => new Evt().dispatch('personne')).not.toThrow();
    });

    test('écouteur « once »', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('ping', listener, { once: true });
        evt.dispatch('ping');
        evt.dispatch('ping');
        expect(listener).toHaveBeenCalledTimes(1);
        expect(evt.listenerCount('ping')).toBe(0);
    });

    test('la fonction renvoyée par listen retire l\'écouteur', () => {
        const evt = new Evt();
        const listener = vi.fn();
        const stop = evt.listen('ping', listener);
        stop();
        evt.dispatch('ping');
        expect(listener).not.toHaveBeenCalled();
    });

    test('une erreur dans un écouteur n\'empêche pas les suivants', () => {
        const evt = new Evt();
        const next = vi.fn();
        evt.listen('ping', () => {
            throw new Error('boum');
        });
        evt.listen('ping', next);
        expect(() => evt.dispatch('ping')).not.toThrow();
        expect(next).toHaveBeenCalled();
        expect(console.error).toHaveBeenCalled();
    });

    test('paramètres invalides ignorés', () => {
        const evt = new Evt();
        const stop = evt.listen('', () => {});
        evt.listen('ping', 'pas une fonction');
        evt.dispatch('');
        expect(typeof stop).toBe('function');
        expect(evt.listenerCount('ping')).toBe(0);
    });

    test('cleanup retire tous les écouteurs', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('a', listener);
        evt.cleanup();
        evt.dispatch('a');
        expect(listener).not.toHaveBeenCalled();
    });

    test('instance partagée par les modules d\'une même page', () => {
        expect(sharedEvt).toBeInstanceOf(Evt);
    });

    // --- B15 ------------------------------------------------------------
    test('B15 — un événement déjà émis n\'est pas rejoué aux nouveaux écouteurs', () => {
        const evt = new Evt();
        evt.dispatch('data_loaded');
        const listener = vi.fn();
        evt.listen('data_loaded', listener);
        expect(listener).not.toHaveBeenCalled();
    });

    test('B15 — removeListener arrête vraiment les notifications', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('ping', listener);
        evt.removeListener('ping', listener);
        evt.removeListener('inconnu', listener);
        evt.dispatch('ping');
        expect(listener).not.toHaveBeenCalled();
    });

    test('B15 — la page web ne peut pas déclencher les événements internes', () => {
        const evt = new Evt();
        const listener = vi.fn();
        evt.listen('data_loaded', listener);
        // Un script de la page Bankin partage le même `document`.
        document.dispatchEvent(new CustomEvent('Event_data_loaded'));
        document.dispatchEvent(new CustomEvent('data_loaded'));
        expect(listener).not.toHaveBeenCalled();
    });
});
