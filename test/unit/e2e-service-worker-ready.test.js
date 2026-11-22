// Banc de test e2e : attente du service worker avant d'ouvrir une page Bankin
// (e2e/service-worker-ready.js).
//
// Reproduit la cause des échecs intermittents des tests Playwright : Chrome ne
// transmet les requêtes à un écouteur webRequest qu'une fois son enregistrement
// arrivé dans le navigateur (dans l'ordre des enregistrements, avec un délai).
// Un appel de Bankin fait pendant ce délai passe inaperçu.
import { describe, expect, test } from 'vitest';
import { waitForHeaderCapture } from '../../e2e/service-worker-ready.js';
import { SESSION_KEY, startAuthHeaderRelay } from '../../js/background/authHeaders.js';
import { AUTH_HEADERS } from '../fixtures/bankin.js';

const BANKIN_ACCOUNTS_URL = 'https://sync.bankin.com/v2/accounts?limit=200';
const REGISTRATION_DELAY_MS = 120;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Motif d'URL de webRequest (« * » seul joker) → expression régulière. */
const matches = (pattern, url) => new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(url);

/**
 * Faux navigateur : chaque `addListener` du service worker n'est pris en compte
 * qu'après `registrationDelayMs`, dans l'ordre des enregistrements (même canal).
 * Les requêtes ne vont qu'aux écouteurs déjà pris en compte et dont le filtre
 * correspond.
 */
function createBrowser({ registrationDelayMs = REGISTRATION_DELAY_MS } = {}) {
    const event = chrome.webRequest.onBeforeSendHeaders;
    const filters = new Map();
    const effective = new Set();
    const add = event.addListener;
    const remove = event.removeListener;
    let channel = Promise.resolve();
    event.addListener = (fn, filter) => {
        add(fn);
        filters.set(fn, filter);
        channel = channel.then(() => sleep(registrationDelayMs)).then(() => {
            if (event.hasListener(fn)) effective.add(fn);
        });
    };
    event.removeListener = (fn) => {
        remove(fn);
        effective.delete(fn);
    };

    const routes = [];
    const pages = [];
    /** Requête d'une page : servie par une route Playwright, sinon elle partirait sur le réseau. */
    const request = (url, headers = {}) => {
        const details = { url, requestHeaders: Object.entries(headers).map(([name, value]) => ({ name, value })) };
        for (const fn of effective) {
            if (filters.get(fn).urls.some((pattern) => matches(pattern, url))) fn(details);
        }
    };

    const context = {
        routes,
        pages,
        route: async (matcher, handler) => {
            routes.push({ matcher, handler });
        },
        unroute: async (matcher, handler) => {
            const index = routes.findIndex((r) => r.matcher === matcher && r.handler === handler);
            if (index >= 0) routes.splice(index, 1);
        },
        newPage: async () => {
            const page = {
                closed: false,
                evaluate: async (fn, url) => {
                    if (!routes.some((r) => r.matcher(new URL(url)))) throw new Error(`requête réseau non servie : ${url}`);
                    request(url);
                },
                close: async () => {
                    page.closed = true;
                },
            };
            pages.push(page);
            return page;
        },
    };
    /** Le code passé à `worker.evaluate` s'exécute « dans le service worker » (le faux `chrome`). */
    const worker = { evaluate: async (fn, arg) => fn(arg) };
    return { request, context, worker, effective };
}

const storedHeaders = async () => (await chrome.storage.session.get(SESSION_KEY))[SESSION_KEY];

describe('e2e — service worker prêt avant la page Bankin', () => {
    test('sans attente, l\'appel de Bankin fait juste après le démarrage passe inaperçu (cause des échecs)', async () => {
        const browser = createBrowser();
        startAuthHeaderRelay();
        browser.request(BANKIN_ACCOUNTS_URL, AUTH_HEADERS);
        await sleep(REGISTRATION_DELAY_MS * 2);
        expect(await storedHeaders()).toBeUndefined();
    });

    test('après l\'attente, le premier appel de Bankin est capté', async () => {
        const browser = createBrowser();
        startAuthHeaderRelay();

        const { probes } = await waitForHeaderCapture({ worker: browser.worker, context: browser.context });
        expect(probes).toBeGreaterThan(1);

        browser.request(BANKIN_ACCOUNTS_URL, AUTH_HEADERS);
        expect(await storedHeaders()).toEqual(AUTH_HEADERS);
    });

    test('les requêtes sonde ne laissent aucune trace', async () => {
        const browser = createBrowser();
        startAuthHeaderRelay();
        await waitForHeaderCapture({ worker: browser.worker, context: browser.context });

        // Sonde sans en-têtes Bankin : rien d'enregistré ; écouteur, route et page retirés
        expect(await storedHeaders()).toBeUndefined();
        expect(chrome.webRequest.onBeforeSendHeaders.listenerCount).toBe(1);
        expect(browser.context.routes).toEqual([]);
        expect(browser.context.pages.every((page) => page.closed)).toBe(true);
        expect(globalThis).not.toHaveProperty('__pecunioProbe');
        expect(globalThis).not.toHaveProperty('__pecunioProbeSeen');
    });

    test('attend que le script du service worker ait posé son écouteur avant de poser la sonde', async () => {
        const browser = createBrowser();
        setTimeout(startAuthHeaderRelay, 80);

        await waitForHeaderCapture({ worker: browser.worker, context: browser.context });
        browser.request(BANKIN_ACCOUNTS_URL, AUTH_HEADERS);
        expect(await storedHeaders()).toEqual(AUTH_HEADERS);
    });

    test('échoue avec un message clair si le service worker ne voit jamais les requêtes', async () => {
        const browser = createBrowser({ registrationDelayMs: 60_000 });
        startAuthHeaderRelay();

        await expect(waitForHeaderCapture({ worker: browser.worker, context: browser.context, timeoutMs: 200 }))
            .rejects.toThrow(/ne voit aucune requête/);
        expect(chrome.webRequest.onBeforeSendHeaders.listenerCount).toBe(1);
        expect(browser.context.routes).toEqual([]);
        expect(browser.context.pages.every((page) => page.closed)).toBe(true);
    });
});
