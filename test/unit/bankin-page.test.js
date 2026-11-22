// Adaptateur BankinPage : cas limites (les vraies pages sont dans test/contract/).
import { afterEach, describe, expect, test } from 'vitest';
import { BankinPage } from '../../js/bankin/BankinPage.js';

afterEach(() => {
    document.body.innerHTML = '';
});

describe('BankinPage', () => {
    test.each([
        ['Septembre 2026', ['septembre', '2026']],
        ['  Décembre   2025 ', ['décembre', '2025']],
        ['Août 2024', ['août', '2024']],
        ['Ce mois-ci', null],
        ['Septembre', null],
        ['', null],
        [null, null],
    ])('mois affiché « %s » → %j', (label, expected) => {
        expect(BankinPage.parseMonthLabel(label)).toEqual(expected);
    });

    test('pages Catégories : vue principale et détail', () => {
        expect(BankinPage.isCategoriesPage(BankinPage.PAGE.CATEGORIES)).toBe(true);
        expect(BankinPage.isCategoriesPage(BankinPage.PAGE.CATEGORY_DETAIL)).toBe(true);
        expect(BankinPage.isCategoriesPage(BankinPage.PAGE.ACCOUNTS)).toBe(false);
    });

    test('page vide : rien trouvé, sans erreur', () => {
        const bankin = new BankinPage(document);
        expect(bankin.accountsBlock()).toBeNull();
        expect(bankin.loadingSlot()).toBeNull();
        expect(bankin.activeMonthLabel()).toBeNull();
        expect(bankin.activeMonth()).toBeNull();
        expect(bankin.categoryChartPanels()).toEqual([]);
        expect(bankin.amountElements()).toEqual([]);
        expect(bankin.hideButtonContainer(BankinPage.PAGE.CATEGORIES)).toBeNull();
    });

    test('bouton de masquage : légende du donut seulement sur les pages Catégories', () => {
        document.body.innerHTML = '<div class="categoryChart"><div class="mt2 tac"></div></div>';
        const bankin = new BankinPage(document);
        expect(bankin.hideButtonContainer(BankinPage.PAGE.CATEGORY_DETAIL)).not.toBeNull();
        expect(bankin.hideButtonContainer(BankinPage.PAGE.ACCOUNTS)).toBeNull();
    });

    test('éléments manquants : listés par nom ; aucun attendu sur les autres pages', () => {
        document.body.innerHTML = '<div class="homeBlock"></div>';
        const bankin = new BankinPage(document);
        expect(bankin.missingElements(BankinPage.PAGE.ACCOUNTS)).toEqual([
            'RIGHT_COLUMN',
            'REFRESH_BUTTON',
            'HEADER_AMOUNT',
            'HEADER_TEXT',
            'AMOUNTS',
        ]);
        expect(bankin.missingElements(BankinPage.PAGE.SIGNIN)).toEqual([]);
    });
});
