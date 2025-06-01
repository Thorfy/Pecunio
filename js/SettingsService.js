// Assuming Evt.js is available globally or imported if modules are used
// Assuming chrome.storage.local is available

class SettingsService {
    static ALL_SETTING_NAMES = [
        'startDate',
        'endDate',
        'accounts', // This seems like a general key, might need review if it stores account list or selected ones
        'cache_data_transactions',
        'cache_time_transactions',
        'cache_data_categories',
        'cache_time_categories',
        'cache_data_accounts',
        'cache_time_accounts',
        'accountsSelected',
        'isBlurry',
        'chartType' // Added from ChartData.js usage, should be centrally managed
        // Add any other settings that were implicitly used elsewhere
    ];

    constructor() {
        this.settings = {};
        this._initializeSettings(); // Initialize settings on construction

        // Listen for external updates to settings if necessary
        // The original Settings class listened to 'setting_updated' to call loadSettings.
        // This implies something external could trigger this event.
        // If SettingsService is the sole manager, this might change.
        // For now, keeping a similar pattern if an event signals external changes.
        // However, direct calls to setSettings should internally reload.
        // Let's assume an event 'external_settings_change_detected' might trigger a reload.
        // Or, if 'setting_updated' is meant to be an internal refresh mechanism, it's handled by setSettings.
        // For now, let's assume `setSettings` is the primary way to change and reload.
        // The original code `evt.listen('setting_updated', this.loadSettings());` was problematic.
        // A class should not listen to an event it dispatches itself to trigger a core load,
        // unless it's for complex inter-instance communication.
        // Let's simplify: load on init, and reload upon `setSettings`.
        // External refresh can be done by calling `loadSettings` explicitly if needed.
    }

    async _initializeSettings() {
        try {
            this.settings = await chrome.storage.local.get(SettingsService.ALL_SETTING_NAMES);
            // console.log('Settings initialized:', this.settings);
            evt.dispatch('settings_service_initialized'); // New event specific to service
            evt.dispatch('settings_reloaded'); // Keep for compatibility if other parts listen to this
        } catch (error) {
            console.error("Error initializing settings:", error);
            this.settings = {}; // Ensure settings is an object even on error
        }
    }

    async loadSettings() {
        try {
            this.settings = await chrome.storage.local.get(SettingsService.ALL_SETTING_NAMES);
            // console.log('Settings reloaded:', this.settings);
            evt.dispatch('settings_reloaded');
        } catch (error) {
            console.error("Error reloading settings:", error);
            // Keep stale settings or reset? For now, keep stale.
        }
    }

    getSetting(key) {
        if (this.settings.hasOwnProperty(key)) {
            return this.settings[key];
        }
        // console.warn(`SettingsService: Setting for key "${key}" not found.`);
        return null; // Or undefined, depending on desired behavior for missing keys
    }

    getAllSettings() { // Renamed from getAllSetting for clarity
        return { ...this.settings }; // Return a copy to prevent direct modification
    }

    async setSettings(settingsToSet) {
        try {
            await chrome.storage.local.set(settingsToSet);
            // console.log('Settings saved:', settingsToSet);
            // After setting, reload all settings to ensure consistency
            await this.loadSettings();
            // No need to dispatch 'settings_reloaded' here, as loadSettings already does.
        } catch (error) {
            console.error("Error setting settings:", error);
        }
    }

    // Convenience method to set a single setting
    async setSetting(key, value) {
        const settingToSet = {};
        settingToSet[key] = value;
        try {
            await chrome.storage.local.set(settingToSet);
            // console.log('Setting saved:', key, value);
            // After setting, reload all settings to ensure consistency
            this.settings[key] = value; // Optimistically update local cache
            await this.loadSettings(); // Or just update the single key: this.settings[key] = value; and dispatch if pure optimistic update.
                                       // Reloading all ensures we are in sync with storage.
        } catch (error) {
            console.error("Error setting single setting:", error);
        }
    }
}
