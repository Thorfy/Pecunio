class Settings {

    static allSettingName = ['startDate', 'endDate', 'accounts'];

    constructor() {
        this.settings;

        this.loadSettings()
        evt.listen('setting_updated', async () => await this.loadSettings());
    }

    async loadSettings() {
        this.settings = await chrome.storage.local.get(Settings.allSettingName)
        evt.dispatch('settings_reloaded');
    }


    getSetting(key) {
        return this.settings[key];
    }
    getAllSetting() {
        return this.settings
    }

    async setSettings(settings) {
        chrome.storage.local.set(settings)
        await this.loadSettings();
        evt.dispatch('settings_reloaded')
    }

}