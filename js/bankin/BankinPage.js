/**
 * BankinPage - Adaptateur de l'interface web de Bankin (app2.bankin.com)
 *
 * Tout ce que Pecunio sait de la page Bankin est ici : chemins des pages,
 * sélecteurs CSS et lecture des éléments (mois affiché, blocs où insérer les
 * graphiques, montants à flouter). Le reste du code passe par cet adaptateur.
 *
 * Bankin utilise des classes utilitaires (`.dbl.fs14.fw7…`) qui peuvent changer
 * à chaque mise à jour de son site. Les tests de contrat
 * (test/contract/bankin-page.test.js) vérifient l'adaptateur sur des captures
 * anonymisées des vraies pages ; voir docs/TESTING.md pour les mettre à jour.
 */

export const BANKIN_PAGE = Object.freeze({
    ACCOUNTS: 'accounts',
    CATEGORIES: 'categories',
    CATEGORY_DETAIL: 'category-detail',
    SIGNIN: 'signin',
    OTHER: 'other',
});

/** Sélecteurs CSS des éléments de Bankin utilisés par Pecunio. */
export const BANKIN_SELECTORS = Object.freeze({
    /** Page Comptes : bloc central, remplacé par les graphiques Pecunio. */
    ACCOUNTS_BLOCK: '.homeBlock',
    /** Page Comptes : colonne de droite (indicateur de chargement). */
    RIGHT_COLUMN: '.rightColumn',
    /** Bouton ↻ (rafraîchir les comptes). */
    REFRESH_BUTTON: '.refreshIcon',
    /** Page Catégories : sélecteur de mois et mois affiché (« Septembre 2026 »). */
    MONTH_SELECTOR: '#monthSelector',
    ACTIVE_MONTH: '#monthSelector .active .dib',
    /** Page Catégories : bloc du donut, à côté duquel sont insérés les graphiques. */
    CATEGORY_CHART: '.categoryChart',
    /**
     * Page Catégories : panneaux du bloc donut, en hauteur 100 % ; Pecunio
     * retire cette hauteur pour laisser la place à ses graphiques.
     */
    CATEGORY_CHART_PANELS: '.cntr.dtb.h100.active, .cntr.dtb.h100.notActive',
    /** En-tête : solde total et son libellé (le bouton de masquage est inséré après le libellé). */
    HEADER_AMOUNT: '.dbl.fs14.fw7.lh18.elp',
    HEADER_TEXT: '.dbl.fs1.elp',
    /**
     * Page Catégories : légende du donut (emplacement du bouton de masquage
     * sans en-tête). Le donut reste dans `.categoryChart` quand Pecunio le
     * déplace dans son bloc « Catégories ».
     */
    CATEGORY_LEGEND: '.categoryChart .mt2.tac',
    /**
     * Montants à flouter : listes de comptes et de catégories, total et
     * étiquettes du donut.
     */
    AMOUNTS: [
        '.amountGreen,.amountRed,.amountBlack',
        '#contentList .dtc.vam.tar.w30 span',
        '.categoryChart .mt2.tac span.fs2.fw7',
        '.categoryChart #donutChart text',
    ].join(','),
});

/**
 * Éléments dont Pecunio a besoin sur chaque page : si l'un d'eux disparaît,
 * Bankin a changé son interface et l'adaptateur doit être mis à jour.
 */
export const REQUIRED_ELEMENTS = Object.freeze({
    [BANKIN_PAGE.ACCOUNTS]: ['ACCOUNTS_BLOCK', 'RIGHT_COLUMN', 'REFRESH_BUTTON', 'HEADER_AMOUNT', 'HEADER_TEXT', 'AMOUNTS'],
    [BANKIN_PAGE.CATEGORIES]: ['MONTH_SELECTOR', 'ACTIVE_MONTH', 'CATEGORY_CHART', 'CATEGORY_CHART_PANELS', 'CATEGORY_LEGEND', 'AMOUNTS'],
});

export class BankinPage {
    static PAGE = BANKIN_PAGE;
    static SELECTORS = BANKIN_SELECTORS;

    /**
     * Type de page Bankin, d'après le chemin de l'URL.
     * @param {string} href
     * @returns {string} une valeur de BankinPage.PAGE
     */
    static detectPage(href) {
        let path;
        try {
            path = new URL(href).pathname.replace(/\/+$/, '') || '/';
        } catch {
            return BANKIN_PAGE.OTHER;
        }
        if (path === '/accounts') return BANKIN_PAGE.ACCOUNTS;
        if (path === '/categories') return BANKIN_PAGE.CATEGORIES;
        if (path.startsWith('/categories/')) return BANKIN_PAGE.CATEGORY_DETAIL;
        if (path === '/signin' || path.startsWith('/signin/')) return BANKIN_PAGE.SIGNIN;
        return BANKIN_PAGE.OTHER;
    }

    /** Pages où Pecunio affiche des graphiques (détail d'une catégorie : historique, lot UX-3a). */
    static hasCharts(page) {
        return page === BANKIN_PAGE.ACCOUNTS || page === BANKIN_PAGE.CATEGORIES || page === BANKIN_PAGE.CATEGORY_DETAIL;
    }

    /**
     * Identifiant de la catégorie d'une page de détail : « /categories/161 » → 161
     * (« /categories/2 » : onglet Revenus, catégorie « Entrées d'argent »).
     * @param {string} href
     * @returns {number | null}
     */
    static categoryIdFromUrl(href) {
        try {
            const match = /^\/categories\/(\d+)\/?$/.exec(new URL(href).pathname);
            return match ? Number(match[1]) : null;
        } catch {
            return null;
        }
    }

    /** Pages Catégories (dépenses, revenus, détail d'une catégorie). */
    static isCategoriesPage(page) {
        return page === BANKIN_PAGE.CATEGORIES || page === BANKIN_PAGE.CATEGORY_DETAIL;
    }

    /**
     * Mois affiché par Bankin : « Septembre 2026 » → ['septembre', '2026'].
     * @param {string | null | undefined} label
     * @returns {string[] | null}
     */
    static parseMonthLabel(label) {
        const parts = (label || '').trim().toLocaleLowerCase().split(/\s+/);
        if (parts.length !== 2 || !/^\d{4}$/.test(parts[1])) return null;
        return parts;
    }

    /** @param {Document} [doc] */
    constructor(doc = document) {
        this.doc = doc;
    }

    /** @param {keyof typeof BANKIN_SELECTORS} name */
    _find(name) {
        return /** @type {HTMLElement | null} */ (this.doc.querySelector(BANKIN_SELECTORS[name]));
    }

    accountsBlock() {
        return this._find('ACCOUNTS_BLOCK');
    }

    /** Emplacement de l'indicateur de chargement (1er bloc de la colonne de droite). */
    loadingSlot() {
        return /** @type {HTMLElement | null} */ (this._find('RIGHT_COLUMN')?.firstElementChild ?? null);
    }

    refreshButton() {
        return this._find('REFRESH_BUTTON');
    }

    monthSelector() {
        return this._find('MONTH_SELECTOR');
    }

    /** Libellé du mois affiché (« Septembre 2026 »), ou null. */
    activeMonthLabel() {
        return this._find('ACTIVE_MONTH')?.textContent?.trim() || null;
    }

    /** Mois affiché, découpé : ['septembre', '2026'], ou null. */
    activeMonth() {
        return BankinPage.parseMonthLabel(this.activeMonthLabel());
    }

    categoryChart() {
        return this._find('CATEGORY_CHART');
    }

    /** @returns {HTMLElement[]} */
    categoryChartPanels() {
        return Array.from(this.doc.querySelectorAll(BANKIN_SELECTORS.CATEGORY_CHART_PANELS));
    }

    headerAmount() {
        return this._find('HEADER_AMOUNT');
    }

    /**
     * Où insérer le bouton de masquage des montants : après le libellé de
     * l'en-tête, ou dans la légende du donut sur les pages Catégories.
     * @param {string} page une valeur de BankinPage.PAGE
     */
    hideButtonContainer(page) {
        return this._find('HEADER_TEXT') || (BankinPage.isCategoriesPage(page) ? this._find('CATEGORY_LEGEND') : null);
    }

    /** @returns {HTMLElement[]} montants à flouter */
    amountElements() {
        return Array.from(this.doc.querySelectorAll(BANKIN_SELECTORS.AMOUNTS));
    }

    /**
     * Éléments attendus sur la page et absents (vide si tout est là).
     * @param {string} page une valeur de BankinPage.PAGE
     * @returns {string[]} noms de BANKIN_SELECTORS
     */
    missingElements(page) {
        return (REQUIRED_ELEMENTS[page] || []).filter((name) => !this.doc.querySelector(BANKIN_SELECTORS[name]));
    }
}
