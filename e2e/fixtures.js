// Fixtures Playwright : Chromium avec l'extension Pecunio construite, Bankin
// simulé, et relevé des erreurs de la console.
import path from 'node:path';
import { test as base, chromium, expect } from '@playwright/test';
import { installBankinSimulator } from './bankin-simulator.js';

export const EXTENSION_PATH = path.resolve('.output/chrome-mv3');

/** Adresse d'une page du Bankin simulé. */
export const bankinUrl = (pathname) => `https://app2.bankin.com${pathname}`;

export const test = base.extend({
    // Chromium « headless » récent (channel chromium) : seul mode qui charge les extensions
    // eslint-disable-next-line no-empty-pattern
    context: async ({}, use) => {
        const context = await chromium.launchPersistentContext('', {
            channel: 'chromium',
            locale: 'fr-FR',
            timezoneId: 'Europe/Paris',
            args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
        });
        await use(context);
        await context.close();
    },

    serviceWorker: async ({ context }, use) => {
        const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
        await use(worker);
    },

    extensionId: async ({ serviceWorker }, use) => {
        await use(new URL(serviceWorker.url()).host);
    },

    /**
     * Bankin simulé ; `bankin.apiCalls` liste les appels reçus par l'API.
     * Attend le service worker : sinon, juste après le lancement du navigateur,
     * l'appel authentifié de la page peut précéder l'écoute des en-têtes.
     */
    bankin: async ({ context, serviceWorker }, use) => {
        await use(await installBankinSimulator(context));
    },

    /**
     * Requêtes vers d'autres sites que Bankin (vie privée : « rien n'est
     * envoyé ailleurs que vers Bankin »), de toutes les pages du test.
     */
    externalRequests: async ({ context }, use) => {
        const requests = [];
        context.on('request', (request) => {
            const { protocol, hostname } = new URL(request.url());
            const isWeb = protocol === 'http:' || protocol === 'https:';
            if (isWeb && hostname !== 'bankin.com' && !hostname.endsWith('.bankin.com')) requests.push(request.url());
        });
        await use(requests);
    },

    /**
     * Erreurs de la console, exceptions et boîtes `alert()` (la popup signale
     * ainsi ses échecs) de toutes les pages du test.
     */
    consoleErrors: async ({ context }, use) => {
        const errors = [];
        const watch = (page) => {
            page.on('pageerror', (error) => errors.push(`exception : ${error.message}`));
            page.on('dialog', (dialog) => {
                errors.push(`boîte de dialogue : ${dialog.message()}`);
                dialog.dismiss().catch(() => {});
            });
            page.on('console', (message) => {
                if (message.type() === 'error') errors.push(message.text());
            });
        };
        context.pages().forEach(watch);
        context.on('page', watch);
        await use(errors);
    },
});

/** Popup de l'extension, ouverte dans un onglet. */
export async function openPopup(context, extensionId) {
    const popup = await context.newPage();
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    return popup;
}

export { expect };
