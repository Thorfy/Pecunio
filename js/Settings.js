class Settings {

    static allSettingName = [
        'startDate', 
        'endDate', 
        'accounts',
        'cache_data_transactions', 
        'cache_time_transactions', 
        'cache_data_categories', 
        'cache_time_categories', 
        'cache_data_accounts', 
        'cache_time_accounts',
        'accountsSelected',
        'isBlurry'
    ];

    constructor() {

        this.settings;
        this.loadSettings()

        evt.listen('setting_updated', this.loadSettings());
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