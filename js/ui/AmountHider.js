import { BankinPage } from '../bankin/BankinPage.js';
import { Config } from '../core/Config.js';
import { InjectedStyles } from './InjectedStyles.js';

export class AmountHider {
    /**
     * @param {import('../core/Settings.js').Settings} settings préférences (état du masquage)
     */
    constructor(settings, bankin = new BankinPage(document)) {
        this.settings = settings;
        this.bankin = bankin;
        this.insertButton();
    }

    insertButton() {
        let button = document.getElementById("hideButton");
        if (!button) {
            InjectedStyles.inject();
            button = document.createElement('img');
            button.id = "hideButton";
            button.classList.add('pecunio-hide-button');
            this.spanHeaderAmmount = this.bankin.headerAmount();
            const container = this.bankin.hideButtonContainer(BankinPage.detectPage(location.href));
            if (container) {
                container.append(button);
            }
            this.loadEvent();
        } else if (this.settings.getSetting(Config.STORAGE_KEYS.IS_BLURRY)) {
            AmountHider.refreshBlur(this.settings);
        }
    }

    loadElement() {
        this.spanHeaderAmmount = this.bankin.headerAmount();
        this.blurryDivs = this.bankin.amountElements();
    }

    loadEvent() {
        this.loadElement();
        this.disableBlurry();
        if (this.settings.getSetting(Config.STORAGE_KEYS.IS_BLURRY)) this.enableBlurry();
        const toggle = () => {
            if (this.isBlurry()) return this.disableBlurry();
            return this.enableBlurry();
        };
        const buttons = Array.from(document.querySelectorAll('.pecunio-hide-button'));
        buttons.forEach(btn => btn.replaceWith(btn.cloneNode(true)));
        document.querySelectorAll('.pecunio-hide-button').forEach(btn => btn.addEventListener('click', toggle));
    }

    _applyBlurState(blurred) {
        const className = 'pecunio-blurred';
        if (this.spanHeaderAmmount) {
            this.spanHeaderAmmount.classList.toggle(className, blurred);
        }
        this.blurryDivs.forEach(el => el.classList.toggle(className, blurred));
    }

    _updateButtonIcon(blurred) {
        const url = blurred ? Config.getAssetURL('EYE_CLOSED') : Config.getAssetURL('EYE_OPEN');
        document.querySelectorAll('img.pecunio-hide-button').forEach(btn => { /** @type {HTMLImageElement} */ (btn).src = url; });
    }

    _syncGlobalBlur(value) {
        if (typeof window !== 'undefined') window.__pecunioIsBlurry = !!value;
        window.dispatchEvent(new CustomEvent('pecunio_amounts_visibility_changed', { detail: { isBlurry: !!value } }));
    }

    enableBlurry() {
        this.settings.setSettings({ [Config.STORAGE_KEYS.IS_BLURRY]: true });
        this.loadElement();
        this._applyBlurState(true);
        this._updateButtonIcon(true);
        this._syncGlobalBlur(true);
    }

    disableBlurry() {
        this.settings.setSettings({ [Config.STORAGE_KEYS.IS_BLURRY]: false });
        this.loadElement();
        this._applyBlurState(false);
        this._updateButtonIcon(false);
        this._syncGlobalBlur(false);
    }

    isBlurry() {
        this.loadElement();
        return this.spanHeaderAmmount
            ? this.spanHeaderAmmount.classList.contains('pecunio-blurred')
            : this.settings.getSetting(Config.STORAGE_KEYS.IS_BLURRY);
    }

    /**
     * Réapplique le flou à tous les éléments ciblés (liste analyse, graphiques).
     * À appeler après un changement de page ou injection de contenu (ex: charts).
     */
    /** @param {import('../core/Settings.js').Settings} settings */
    static refreshBlur(settings, bankin = new BankinPage(document)) {
        if (!settings.getSetting(Config.STORAGE_KEYS.IS_BLURRY)) return;
        const header = bankin.headerAmount();
        const all = bankin.amountElements();
        if (header) header.classList.add('pecunio-blurred');
        all.forEach(el => el.classList.add('pecunio-blurred'));
        document.querySelectorAll('img.pecunio-hide-button').forEach(btn => {
            /** @type {HTMLImageElement} */ (btn).src = Config.getAssetURL('EYE_CLOSED');
        });
    }
}