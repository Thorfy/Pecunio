// Chargement des scripts de l'extension dans un test.
//
// Les scripts sont importés un par un, dans l'ordre réel de l'extension
// (manifest.json pour le content script). Grâce au plugin legacy-globals,
// chaque classe déclarée devient une propriété de globalThis, exactement
// comme dans Chrome.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Vitest s'exécute depuis la racine du dépôt (là où se trouve vitest.config.js).
const root = process.cwd();
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8'));

/**
 * Scripts du content script, dans l'ordre du manifest, sans les librairies
 * tierces ni `injected.js` (qui démarre l'extension).
 */
export const CONTENT_SCRIPTS = manifest.content_scripts[0].js.filter(
    (file) => !file.startsWith('libs/') && file !== 'injected.js',
);

/** Scripts chargés par report.html (hors librairies et report.js). */
export const REPORT_SCRIPTS = [
    'js/core/Config.js',
    'js/core/Logger.js',
    'js/services/ReportStorage.js',
    'js/report/ReportFilters.js',
    'js/report/ReportChartDataBuilder.js',
];

/**
 * Importe des scripts de l'extension dans l'ordre donné.
 * @param {string[]} files chemins relatifs à la racine du dépôt
 */
export async function loadScripts(files) {
    for (const file of files) {
        await import(/* @vite-ignore */ `/${file}`);
    }
}

/** Charge tout le content script et crée l'instance globale `evt`. */
export async function loadContentScripts() {
    await loadScripts(CONTENT_SCRIPTS);
    globalThis.evt = new globalThis.Evt();
}
