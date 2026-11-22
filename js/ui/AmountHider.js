import { BankinPage } from '../bankin/BankinPage.js';
import { Config } from '../core/Config.js';
import { InjectedStyles } from './InjectedStyles.js';

/**
 * AmountHider - Bouton « œil » qui masque (floute) les montants de Bankin et
 * des graphiques Pecunio.
 *
 * Le masquage repose sur une classe posée sur `<html>` et une règle CSS
 * (InjectedStyles) qui floute tous les montants ciblés par l'adaptateur
 * BankinPage. Bankin réécrit l'attribut `class` de ses montants quand il les
 * met à jour (au chargement de la page) : une classe posée élément par
 * élément était perdue, d'où des montants en clair avec l'icône « masqué »
 * (U1, docs/AUDIT-UX.md). La classe de `<html>`, elle, n'est jamais touchée
 * et s'applique aussi aux montants affichés plus tard.
 */
export class AmountHider {
    /** Classe posée sur `<html>` quand les montants sont masqués (règle CSS dans InjectedStyles). */
    static ROOT_CLASS = InjectedStyles.AMOUNTS_HIDDEN_CLASS;

    /**
     * @param {import('../core/Settings.js').Settings} settings préférences (état du masquage)
     * @param {BankinPage} [bankin]
     */
    constructor(settings, bankin = new BankinPage(document)) {
        this.settings = settings;
        this.bankin = bankin;
        this.insertButton();
    }

    /** Insère le bouton (une seule fois) puis applique l'état enregistré. */
    insertButton() {
        InjectedStyles.inject();
        if (!document.getElementById('hideButton')) {
            const button = document.createElement('img');
            button.id = 'hideButton';
            button.classList.add('pecunio-hide-button');
            button.alt = 'Masquer les montants';
            button.addEventListener('click', () => (this.isBlurry() ? this.disableBlurry() : this.enableBlurry()));
            const container = this.bankin.hideButtonContainer(BankinPage.detectPage(location.href));
            if (container) container.append(button);
        }
        // État enregistré appliqué tel quel, sans réécrire la préférence (B25)
        AmountHider._show(Boolean(this.settings.getSetting(Config.STORAGE_KEYS.IS_BLURRY)));
    }

    /**
     * Applique l'état : flou des montants, icône du bouton, graphiques prévenus.
     * @param {boolean} blurred
     */
    static _show(blurred) {
        document.documentElement.classList.toggle(AmountHider.ROOT_CLASS, blurred);
        const url = Config.getAssetURL(blurred ? 'EYE_CLOSED' : 'EYE_OPEN');
        document.querySelectorAll('img.pecunio-hide-button').forEach((btn) => {
            const img = /** @type {HTMLImageElement} */ (btn);
            img.src = url;
            img.alt = blurred ? 'Afficher les montants' : 'Masquer les montants';
        });
        window.__pecunioIsBlurry = blurred;
        window.dispatchEvent(new CustomEvent('pecunio_amounts_visibility_changed', { detail: { isBlurry: blurred } }));
    }

    enableBlurry() {
        this.settings.setSettings({ [Config.STORAGE_KEYS.IS_BLURRY]: true });
        AmountHider._show(true);
    }

    disableBlurry() {
        this.settings.setSettings({ [Config.STORAGE_KEYS.IS_BLURRY]: false });
        AmountHider._show(false);
    }

    isBlurry() {
        return document.documentElement.classList.contains(AmountHider.ROOT_CLASS);
    }
}
