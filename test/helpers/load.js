// Chargement des modules de l'extension dans un test.
//
// Les modules sont importés normalement ; leurs exports sont en plus exposés
// sur globalThis pour que les tests existants puissent écrire `Transaction`,
// `DataMerger`, etc. sans import. Les nouveaux tests peuvent importer
// directement les modules dont ils ont besoin.

/** Tous les modules de l'extension (hors points d'entrée WXT). */
const ALL_MODULES = import.meta.glob('/js/**/*.js');

/** Modules utilisés par la page du rapport. */
export const REPORT_SCRIPTS = [
    'js/core/Config.js',
    'js/core/Logger.js',
    'js/services/ReportStorage.js',
    'js/report/ReportFilters.js',
    'js/report/ReportChartDataBuilder.js',
];

/**
 * Importe des modules et expose leurs exports sur globalThis.
 * @param {string[]} files chemins relatifs à la racine du dépôt
 */
export async function loadScripts(files) {
    for (const file of files) {
        const loader = ALL_MODULES[`/${file}`];
        if (!loader) throw new Error(`Module inconnu : ${file}`);
        Object.assign(globalThis, await loader());
    }
}

/**
 * Charge tous les modules de l'extension. Expose notamment l'instance
 * partagée `evt` (js/core/events.js), celle qu'utilisent Settings et DataManager.
 */
export async function loadContentScripts() {
    await loadScripts(Object.keys(ALL_MODULES).map((path) => path.slice(1)));
}
