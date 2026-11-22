/**
 * Point d'entrée du content script Pecunio (pages *.bankin.com).
 *
 * Crée les services partagés puis délègue tout le cycle de vie (détection de
 * page, construction des graphiques, rechargement, erreurs) à PageController.
 * Les noms `evt` et `settingClass` restent globaux : d'autres scripts les utilisent.
 */
const evt = new Evt();
const settingClass = new Settings();
const cacheStore = new CacheStore();

const pecunio = new PageController({
    settings: settingClass,
    cacheStore,
    evt,
    createDataManager: () => new DataManager({ cacheStore }),
});

pecunio.start();
