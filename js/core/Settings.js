import { evt } from './events.js';
import { Logger } from './Logger.js';
import { SETTING_NAMES, defaultSettings, isValidSetting, migrateSettings } from './SettingsSchema.js';

/** @typedef {import('./SettingsSchema.js').UserSettings} UserSettings */

/**
 * Settings - Préférences utilisateur (période, comptes, affichage)
 *
 * Le schéma (valeurs par défaut, validation, migrations) est dans
 * SettingsSchema.js. Le cache de l'API Bankin est géré par CacheStore.
 */
export class Settings {
    /** Noms de toutes les préférences (voir SettingsSchema). */
    static ALL_SETTING_NAMES = SETTING_NAMES;

    constructor() {
        /** @type {UserSettings} */
        this.settings = {};
        this.isInitialized = false;
        this.initializationPromise = this._initialize();
    }

    /**
     * Migre le stockage si nécessaire, puis charge les préférences.
     */
    async _initialize() {
        try {
            const migration = await migrateSettings();
            if (migration.migrated) Logger.debug(`[Settings] Stockage migré de v${migration.from} à v${migration.to}`);
        } catch (error) {
            // Une migration ratée ne doit pas empêcher l'extension de fonctionner
            console.warn('[Settings] Migration impossible :', error);
        }
        try {
            await this.loadSettings();
            this.isInitialized = true;
            Logger.debug('[Settings] Initialization completed successfully');
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
     * Charge toutes les préférences depuis le stockage Chrome
     */
    async loadSettings() {
        try {
            this.settings = await this._getChromeStorage(Settings.ALL_SETTING_NAMES);
            evt.dispatch('settings_reloaded');
            Logger.debug('[Settings] Settings loaded successfully');
        } catch (error) {
            console.error('[Settings] Error loading settings:', error);
            this.settings = defaultSettings();
            throw error;
        }
    }

    /**
     * Valeur enregistrée d'une préférence (undefined si jamais enregistrée).
     * @template {keyof UserSettings} K
     * @param {K} key
     * @returns {UserSettings[K]}
     */
    getSetting(key) {
        if (!this.isInitialized) {
            console.warn(`[Settings] Attempting to get setting '${key}' before initialization`);
            return this.settings[key] || null;
        }
        return this.settings[key];
    }

    /**
     * Copie des préférences enregistrées.
     * @returns {UserSettings}
     */
    getAllSettings() {
        if (!this.isInitialized) {
            console.warn('[Settings] Attempting to get all settings before initialization');
        }
        return { ...this.settings };
    }

    /**
     * Met à jour une ou plusieurs préférences (les valeurs invalides ou
     * inconnues du schéma sont ignorées avec un avertissement).
     * @param {Partial<UserSettings>} settings
     */
    async setSettings(settings) {
        try {
            const validatedSettings = this._validateSettings(settings);
            await this._setChromeStorage(validatedSettings);
            await this.loadSettings(); // émet settings_reloaded
            Logger.debug('[Settings] Settings updated successfully:', Object.keys(validatedSettings));
        } catch (error) {
            console.error('[Settings] Error updating settings:', error);
            throw error;
        }
    }

    /**
     * Met à jour une préférence.
     * @template {keyof UserSettings} K
     * @param {K} key
     * @param {UserSettings[K]} value
     */
    async setSetting(key, value) {
        return this.setSettings({ [key]: value });
    }

    /**
     * Efface les préférences utilisateur, sans toucher au cache des données
     * ni au rapport (bug B13).
     */
    async clearAllSettings() {
        try {
            await chrome.storage.local.remove(Settings.ALL_SETTING_NAMES);
            this.settings = {};
            evt.dispatch('settings_reloaded');
            Logger.debug('[Settings] All settings cleared successfully');
        } catch (error) {
            console.error('[Settings] Error clearing settings:', error);
            throw error;
        }
    }

    /**
     * Garde les préférences connues du schéma et valides.
     * @param {Record<string, unknown>} settings
     * @returns {Partial<UserSettings>}
     */
    _validateSettings(settings) {
        /** @type {Record<string, unknown>} */
        const validated = {};
        for (const [key, value] of Object.entries(settings)) {
            if (!isValidSetting(key, value)) {
                console.warn(`[Settings] Valeur refusée pour « ${key} » :`, value);
                continue;
            }
            validated[key] = value;
        }
        return validated;
    }

    /**
     * Lecture du stockage avec gestion de chrome.runtime.lastError.
     * @param {string[]} keys
     * @returns {Promise<Record<string, any>>}
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
     * Écriture du stockage avec gestion de chrome.runtime.lastError.
     * @param {Record<string, unknown>} items
     * @returns {Promise<void>}
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
}
