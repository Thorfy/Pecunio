// Masquage des montants (AmountHider), sur les captures anonymisées des vraies
// pages Bankin (test/fixtures/bankin-pages/).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { BANKIN_SELECTORS, BankinPage } from '../../js/bankin/BankinPage.js';
import { AmountHider } from '../../js/ui/AmountHider.js';
import { InjectedStyles } from '../../js/ui/InjectedStyles.js';

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

const isMasked = () => document.documentElement.classList.contains(AmountHider.ROOT_CLASS);
/** Éléments floutés par la règle CSS quand le masquage est actif. */
const blurTargets = () =>
    new Set(document.querySelectorAll(`${BANKIN_SELECTORS.HEADER_AMOUNT}, ${BANKIN_SELECTORS.AMOUNTS}`));
const icon = () => document.querySelector('#hideButton').src.split('/').pop();

afterEach(() => {
    document.body.innerHTML = '';
    document.head.innerHTML = '';
    document.documentElement.classList.remove(AmountHider.ROOT_CLASS);
    window.__pecunioIsBlurry = undefined;
});

describe('AmountHider — page Comptes', () => {
    test('bouton inséré après le libellé du solde, une seule fois, sans réécrire la préférence', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        const settings = fakeSettings();
        new AmountHider(settings);
        new AmountHider(settings);
        expect(settings.setSettings).not.toHaveBeenCalled();
        const buttons = document.querySelectorAll('#hideButton');
        expect(buttons).toHaveLength(1);
        expect(buttons[0].parentElement.matches('.dbl.fs1.elp')).toBe(true);
        expect(icon()).toBe('eye.png');
        expect(buttons[0].alt).toBe('Masquer les montants');
        expect(isMasked()).toBe(false);
    });

    test('clic : montants masqués, préférence enregistrée, graphiques prévenus ; second clic : affichés', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        const settings = fakeSettings();
        const changed = vi.fn();
        window.addEventListener('pecunio_amounts_visibility_changed', changed);
        new AmountHider(settings);

        document.querySelector('#hideButton').click();
        expect(isMasked()).toBe(true);
        expect(settings.values.isBlurry).toBe(true);
        expect(window.__pecunioIsBlurry).toBe(true);
        expect(changed.mock.calls.at(-1)[0].detail).toEqual({ isBlurry: true });
        expect(icon()).toBe('eyeClose.png');
        expect(document.querySelector('#hideButton').alt).toBe('Afficher les montants');
        // Solde et montants des comptes sont bien ciblés par la règle de flou
        const bankin = new BankinPage(document);
        const targets = blurTargets();
        expect(targets.has(bankin.headerAmount())).toBe(true);
        expect(bankin.amountElements().length).toBeGreaterThanOrEqual(3);

        document.querySelector('#hideButton').click();
        expect(isMasked()).toBe(false);
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
        expect(isMasked()).toBe(true);
        expect(icon()).toBe('eyeClose.png');
    });

    test('U1 — montants réécrits ou ajoutés par Bankin après coup : toujours masqués', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        new AmountHider(fakeSettings(true));
        // Bankin met à jour ses montants : attribut class réécrit, nouvelle ligne ajoutée
        const header = new BankinPage(document).headerAmount();
        header.className = 'dbl fs14 fw7 lh18 elp';
        const added = document.createElement('span');
        added.className = 'amountRed';
        document.body.appendChild(added);

        expect(isMasked()).toBe(true);
        const targets = blurTargets();
        expect(targets.has(header)).toBe(true);
        expect(targets.has(added)).toBe(true);
    });

    test('nouvelle construction : l\'état suit la préférence enregistrée', () => {
        loadPage('accounts', 'https://app2.bankin.com/accounts');
        const settings = fakeSettings(true);
        new AmountHider(settings);
        expect(isMasked()).toBe(true);
        settings.values.isBlurry = false; // changé depuis un autre onglet
        new AmountHider(settings);
        expect(isMasked()).toBe(false);
        expect(icon()).toBe('eye.png');
    });
});

describe('AmountHider — page Catégories', () => {
    test('sans solde en en-tête : bouton dans la légende du donut ; liste et total ciblés', () => {
        loadPage('categories', 'https://app2.bankin.com/categories');
        new AmountHider(fakeSettings());
        const button = document.querySelector('#hideButton');
        expect(button.parentElement.matches('.categoryChart .mt2.tac')).toBe(true);

        button.click();
        expect(isMasked()).toBe(true);
        const targets = blurTargets();
        expect(targets.has(document.querySelector('#contentList .dtc.vam.tar.w30 span'))).toBe(true);
        expect(targets.has(document.querySelector('.categoryChart .mt2.tac span.fs2.fw7'))).toBe(true);
    });
});

describe('Règle CSS du masquage', () => {
    test('floute le solde et les montants de Bankin quand la classe est sur <html>', () => {
        const css = InjectedStyles.getStyles();
        expect(css).toContain(`html.${AmountHider.ROOT_CLASS} :is(${BANKIN_SELECTORS.HEADER_AMOUNT}, ${BANKIN_SELECTORS.AMOUNTS})`);
        expect(css).toMatch(/filter: blur\(6px\) !important/);
    });
});
