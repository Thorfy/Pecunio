class AmountHider {
    static blurryClassList = ".amountGreen,.amountRed,.amountBlack"
    constructor() {
        this.insertButton()
    }

    insertButton() {
        let button = document.getElementById("hideButton");
        if (!button) {
            // Injecter les styles Pecunio
            InjectedStyles.inject();
            
            button = document.createElement('img')
            button.id = "hideButton"
            button.classList.add('pecunio-hide-button');
            this.spanHeaderAmmount = document.querySelector(".dbl.fs14.fw7.lh18.elp")
            this.spanHeaderText = document.querySelector(".dbl.fs1.elp")
            this.spanHeaderText.append(button)
            this.loadEvent()
        }
    }

    loadElement() {
        this.spanHeaderAmmount = document.querySelector(".dbl.fs14.fw7.lh18.elp")
        this.spanHeaderText = document.querySelector(".dbl.fs1.elp")

        this.hideButton = document.querySelector("#hideButton")
        this.blurryDivs = document.querySelectorAll(AmountHider.blurryClassList)
    }

    loadEvent() {
        this.loadElement()
        this.disableBlurry()

        if (settingClass.getSetting('isBlurry'))
            this.enableBlurry()

        this.hideButton.addEventListener('click', () => {
            if (this.isBlurry())
                return this.disableBlurry()

            return this.enableBlurry()
        })
    }

    enableBlurry() {
        settingClass.setSettings({ 'isBlurry': true })
        this.loadElement()
        this.spanHeaderAmmount.classList.add('pecunio-blurred');
        this.blurryDivs.forEach(x => {
            x.classList.add('pecunio-blurred');
        })
        this.hideButton.src = chrome.runtime.getURL("asset/eyeClose.png")
    }

    disableBlurry() {
        settingClass.setSettings({ 'isBlurry': false })
        this.loadElement()

        this.spanHeaderAmmount.classList.remove('pecunio-blurred');
        this.blurryDivs.forEach(x => {
            x.classList.remove('pecunio-blurred');
        })
        this.hideButton.src = chrome.runtime.getURL("asset/eye.png")
    }

    isBlurry() {
        this.loadElement()

        // Vérifier si l'élément a la classe pecunio-blurred
        return this.spanHeaderAmmount.classList.contains('pecunio-blurred');
    }

}