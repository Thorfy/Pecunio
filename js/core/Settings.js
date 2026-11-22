/**
 * Settings - Préférences utilisateur (période, comptes, affichage)
 * Le cache de l'API Bankin est géré par CacheStore.
 */
class Settings {
    /**
     * Préférences utilisateur. Le cache de l'API Bankin (cache_data_* / cache_time_*)
     * est géré à part par CacheStore.
     */
    static ALL_SETTING_NAMES = [
        'startDate',
        'endDate',
        'noEndDate',
        'accounts',
        'accountsSelected',
        'isBlurry',
        'chartType'
    ];

    constructor() {
        this.settings = {};
        this.isInitialized = false;
        this.initializationPromise = this._initialize();
    }

    /**
     * Initialise les paramètres
     */
    async _initialize() {
        try {
            await this.loadSettings();
            this.isInitialized = true;
            
            // Écouter les changements de paramètres
            evt.listen('setting_updated', () => this.loadSettings());
            
            console.log('[Settings] Initialization completed successfully');
        } catch (error) {
            console.error('[Settings] Initialization failed:', error);
            throw error;
        }
    }

    /**
     * Attend que l'initialisation soit terminée
     */
    async waitForInitialization() {
        return this.initializationPromise;
    }

    /**
     * Charge tous les paramètres depuis le stockage Chrome
     */
    async loadSettings() {
        try {
            this.settings = await this._getChromeStorage(Settings.ALL_SETTING_NAMES);
            evt.dispatch('settings_reloaded');
            console.log('[Settings] Settings loaded successfully');
        } catch (error) {
            console.error('[Settings] Error loading settings:', error);
            // Utiliser des valeurs par défaut en cas d'erreur
            this.settings = this._getDefaultSettings();
            throw error;
        }
    }

    /**
     * Récupère un paramètre spécifique
     */
    getSetting(key) {
        if (!this.isInitialized) {
            console.warn(`[Settings] Attempting to get setting '${key}' before initialization`);
            return this.settings[key] || null;
        }
        return this.settings[key];
    }

    /**
     * Récupère tous les paramètres
     */
    getAllSettings() {
        if (!this.isInitialized) {
            console.warn('[Settings] Attempting to get all settings before initialization');
        }
        return { ...this.settings }; // Retourner une copie pour éviter les modifications externes
    }

    /**
     * Méthode de compatibilité avec l'ancien code
     * @deprecated Utiliser getAllSettings() à la place
     */
    getAllSetting() {
        console.warn('[Settings] getAllSetting() is deprecated, use getAllSettings() instead');
        return this.getAllSettings();
    }

    /**
     * Met à jour un ou plusieurs paramètres
     */
    async setSettings(settings) {
        try {
            // Valider les paramètres avant de les sauvegarder
            const validatedSettings = this._validateSettings(settings);
            
            await this._setChromeStorage(validatedSettings);
            await this.loadSettings(); // Recharger pour synchroniser l'état interne
            
            evt.dispatch('settings_updated');
            console.log('[Settings] Settings updated successfully:', Object.keys(validatedSettings));
        } catch (error) {
            console.error('[Settings] Error updating settings:', error);
            throw error;
        }
    }

    /**
     * Met à jour un paramètre unique
     */
    async setSetting(key, value) {
        return this.setSettings({ [key]: value });
    }

    /**
     * Supprime un paramètre
     */
    async removeSetting(key) {
        try {
            await chrome.storage.local.remove(key);
            delete this.settings[key];
            evt.dispatch('settings_updated');
            console.log(`[Settings] Setting '${key}' removed successfully`);
        } catch (error) {
            console.error(`[Settings] Error removing setting '${key}':`, error);
            throw error;
        }
    }

    /**
     * Efface les préférences utilisateur, sans toucher au cache des données,
     * aux catégories masquées ni au rapport (bug B13).
     */
    async clearAllSettings() {
        try {
            await chrome.storage.local.remove(Settings.ALL_SETTING_NAMES);
            this.settings = {};
            evt.dispatch('settings_updated');
            console.log('[Settings] All settings cleared successfully');
        } catch (error) {
            console.error('[Settings] Error clearing settings:', error);
            throw error;
        }
    }

    /**
     * Valide les paramètres avant sauvegarde
     */
    _validateSettings(settings) {
        const validated = {};
        
        for (const [key, value] of Object.entries(settings)) {
            if (key === 'accountsSelected' && !Array.isArray(value)) {
                console.warn(`[Settings] Invalid accountsSelected, expected array, got ${typeof value}`);
                continue;
            }
            
            if ((key === 'isBlurry' || key === 'noEndDate') && typeof value !== 'boolean') {
                console.warn(`[Settings] Invalid ${key}, expected boolean, got ${typeof value}`);
                continue;
            }
            
            validated[key] = value;
        }
        
        return validated;
    }

    /**
     * Retourne les paramètres par défaut
     */
    _getDefaultSettings() {
        return {
            startDate: null,
            endDate: null,
            accounts: [],
            accountsSelected: null,
            isBlurry: false,
            noEndDate: false
        };
    }

    /**
     * Wrapper pour chrome.storage.local.get avec gestion d'erreurs
     */
    _getChromeStorage(keys) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.get(keys, (result) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(result);
                }
            });
        });
    }

    /**
     * Wrapper pour chrome.storage.local.set avec gestion d'erreurs
     */
    _setChromeStorage(items) {
        return new Promise((resolve, reject) => {
            chrome.storage.local.set(items, () => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * Vérifie si un paramètre existe
     */
    hasSetting(key) {
        return this.settings.hasOwnProperty(key) && this.settings[key] !== null && this.settings[key] !== undefined;
    }

    /**
     * Récupère un paramètre avec une valeur par défaut
     */
    getSettingWithDefault(key, defaultValue) {
        return this.hasSetting(key) ? this.settings[key] : defaultValue;
    }
}