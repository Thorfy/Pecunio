// Faux objet `chrome` pour les tests unitaires.
//
// Couvre uniquement les API utilisées par l'extension. Les API de stockage
// acceptent les deux styles utilisés dans le code : callback
// (`get(keys, cb)` + `chrome.runtime.lastError`) et promesse (`await get(keys)`).
import { vi } from 'vitest';

/** Événement Chrome minimal : addListener / removeListener / dispatch. */
export function createEvent() {
    const listeners = new Set();
    return {
        addListener: (fn) => listeners.add(fn),
        removeListener: (fn) => listeners.delete(fn),
        hasListener: (fn) => listeners.has(fn),
        hasListeners: () => listeners.size > 0,
        get listenerCount() {
            return listeners.size;
        },
        /** Appelle tous les écouteurs et renvoie leurs valeurs de retour. */
        dispatch: (...args) => [...listeners].map((fn) => fn(...args)),
    };
}

const clone = (value) => (value === undefined ? undefined : structuredClone(value));

function pick(data, keys) {
    if (keys == null) return clone(data);
    if (typeof keys === 'string') keys = [keys];
    if (Array.isArray(keys)) {
        const out = {};
        for (const key of keys) if (key in data) out[key] = clone(data[key]);
        return out;
    }
    // Objet de valeurs par défaut
    const out = {};
    for (const [key, fallback] of Object.entries(keys)) out[key] = key in data ? clone(data[key]) : fallback;
    return out;
}

/** Répond soit via callback (asynchrone, comme Chrome), soit via promesse. */
function respond(value, callback) {
    if (typeof callback === 'function') {
        Promise.resolve().then(() => callback(value));
        return undefined;
    }
    return Promise.resolve(value);
}

/**
 * Zone de stockage (`chrome.storage.local`, `chrome.storage.session`).
 * @param {string} areaName
 * @param {Record<string, unknown>} initial
 * @param {ReturnType<typeof createEvent>} onChanged
 */
function createStorageArea(areaName, initial, onChanged) {
    const data = clone(initial) ?? {};

    const emit = (changes) => {
        if (Object.keys(changes).length > 0) onChanged.dispatch(changes, areaName);
    };

    return {
        /** Contenu brut, pour les assertions des tests. */
        _data: data,
        get: vi.fn((keys, callback) => respond(pick(data, keys), callback)),
        set: vi.fn((items, callback) => {
            const changes = {};
            for (const [key, value] of Object.entries(items)) {
                changes[key] = { oldValue: clone(data[key]), newValue: clone(value) };
                data[key] = clone(value);
            }
            emit(changes);
            return respond(undefined, callback);
        }),
        remove: vi.fn((keys, callback) => {
            const changes = {};
            for (const key of typeof keys === 'string' ? [keys] : keys) {
                if (key in data) {
                    changes[key] = { oldValue: clone(data[key]) };
                    delete data[key];
                }
            }
            emit(changes);
            return respond(undefined, callback);
        }),
        clear: vi.fn((callback) => {
            const changes = {};
            for (const key of Object.keys(data)) {
                changes[key] = { oldValue: clone(data[key]) };
                delete data[key];
            }
            emit(changes);
            return respond(undefined, callback);
        }),
    };
}

/** Port de messagerie (`chrome.runtime.connect`). */
export function createPort({ tabId = 1, name = '' } = {}) {
    return {
        name,
        sender: tabId == null ? {} : { tab: { id: tabId } },
        postMessage: vi.fn(),
        disconnect: vi.fn(),
        onMessage: createEvent(),
        onDisconnect: createEvent(),
    };
}

/**
 * Crée un faux `chrome`.
 * @param {{ local?: Record<string, unknown>, session?: Record<string, unknown>, manifest?: object }} [options]
 */
export function createFakeChrome({ local = {}, session = {}, manifest = { version: '0.0.0-test' } } = {}) {
    const onChanged = createEvent();
    /** Ports ouverts par le code testé via chrome.runtime.connect(). */
    const connectedPorts = [];

    return {
        storage: {
            local: createStorageArea('local', local, onChanged),
            session: createStorageArea('session', session, onChanged),
            onChanged,
        },
        runtime: {
            id: 'pecunio-test',
            lastError: undefined,
            getURL: (path) => `chrome-extension://pecunio-test/${path}`,
            getManifest: () => manifest,
            connect: vi.fn(() => {
                const port = createPort({ tabId: null });
                connectedPorts.push(port);
                return port;
            }),
            connectedPorts,
            onConnect: createEvent(),
            onMessage: createEvent(),
            sendMessage: vi.fn(() => Promise.resolve()),
        },
        webRequest: {
            onBeforeSendHeaders: createEvent(),
        },
        tabs: {
            query: vi.fn(() => Promise.resolve([])),
            sendMessage: vi.fn(() => Promise.resolve()),
            create: vi.fn(() => Promise.resolve({ id: 99 })),
        },
        action: {
            openPopup: vi.fn(() => Promise.resolve()),
            setBadgeText: vi.fn(() => Promise.resolve()),
            setBadgeBackgroundColor: vi.fn(() => Promise.resolve()),
            getUserSettings: vi.fn(() => Promise.resolve({ isOnToolbar: true })),
        },
    };
}
