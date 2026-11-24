/**
 * Démarrage de Pecunio dans les pages de l'application Bankin, app2.bankin.com (content script).
 *
 * Crée les services partagés puis délègue tout le cycle de vie (détection de
 * page, construction des graphiques, rechargement, erreurs) à PageController.
 */
import { CacheStore } from '../core/CacheStore.js';
import { DataManager } from '../core/DataManager.js';
import { evt } from '../core/events.js';
import { PageController } from '../core/PageController.js';
import { Settings } from '../core/Settings.js';

/** @returns {PageController} */
export function startPecunio() {
    const settings = new Settings();
    const cacheStore = new CacheStore();

    const controller = new PageController({
        settings,
        cacheStore,
        evt,
        createDataManager: () => new DataManager({ cacheStore }),
    });
    controller.start();
    return controller;
}
