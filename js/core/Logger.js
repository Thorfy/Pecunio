import { Config } from './Config.js';

/**
 * Logger - Journalisation à niveaux
 *
 * - `debug` : silencieux par défaut, pour ne pas encombrer la console de Bankin.
 *   Activable avec `Config.DEBUG = true`, ou dans la console de la page :
 *   `localStorage.setItem('pecunio_debug', '1')` puis recharger.
 * - `warn` / `error` : toujours affichés.
 *
 * Ne jamais y passer de données bancaires (transactions, montants, libellés) :
 * la console est visible par toute extension ou personne ayant accès au poste.
 */
export class Logger {
    static PREFIX = '[Pecunio]';

    static isDebugEnabled() {
        if (typeof Config !== 'undefined' && Config.DEBUG) return true;
        try {
            return globalThis.localStorage?.getItem('pecunio_debug') === '1';
        } catch {
            return false;
        }
    }

    static debug(...args) {
        if (Logger.isDebugEnabled()) console.log(Logger.PREFIX, ...args);
    }

    static warn(...args) {
        console.warn(Logger.PREFIX, ...args);
    }

    static error(...args) {
        console.error(Logger.PREFIX, ...args);
    }
}
