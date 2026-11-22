import { defineConfig } from 'wxt';

// Build de l'extension avec WXT (https://wxt.dev).
// - Le manifest est généré : version reprise de package.json, entrées
//   (background, content script, popup, rapport) déduites de entrypoints/.
// - Les fichiers de public/ (images, html2pdf) sont copiés tels quels.
// Sortie : .output/chrome-mv3 (dossier à charger dans chrome://extensions).
export default defineConfig({
    // La page du rapport embarque html2pdf (jsPDF + html2canvas, ~1,2 Mo) :
    // taille attendue pour une page d'extension chargée depuis le disque.
    vite: () => ({
        build: { chunkSizeWarningLimit: 1600 },
    }),
    manifest: {
        name: 'Pecunio',
        description: 'Pecunio overload Bankin website', // à reformuler en phase 6 (D12)
        // Chrome accepte une chaîne ; les types du manifest attendent { email }
        author: /** @type {any} */ ('Remy Lefebvre'),
        icons: { 64: 'asset/icon.png' },
        permissions: ['webRequest', 'storage', 'unlimitedStorage'],
        host_permissions: ['https://*.bankin.com/*'],
        web_accessible_resources: [
            {
                resources: ['asset/Loading.gif', 'asset/eye.png', 'asset/eyeClose.png'],
                matches: ['https://*.bankin.com/*'],
            },
        ],
    },
});
