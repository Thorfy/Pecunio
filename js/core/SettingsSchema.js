/**
 * SettingsSchema - Schéma des préférences utilisateur et migrations du stockage
 *
 * Toutes les préférences sont décrites ici (valeur par défaut, validation).
 * Le numéro de version du stockage (`settings_version`) permet de migrer les
 * données des anciennes versions de l'extension au démarrage.
 *
 * Historique :
 * - v1 (implicite, avant 0.6) : la visibilité des catégories était stockée
 *   sous une clé par catégorie (`"Logement": true`), mélangée aux autres clés.
 * - v2 : visibilité regroupée dans `hiddenCategories` (liste des catégories
 *   masquées) ; réglage inutilisé `accounts` supprimé (D14) ; données des
 *   très anciennes versions (`transac`, `categ`, `accountsList`) effacées.
 */

/**
 * @typedef {Object} UserSettings
 * @property {string | null} [startDate] début de période `YYYY-MM-DD`
 * @property {string | null} [endDate] fin de période `YYYY-MM-DD`
 * @property {boolean} [noEndDate] fin de période = aujourd'hui
 * @property {number[] | null} [accountsSelected] comptes affichés (null = tous)
 * @property {boolean} [isBlurry] montants masqués
 * @property {'bar' | 'line'} [chartType] type du graphique temporel
 * @property {string[]} [hiddenCategories] catégories masquées dans les graphiques
 * @property {'6m' | '12m' | '24m' | 'all'} [chartRange] période du graphique temporel (page Comptes)
 * @property {boolean} [chartDetailed] graphique temporel : toutes les catégories (sinon les 5 principales + « Autres »)
 * @property {'current' | 'last' | 'year' | 'custom'} [budgetPreset] préréglage de la comparaison du budget
 */

const isDateOnly = (value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isBoolean = (value) => typeof value === 'boolean';

/**
 * Définition de chaque préférence.
 * @type {Record<keyof UserSettings, { default: unknown, validate: (value: unknown) => boolean }>}
 */
export const SETTING_DEFINITIONS = {
    startDate: { default: null, validate: (v) => v === null || isDateOnly(v) },
    endDate: { default: null, validate: (v) => v === null || isDateOnly(v) },
    noEndDate: { default: false, validate: isBoolean },
    accountsSelected: {
        default: null,
        validate: (v) => v === null || (Array.isArray(v) && v.every((id) => Number.isFinite(id))),
    },
    isBlurry: { default: false, validate: isBoolean },
    chartType: { default: 'bar', validate: (v) => v === 'bar' || v === 'line' },
    hiddenCategories: {
        default: [],
        validate: (v) => Array.isArray(v) && v.every((name) => typeof name === 'string'),
    },
    // Préférences d'affichage de la page Comptes (lot UX-2a) : valeurs par
    // défaut utilisées tant qu'elles ne sont pas enregistrées, pas de migration
    chartRange: { default: '12m', validate: (v) => typeof v === 'string' && ['6m', '12m', '24m', 'all'].includes(v) },
    chartDetailed: { default: false, validate: isBoolean },
    budgetPreset: { default: 'last', validate: (v) => typeof v === 'string' && ['current', 'last', 'year', 'custom'].includes(v) },
};

/** Noms de toutes les préférences. */
export const SETTING_NAMES = /** @type {(keyof UserSettings)[]} */ (Object.keys(SETTING_DEFINITIONS));

/** Valeurs par défaut. */
export function defaultSettings() {
    return /** @type {UserSettings} */ (
        Object.fromEntries(SETTING_NAMES.map((name) => [name, structuredClone(SETTING_DEFINITIONS[name].default)]))
    );
}

/**
 * Valeur valide pour une préférence ?
 * @param {string} name
 * @param {unknown} value
 */
export function isValidSetting(name, value) {
    const definition = SETTING_DEFINITIONS[name];
    return Boolean(definition && definition.validate(value));
}

export const VERSION_KEY = 'settings_version';
export const CURRENT_VERSION = 2;

/**
 * Clés de chrome.storage.local qui ne sont pas des préférences de catégories,
 * à ne jamais toucher pendant la migration v1 → v2.
 */
/** Clés des anciennes versions, supprimées par la migration v1 → v2. */
const LEGACY_KEYS = ['accounts', 'accountsList', 'categ', 'transac', 'cache_data_categ', 'cache_data_transac'];
const RESERVED_KEYS = new Set([...SETTING_NAMES, VERSION_KEY, ...LEGACY_KEYS]);
const RESERVED_PREFIXES = ['cache_data_', 'cache_time_', 'pecunio_', 'review_', 'onboarding'];

/**
 * Migre le stockage vers la version courante. Sans effet si déjà à jour ;
 * peut être appelée plusieurs fois (popup et onglets Bankin) sans risque.
 * @param {chrome.storage.StorageArea} [storage]
 * @returns {Promise<{ migrated: boolean, from: number, to: number }>}
 */
export async function migrateSettings(storage = chrome.storage.local) {
    const stored = await storage.get(null);
    const storedVersion = stored[VERSION_KEY];
    const from = typeof storedVersion === 'number' && Number.isInteger(storedVersion) ? storedVersion : 1;
    if (from >= CURRENT_VERSION) return { migrated: false, from, to: from };

    if (from < 2) {
        // v1 → v2 : une clé booléenne par catégorie → liste hiddenCategories
        const hidden = new Set(Array.isArray(stored.hiddenCategories) ? stored.hiddenCategories : []);
        const legacyKeys = [];
        for (const [key, value] of Object.entries(stored)) {
            if (typeof value !== 'boolean' || RESERVED_KEYS.has(key)) continue;
            if (RESERVED_PREFIXES.some((prefix) => key.startsWith(prefix))) continue;
            legacyKeys.push(key);
            if (value) hidden.add(key);
        }
        /** @type {Record<string, unknown>} */
        const update = { [VERSION_KEY]: 2 };
        if (hidden.size > 0) update.hiddenCategories = [...hidden].sort();
        await storage.set(update);
        await storage.remove([...legacyKeys, ...LEGACY_KEYS]);
    }

    return { migrated: true, from, to: CURRENT_VERSION };
}
