// Service worker (bg.js) : capture des en-têtes d'authentification Bankin
// et transmission aux onglets via des ports.
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AUTH_HEADERS } from '../fixtures/bankin.js';
import { createPort } from '../helpers/fake-chrome.js';

/** Démarre (ou redémarre) le service worker avec le `chrome` courant. */
const startServiceWorker = async () => {
    vi.resetModules();
    await import('/bg.js');
};

/** Simule une requête de Bankin vers /v2/accounts. */
const bankinRequest = (headers = AUTH_HEADERS, url = 'https://sync.bankin.com/v2/accounts?limit=200') =>
    chrome.webRequest.onBeforeSendHeaders.dispatch({
        url,
        requestHeaders: [...Object.entries(headers).map(([name, value]) => ({ name, value })), { name: 'Accept', value: '*/*' }],
    });

const openTab = (tabId) => {
    const port = createPort({ tabId });
    chrome.runtime.onConnect.dispatch(port);
    return port;
};

beforeEach(startServiceWorker);

describe('bg.js — en-têtes d\'authentification', () => {
    test('écoute uniquement /v2/accounts de sync.bankin.com', () => {
        expect(chrome.webRequest.onBeforeSendHeaders.listenerCount).toBe(1);
    });

    test('transmet au content script les 4 en-têtes requis, et seulement eux', () => {
        const port = openTab(1);
        bankinRequest();
        expect(port.postMessage).toHaveBeenLastCalledWith({ data: AUTH_HEADERS });
    });

    test('ne transmet rien tant qu\'aucun onglet n\'est connecté', () => {
        expect(() => bankinRequest()).not.toThrow();
    });

    // --- B1 -------------------------------------------------------------
    test('B1 — deux onglets Bankin reçoivent tous les deux les en-têtes', () => {
        const first = openTab(1);
        const second = openTab(2);
        bankinRequest();
        expect(second.postMessage).toHaveBeenCalled();
        expect(first.postMessage).toHaveBeenCalled();
    });

    // --- B2 -------------------------------------------------------------
    test('B2 — un onglet qui se connecte après la requête reçoit les en-têtes', async () => {
        bankinRequest();
        const late = openTab(3);
        await vi.waitFor(() => expect(late.postMessage).toHaveBeenCalledWith({ data: AUTH_HEADERS }), { timeout: 200 });
    });

    test('B2 — les en-têtes survivent au redémarrage du service worker', async () => {
        bankinRequest();
        await startServiceWorker(); // Chrome a tué puis relancé le service worker
        const port = openTab(4);
        await vi.waitFor(() => expect(port.postMessage).toHaveBeenCalledWith({ data: AUTH_HEADERS }), { timeout: 200 });
    });

    test('les en-têtes sont gardés en session, pas sur disque', () => {
        bankinRequest();
        expect(chrome.storage.session._data.pecunio_auth_headers).toEqual(AUTH_HEADERS);
        expect(chrome.storage.local.set).not.toHaveBeenCalled();
    });

    test('un onglet fermé ne reçoit plus rien, les autres si', () => {
        const closed = openTab(1);
        const open = openTab(2);
        closed.onDisconnect.dispatch();
        bankinRequest();
        expect(closed.postMessage).not.toHaveBeenCalled();
        expect(open.postMessage).toHaveBeenCalledWith({ data: AUTH_HEADERS });
    });

    test('un onglet dont le port est cassé est oublié sans bloquer les autres', () => {
        const broken = openTab(1);
        const ok = openTab(2);
        broken.postMessage.mockImplementation(() => {
            throw new Error('port fermé');
        });
        bankinRequest();
        bankinRequest();
        expect(broken.postMessage).toHaveBeenCalledTimes(1);
        expect(ok.postMessage).toHaveBeenCalledTimes(2);
    });

    test('port sans onglet (ex. popup) ignoré', () => {
        const port = createPort({ tabId: null });
        chrome.runtime.onConnect.dispatch(port);
        bankinRequest();
        expect(port.postMessage).not.toHaveBeenCalled();
    });

    test('requête sans en-tête d\'authentification ignorée', () => {
        const port = openTab(1);
        bankinRequest({});
        expect(port.postMessage).not.toHaveBeenCalled();
    });
});

describe('bg.js — ouverture de la popup', () => {
    test('openPopup réussi : retire le badge', async () => {
        chrome.runtime.onMessage.dispatch({ action: 'openPopup' }, {}, () => {});
        await vi.waitFor(() => expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' }));
    });

    test('openPopup refusé (pas de geste utilisateur) : affiche un badge « ! »', async () => {
        chrome.action.openPopup.mockRejectedValueOnce(new Error('user gesture required'));
        chrome.runtime.onMessage.dispatch({ action: 'openPopup' }, {}, () => {});
        await vi.waitFor(() => expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!' }));
    });

    test('autres messages ignorés', () => {
        chrome.runtime.onMessage.dispatch({ action: 'autre' }, {}, () => {});
        expect(chrome.action.openPopup).not.toHaveBeenCalled();
    });
});
