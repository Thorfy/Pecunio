// Masquage des montants (AmountHider), sur les captures anonymisées des vraies
// pages Bankin (test/fixtures/bankin-pages/).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BankinPage } from '../../js/bankin/BankinPage.js';
import { AmountHider } from '../../js/ui/AmountHider.js';

const loadPage = (name, url) => {
    window.happyDOM.setURL(url);
    document.body.innerHTML = readFileSync(resolve('test/fixtures/bankin-pages', `${name}.html`), 'utf8');
};

/** Faux Settings : seul l'état du masquage est utilisé. */
const fakeSettings = (isBlurry = false) => {
    const values = { isBlurry };
    return {
        values,
        getSetting: (key) => values[key],
        setSettings: vi.fn((changes) => Object.assign(values, changes)),
    };
};

const blurred = () => document.querySelectorAll('.pecunio-blurred').length;

afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    window.__pecunioIsBlurry = undefined;
});

describe('AmountHider — page Comptes', () => {
    test('bouton inséré après le libellé du solde, une seule fois', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        const settings = fakeSettings();
        new AmountHider(settings);
        new AmountHider(settings);
        expect(settings.setSettings).not.toHaveBeenCalled();
        const buttons = document.querySelectorAll('#hideButton');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].parentElement.matches('.dbl.fs1.elp')).toBe(true);
        expect(buttons[0].src).toBe('chrome-extension://pecunio-test/asset/eye.png');
        expect(blurred()).toBe(0);
    });

    test('clic : solde et montants floutés, préférence enregistrée, graphiques prévenus ; second clic : retiré', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        const settings = fakeSettings();
        const changed = vi.fn();
        window.addEventListener('pecunio_amounts_visibility_changed', changed);
        new AmountHider(settings);

        document.querySelector('#hideButton').click();
        const bankin = new BankinPage(document);
        expect(bankin.headerAmount().classList.contains('pecunio-blurred')).toBe(true);
        expect(bankin.amountElements().every((el) => el.classList.contains('pecunio-blurred'))).toBe(true);
        expect(settings.values.isBlurry).toBe(true);
        expect(window.__pecunioIsBlurry).toBe(true);
        expect(changed.mock.calls.at(-1)[0].detail).toEqual({ isBlurry: true });
        expect(document.querySelector('#hideButton').src).toContain('eyeClose.png');

        document.querySelector('#hideButton').click();
        expect(blurred()).toBe(0);
        expect(settings.values.isBlurry).toBe(false);
        expect(window.__pecunioIsBlurry).toBe(false);
        expect(changed.mock.calls.at(-1)[0].detail).toEqual({ isBlurry: false });
        window.removeEventListener('pecunio_amounts_visibility_changed', changed);
    });

    test('masquage déjà choisi : appliqué dès l\'insertion du bouton, sans réécrire la préférence', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        const settings = fakeSettings(true);
        new AmountHider(settings);
        expect(settings.setSettings).not.toHaveBeenCalled();
        expect(new BankinPage(document).headerAmount().classList.contains('pecunio-blurred')).toBe(true);
        expect(document.querySelector('#hideButton').src).toContain('eyeClose.png');
    });
});

describe('AmountHider — page Catégories', () => {
    test('sans solde en en-tête : bouton dans la légende du donut, liste et total floutés', () => {
        loadPage('categories', 'https://app2.bankin.com/categories');
        new AmountHider(fakeSettings());
        const button = document.querySelector('#hideButton');
        expect(button.parentElement.matches('.categoryChart .mt2.tac')).toBe(true);

        button.click();
        expect(document.querySelector('#contentList .dtc.vam.tar.w30 span').classList.contains('pecunio-blurred')).toBe(true);
        expect(document.querySelector('.categoryChart .mt2.tac span.fs2.fw7').classList.contains('pecunio-blurred')).toBe(true);
    });
});

describe('AmountHider.refreshBlur', () => {
    test('montants ajoutés après coup (navigation, graphiques) floutés si le masquage est actif', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        new AmountHider(fakeSettings(true));
        const added = document.createElement('span');
        added.className = 'amountRed';
        document.body.appendChild(added);

        AmountHider.refreshBlur(fakeSettings(true));
        expect(added.classList.contains('pecunio-blurred')).toBe(true);
    });

    test('masquage inactif : rien n\'est flouté', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        AmountHider.refreshBlur(fakeSettings(false));
        expect(blurred()).toBe(0);
    });
});
