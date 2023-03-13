class Settings {

    constructor(){
        this.loadSettings()
    }

    loadSettings() {
        return new Promise(async function (resolve, reject) {
            let settings = await chrome.storage.local.get(this.getSettingName())
            this.settings = settings
            resolve(this.settings)
        })
    }

    getSetting(key) {
        return this.settings[key];
    }
    getAllSetting(){
        return this.settings 
    }

    getSettingName() {
        return ['startDate', 'endDate', 'accounts']
    }

    async setSettings(settings) {
        chrome.storage.local.set(settings)
        await this.loadSettings();
    }
    
}