// Plugin Vite utilisé uniquement par les tests.
//
// Le code de l'extension est écrit en scripts classiques : chaque fichier
// déclare des classes au niveau global, et les fichiers se voient entre eux
// parce que Chrome les charge dans le même scope (ordre du manifest).
// Pour les importer dans Vitest sans les modifier, on ajoute à la fin de
// chaque fichier `Object.assign(globalThis, { ...déclarations })`.
// Les fichiers restent ainsi de vrais modules : la couverture de code et les
// numéros de ligne des erreurs sont corrects.
//
// Ce plugin disparaîtra avec la migration vers les modules ES (phase 3).

const TOP_LEVEL_DECLARATION = /^(?:class|function|async function|const|let|var)\s+([A-Za-z_$][\w$]*)/gm;

export function legacyGlobals() {
    let root = '';
    return {
        name: 'pecunio-legacy-globals',
        enforce: 'pre',
        configResolved(config) {
            root = config.root.replace(/\\/g, '/');
        },
        transform(code, id) {
            const file = id.split('?')[0].replace(/\\/g, '/');
            const isExtensionScript = file.startsWith(`${root}/js/`) || file === `${root}/bg.js`;
            if (!isExtensionScript || !file.endsWith('.js')) return null;

            const names = [...new Set([...code.matchAll(TOP_LEVEL_DECLARATION)].map((m) => m[1]))];
            if (names.length === 0) return null;

            return {
                code: `${code}\n;Object.assign(globalThis, { ${names.join(', ')} });\n`,
                map: null,
            };
        },
    };
}
