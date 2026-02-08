class AmountHider {
    constructor() {
        this.insertButton();
    }

    insertButton() {
        let button = document.getElementById("hideButton");
        if (!button) {
            InjectedStyles.inject();
            button = document.createElement('img');
            button.id = "hideButton";
            button.classList.add('pecunio-hide-button');
            this.spanHeaderAmmount = document.querySelector(Config.SELECTORS.HEADER_AMOUNT);
            let container = document.querySelector(Config.SELECTORS.BUTTON_CONTAINER);
            if (!container && typeof Config !== 'undefined' && location.href.indexOf(Config.URLS.CATEGORIES_PAGE) !== -1) {
                container = document.querySelector(Config.SELECTORS.CATEGORY_PAGE_BUTTON_CONTAINER);
            }
            if (container) {
                container.append(button);
            }
            this.loadEvent();
        } else if (settingClass.getSetting(Config.STORAGE_KEYS.IS_BLURRY)) {
            AmountHider.refreshBlur();
        }
    }

    loadElement() {
        this.spanHeaderAmmount = document.querySelector(Config.SELECTORS.HEADER_AMOUNT);
        this.spanHeaderText = document.querySelector(Config.SELECTORS.HEADER_TEXT);
        this.hideButton = document.querySelector(Config.SELECTORS.HIDE_BUTTON);
        this.blurryDivs = document.querySelectorAll(Config.SELECTORS.BLURRY_SELECTORS);
    }

    loadEvent() {
        this.loadElement();
        this.disableBlurry();
        if (settingClass.getSetting(Config.STORAGE_KEYS.IS_BLURRY)) this.enableBlurry();
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
        document.querySelectorAll('.pecunio-hide-button').forEach(btn => { btn.src = url; });
    }

    _syncGlobalBlur(value) {
        if (typeof window !== 'undefined') window.__pecunioIsBlurry = !!value;
        window.dispatchEvent(new CustomEvent('pecunio_amounts_visibility_changed', { detail: { isBlurry: !!value } }));
    }

    enableBlurry() {
        settingClass.setSettings({ [Config.STORAGE_KEYS.IS_BLURRY]: true });
        this.loadElement();
        this._applyBlurState(true);
        this._updateButtonIcon(true);
        this._syncGlobalBlur(true);
    }

    disableBlurry() {
        settingClass.setSettings({ [Config.STORAGE_KEYS.IS_BLURRY]: false });
        this.loadElement();
        this._applyBlurState(false);
        this._updateButtonIcon(false);
        this._syncGlobalBlur(false);
    }

    isBlurry() {
        this.loadElement();
        return this.spanHeaderAmmount
            ? this.spanHeaderAmmount.classList.contains('pecunio-blurred')
            : settingClass.getSetting(Config.STORAGE_KEYS.IS_BLURRY);
    }

    /**
     * Réapplique le flou à tous les éléments ciblés (liste analyse, graphiques).
     * À appeler après un changement de page ou injection de contenu (ex: charts).
     */
    static refreshBlur() {
        if (!settingClass.getSetting(Config.STORAGE_KEYS.IS_BLURRY)) return;
        const header = document.querySelector(Config.SELECTORS.HEADER_AMOUNT);
        const all = document.querySelectorAll(Config.SELECTORS.BLURRY_SELECTORS);
        if (header) header.classList.add('pecunio-blurred');
        all.forEach(el => el.classList.add('pecunio-blurred'));
        document.querySelectorAll('.pecunio-hide-button').forEach(btn => {
            btn.src = Config.getAssetURL('EYE_CLOSED');
        });
    }
}