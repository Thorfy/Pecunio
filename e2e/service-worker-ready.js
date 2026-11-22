// Attente du service worker de Pecunio avant d'ouvrir une page Bankin.
//
// Pourquoi : chaque test lance un Chromium neuf, où l'extension vient d'être
// installée. Son service worker pose l'écouteur des en-têtes (webRequest) dès
// son démarrage, mais Chrome ne lui transmet les requêtes qu'un peu plus tard :
// l'enregistrement de l'écouteur est un aller-retour vers le navigateur. Sous
// charge, ce délai atteint plusieurs centaines de millisecondes, et l'unique
// appel /v2/accounts du Bankin simulé (au chargement de la page) passait
// inaperçu : pas d'en-têtes, pas de données, aucun graphique (délai d'attente
// de 10 s de DataManager). L'événement `serviceworker` de Playwright ne suffit
// pas : il signale que le worker existe, pas que Chrome lui envoie les requêtes.
//
// Chez un utilisateur, l'extension est installée depuis longtemps : Chrome
// connaît déjà l'écouteur et réveille le service worker à l'appel de Bankin.
// Seules les toutes premières secondes après l'installation (ou une mise à jour)
// sont concernées, et un rechargement de la page suffit alors.
//
// Méthode : une fois l'écouteur de Pecunio posé, le service worker en pose un
// second (la sonde) sur le même événement, puis une page vierge envoie des
// requêtes sonde jusqu'à ce que la sonde les voie. Les deux enregistrements
// passent par le même canal, dans l'ordre : quand la sonde reçoit les requêtes,
// l'écouteur de Pecunio les reçoit aussi. Les requêtes sonde n'ont pas les
// en-têtes de Bankin (Pecunio les ignore) et sont servies par Playwright : rien
// ne part sur le réseau.

/** Adresse des requêtes sonde (filtrée par l'écouteur de Pecunio, qui les ignore faute d'en-têtes). */
export const PROBE_URL = 'https://sync.bankin.com/v2/accounts?pecunio-e2e-probe=1';

/** Délai maximal d'attente : au-delà, l'extension ne capte rien et le test ne peut pas réussir. */
const TIMEOUT_MS = 10_000;

/** Pause entre deux requêtes sonde. */
const PROBE_INTERVAL_MS = 50;

const isProbe = (url) => url.href === PROBE_URL;

/**
 * Attend que Chrome transmette les requêtes de Bankin à l'écouteur d'en-têtes
 * du service worker.
 * @param {{ worker: import('@playwright/test').Worker,
 *   context: import('@playwright/test').BrowserContext, timeoutMs?: number }} options
 * @returns {Promise<{ probes: number }>} nombre de requêtes sonde envoyées
 */
export async function waitForHeaderCapture({ worker, context, timeoutMs = TIMEOUT_MS }) {
    // 1. Script du service worker exécuté (écouteur de Pecunio posé), puis sonde posée après lui
    await worker.evaluate(async (probeUrl) => {
        while (!chrome.webRequest.onBeforeSendHeaders.hasListeners()) {
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
        const probe = /** @type {any} */ (globalThis);
        probe.__pecunioProbeSeen = false;
        probe.__pecunioProbe = () => {
            probe.__pecunioProbeSeen = true;
        };
        chrome.webRequest.onBeforeSendHeaders.addListener(probe.__pecunioProbe, {
            urls: [probeUrl],
            types: ['xmlhttprequest'],
        });
    }, PROBE_URL);

    // 2. Requêtes sonde depuis une page vierge, jusqu'à ce que la sonde les voie
    const fulfillProbe = (route) => route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } });
    await context.route(isProbe, fulfillProbe);
    const page = await context.newPage();
    let probes = 0;
    try {
        const deadline = Date.now() + timeoutMs;
        while (!(await worker.evaluate(() => /** @type {any} */ (globalThis).__pecunioProbeSeen))) {
            if (Date.now() > deadline) {
                throw new Error(`Le service worker de Pecunio ne voit aucune requête vers sync.bankin.com après ${timeoutMs} ms`);
            }
            probes++;
            await page.evaluate((url) => fetch(url).catch(() => {}), PROBE_URL);
            await new Promise((resolve) => setTimeout(resolve, PROBE_INTERVAL_MS));
        }
    } finally {
        await page.close();
        await context.unroute(isProbe, fulfillProbe);
        await worker.evaluate(() => {
            const probe = /** @type {any} */ (globalThis);
            chrome.webRequest.onBeforeSendHeaders.removeListener(probe.__pecunioProbe);
            delete probe.__pecunioProbe;
            delete probe.__pecunioProbeSeen;
        });
    }
    return { probes };
}
