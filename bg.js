/**
 * Service worker Pecunio - Capture des en-têtes d'authentification Bankin.
 *
 * Bankin authentifie ses appels à sync.bankin.com avec quatre en-têtes. On les
 * capture sur les requêtes /v2/accounts et on les transmet aux onglets Bankin
 * (content scripts) via un port par onglet.
 *
 * - Plusieurs onglets : un port par onglet, tous reçoivent les en-têtes (bug B1).
 * - Onglet ouvert après la capture : les en-têtes lui sont renvoyés dès sa connexion (bug B2).
 * - Service worker endormi puis relancé par Chrome (MV3) : les en-têtes sont conservés
 *   dans chrome.storage.session (en mémoire, effacé à la fermeture du navigateur,
 *   inaccessible aux content scripts) (bug B2).
 *
 * Les noms des en-têtes doivent rester alignés avec Config.API.REQUIRED_HEADERS.
 *
 * La popup n'est plus ouverte automatiquement à chaque page Bankin (bug B11) :
 * l'utilisateur l'ouvre depuis l'icône de l'extension.
 */
const REQUIRED_HEADERS = ['Authorization', 'Bankin-Version', 'Client-Id', 'Client-Secret'];
const SESSION_KEY = 'pecunio_auth_headers';

/** @type {Map<number, chrome.runtime.Port>} */
const portsByTabId = new Map();

/** Copie en mémoire des en-têtes ; null tant qu'ils n'ont pas été relus depuis la session. */
let headersCache = null;

async function readStoredHeaders() {
    if (headersCache) return headersCache;
    try {
        const stored = await chrome.storage.session.get(SESSION_KEY);
        headersCache = stored[SESSION_KEY] || null;
    } catch (error) {
        console.warn('[BG] Lecture des en-têtes impossible :', error.message);
    }
    return headersCache;
}

function postHeaders(port, headers) {
    try {
        port.postMessage({ data: headers });
        return true;
    } catch (error) {
        console.warn('[BG] Envoi des en-têtes impossible :', error.message);
        return false;
    }
}

function broadcastHeaders(headers) {
    for (const [tabId, port] of portsByTabId) {
        if (!postHeaders(port, headers)) portsByTabId.delete(tabId);
    }
}

chrome.webRequest.onBeforeSendHeaders.addListener(
    (info) => {
        const captured = {};
        for (const header of info.requestHeaders || []) {
            if (REQUIRED_HEADERS.includes(header.name)) captured[header.name] = header.value;
        }
        if (Object.keys(captured).length === 0) return;

        headersCache = { ...(headersCache || {}), ...captured };
        chrome.storage.session
            .set({ [SESSION_KEY]: headersCache })
            .catch((error) => console.warn('[BG] Sauvegarde des en-têtes impossible :', error.message));
        broadcastHeaders(headersCache);
    },
    {
        urls: ['https://sync.bankin.com/v2/accounts*'],
        types: ['main_frame', 'sub_frame', 'xmlhttprequest'],
    },
    ['requestHeaders'],
);

chrome.runtime.onConnect.addListener((port) => {
    const tabId = port.sender?.tab?.id;
    if (tabId == null) return;

    portsByTabId.set(tabId, port);
    port.onDisconnect.addListener(() => {
        if (portsByTabId.get(tabId) === port) portsByTabId.delete(tabId);
    });

    readStoredHeaders().then((headers) => {
        if (headers && portsByTabId.get(tabId) === port) postHeaders(port, headers);
    });
});
