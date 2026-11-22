import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { loadScripts } from '../helpers/load.js';

beforeAll(() => loadScripts(['js/core/Config.js', 'js/core/Logger.js', 'js/ui/StatusBanner.js']));

afterEach(() => {
    document.body.innerHTML = '';
    Config.DEBUG = false;
    localStorage.removeItem('pecunio_debug');
});

describe('StatusBanner', () => {
    const banner = () => document.getElementById(StatusBanner.ID);

    test('affiche un message d\'information (role status) ou d\'erreur (role alert)', () => {
        StatusBanner.show('chargement…');
        expect(banner().getAttribute('role')).toBe('status');
        expect(banner().textContent).toContain('Pecunio — chargement…');
        StatusBanner.show('erreur', { type: 'error' });
        expect(banner().getAttribute('role')).toBe('alert');
        expect(document.querySelectorAll(`#${StatusBanner.ID}`)).toHaveLength(1);
    });

    test('le message n\'est jamais interprété comme du HTML', () => {
        StatusBanner.show('<img src=x onerror=alert(1)>');
        expect(banner().querySelector('img')).toBeNull();
        expect(banner().textContent).toContain('<img src=x onerror=alert(1)>');
    });

    test('bouton d\'action', () => {
        const onAction = vi.fn();
        StatusBanner.show('erreur', { type: 'error', actionLabel: 'Recharger', onAction });
        const action = banner().querySelector('.pecunio-status-action');
        expect(action.textContent).toBe('Recharger');
        action.click();
        expect(onAction).toHaveBeenCalledTimes(1);
    });

    test('pas de bouton d\'action sans libellé ni fonction', () => {
        StatusBanner.show('info', { actionLabel: 'X' });
        expect(banner().querySelector('.pecunio-status-action')).toBeNull();
    });

    test('bouton de fermeture', () => {
        StatusBanner.show('info');
        banner().querySelector('.pecunio-status-close').click();
        expect(StatusBanner.isVisible()).toBe(false);
    });

    test('hide(clé) ne retire que le message correspondant', () => {
        StatusBanner.show('erreur', { key: 'data-error' });
        StatusBanner.hide('loading');
        expect(StatusBanner.isVisible('data-error')).toBe(true);
        expect(StatusBanner.isVisible('loading')).toBe(false);
        StatusBanner.hide('data-error');
        expect(StatusBanner.isVisible()).toBe(false);
    });

    test('type inconnu : style d\'information', () => {
        expect(StatusBanner.show('x', { type: 'autre' }).getAttribute('role')).toBe('status');
    });
});

describe('Logger', () => {
    test('debug silencieux par défaut', () => {
        Logger.debug('détail');
        expect(console.log).not.toHaveBeenCalled();
    });

    test('debug activé par Config.DEBUG ou localStorage', () => {
        Config.DEBUG = true;
        Logger.debug('a');
        Config.DEBUG = false;
        localStorage.setItem('pecunio_debug', '1');
        Logger.debug('b');
        expect(console.log).toHaveBeenCalledTimes(2);
        expect(console.log).toHaveBeenCalledWith('[Pecunio]', 'b');
    });

    test('localStorage inaccessible : debug désactivé', () => {
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('bloqué');
        });
        expect(Logger.isDebugEnabled()).toBe(false);
    });

    test('warn et error toujours affichés', () => {
        Logger.warn('w');
        Logger.error('e');
        expect(console.warn).toHaveBeenCalledWith('[Pecunio]', 'w');
        expect(console.error).toHaveBeenCalledWith('[Pecunio]', 'e');
    });
});
