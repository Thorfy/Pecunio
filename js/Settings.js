class Settings {

    static allSettingName = [
        'startDate', 
        'endDate', 
        'accounts',
        'cache_data_transac', 
        'cache_time_transac', 
        'cache_data_categ', 
        'cache_time_categ'
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