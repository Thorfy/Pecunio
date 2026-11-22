import { BankinPage } from '../bankin/BankinPage.js';
import { BudgetChart } from '../charts/BudgetChart.js';
import { CategoryHistoryChart } from '../charts/CategoryHistoryChart.js';
import { ExpenseTypeChart } from '../charts/ExpenseTypeChart.js';
import { LineBarChart } from '../charts/LineBarChart.js';
import { MonthPaceChart } from '../charts/MonthPaceChart.js';
import { SankeyChart } from '../charts/SankeyChart.js';
import { Chart } from '../lib/chart.js';
import { AmountHider } from '../ui/AmountHider.js';
import { LoadingScreen } from '../ui/LoadingScreen.js';
import { ReviewPrompt } from '../ui/ReviewPrompt.js';
import { StatusBanner } from '../ui/StatusBanner.js';
import { Config } from './Config.js';
import { AuthenticationError } from './DataManager.js';
import { Logger } from './Logger.js';

/**
 * PageController - Cycle de vie de Pecunio dans les pages Bankin
 *
 * Décide quoi afficher selon la page, et quand reconstruire les graphiques.
 *
 * - Une seule construction à la fois : les demandes reçues pendant une
 *   construction sont regroupées en une seule reconstruction (bug B5).
 * - Les graphiques précédents sont détruits avant d'en créer de nouveaux,
 *   et chaque écouteur sur un élément de Bankin n'est posé qu'une fois (B4, B16).
 * - La page est reconnue par son chemin (`/categories/2` = onglet Revenus) ;
 *   les graphiques de dépenses sont retirés des vues qui ne les concernent pas (B6).
 * - Les données ne sont chargées que sur les pages à graphiques (pas sur
 *   `/signin`), et les erreurs sont affichées à l'utilisateur (B12).
 * - Sur la page de connexion (déconnexion ou session expirée), les données
 *   bancaires conservées sont effacées : cache de l'API, données du rapport,
 *   en-têtes d'authentification du service worker (D8). Les préférences sont
 *   gardées.
 */
export class PageController {
    static PAGE = BankinPage.PAGE;

    /** Délai avant d'afficher « chargement en cours » (évite un flash si le cache répond vite). */
    static LOADING_BANNER_DELAY_MS = 1500;

    /** Délai laissé à Bankin pour mettre à jour la page après un clic (rafraîchir, changer de mois). */
    static REFRESH_DELAY_MS = 1100;
    static MONTH_CHANGE_DELAY_MS = 30;

    static MESSAGES = {
        LOADING: 'chargement de vos données…',
        AUTH: "impossible de lire vos données Bankin (session non reconnue). Rechargez la page pour réessayer.",
        API: 'impossible de charger vos données depuis Bankin (réseau ou service indisponible).',
        CACHED: ' Les graphiques affichent les dernières données enregistrées.',
        RELOAD: 'Recharger',
    };

    /** Réglages dont la modification (ex. depuis la popup) redessine les graphiques. */
    static SETTING_KEYS_TRIGGERING_REBUILD = ['startDate', 'endDate', 'noEndDate', 'accountsSelected'];

    /**
     * Type de page Bankin, d'après le chemin de l'URL (voir BankinPage).
     * @param {string} href
     * @returns {string} une valeur de PageController.PAGE
     */
    static detectPage(href) {
        return BankinPage.detectPage(href);
    }

    /** Pages où Pecunio affiche des graphiques. */
    static hasCharts(page) {
        return BankinPage.hasCharts(page);
    }

    /**
     * @param {object} deps
     * @param {import('./Settings.js').Settings} deps.settings
     * @param {import('./CacheStore.js').CacheStore} deps.cacheStore
     * @param {import('./Evt.js').Evt} deps.evt
     * @param {() => import('./DataManager.js').DataManager} deps.createDataManager
     * @param {Window} [deps.win]
     * @param {object} [deps.charts] classes de graphiques (remplaçables dans les tests)
     */
    constructor({ settings, cacheStore, evt, createDataManager, win = window, charts = null }) {
        this.settings = settings;
        this.cacheStore = cacheStore;
        this.evt = evt;
        this.createDataManager = createDataManager;
        this.win = win;
        this.chartClasses = charts || { LineBarChart, BudgetChart, ExpenseTypeChart, SankeyChart, CategoryHistoryChart, MonthPaceChart };

        this.dataManager = null;
        this.charts = [];
        this.buildCount = 0;
        this._running = null;
        this._pending = false;
        this._pendingForce = false;
        this._lastSignature = null;
        this._lastHref = null;
        this._wiredElements = new WeakSet();
        this._loadingTimer = null;
        this._urlTimer = null;
    }

    get document() {
        return this.win.document;
    }

    /** Adaptateur de la page Bankin courante. */
    get bankin() {
        if (this._bankin?.doc !== this.document) this._bankin = new BankinPage(this.document);
        return this._bankin;
    }

    get currentPage() {
        return PageController.detectPage(this.win.location.href);
    }

    /** Promesse résolue quand aucune construction n'est en cours. */
    whenIdle() {
        return this._running || Promise.resolve();
    }

    /**
     * Branche les écouteurs et traite la page courante.
     * @returns {Promise<void>} fin de la première construction
     */
    start() {
        this.evt.listen('data_loaded', () => {
            this._clearLoadingBanner();
            // Données souvent identiques à celles déjà affichées (cache) : pas de
            // reconstruction inutile, qui ferait clignoter les graphiques (bug B24)
            this.requestBuild({ onlyIfChanged: true });
        });

        this.win.addEventListener('pecunio_chart_type_changed', () => this.requestBuild());

        // Navigation dans l'application Bankin (SPA) : plusieurs sources, une seule réaction
        const onNavigation = () => this._onLocationChange();
        this.win.addEventListener('hashchange', onNavigation);
        this.win.addEventListener('popstate', onNavigation);
        if (this.win.navigation && typeof this.win.navigation.addEventListener === 'function') {
            this.win.navigation.addEventListener('navigatesuccess', onNavigation);
        }
        // Filet de sécurité : certaines navigations de Bankin ne déclenchent aucun événement
        this._urlTimer = this.win.setInterval(onNavigation, Config.INTERVALS.URL_CHECK);

        // Réglages modifiés ailleurs (popup, autre onglet)
        if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
            chrome.storage.onChanged.addListener((changes, area) => this._onStorageChanged(changes, area));
        }

        return this._onLocationChange() || this.whenIdle();
    }

    /** Arrête les écouteurs périodiques et détruit les graphiques (tests, déchargement). */
    stop() {
        if (this._urlTimer) this.win.clearInterval(this._urlTimer);
        this._urlTimer = null;
        this._clearLoadingBanner();
        this._destroyCharts();
    }

    _onLocationChange() {
        const href = this.win.location.href;
        if (href === this._lastHref) return null;
        this._lastHref = href;
        const page = this.currentPage;
        if (page === PageController.PAGE.SIGNIN) return this._purgeUserData().then(() => this.requestBuild());
        if (PageController.hasCharts(page)) this._ensureDataManager();
        return this.requestBuild();
    }

    /**
     * Efface les données bancaires conservées par l'extension (D8). Les erreurs
     * sont journalisées sans interrompre la suite.
     */
    async _purgeUserData() {
        this._clearLoadingBanner();
        StatusBanner.hide('data-error');
        if (this.dataManager) {
            this.dataManager.dispose?.();
            this.dataManager = null;
        }
        const results = await Promise.allSettled([
            this.cacheStore.clear(),
            chrome.storage.local.remove(Object.values(Config.REPORT.STORAGE_KEYS)),
            chrome.runtime.sendMessage({ type: Config.RUNTIME_MESSAGES.SIGNED_OUT }),
        ]);
        for (const result of results) {
            if (result.status === 'rejected') Logger.warn('Effacement des données incomplet :', result.reason?.message);
        }
        Logger.debug('Déconnexion : données effacées');
    }

    async _onStorageChanged(changes, area) {
        if (area !== 'local') return;
        const keys = Object.keys(changes || {});
        if (!keys.some((key) => PageController.SETTING_KEYS_TRIGGERING_REBUILD.includes(key))) return;
        try {
            await this.settings.loadSettings();
        } catch (error) {
            Logger.warn('Rechargement des réglages impossible :', error.message);
        }
        await this.requestBuild();
    }

    /** Crée le DataManager au premier passage sur une page à graphiques. */
    _ensureDataManager() {
        if (this.dataManager) return;
        const dataManager = this.createDataManager();
        this.dataManager = dataManager;

        this._loadingTimer = this.win.setTimeout(() => {
            this._loadingTimer = null;
            StatusBanner.show(PageController.MESSAGES.LOADING, { type: 'info', key: 'loading' });
        }, PageController.LOADING_BANNER_DELAY_MS);

        // Résultat ignoré si l'utilisateur s'est déconnecté entre-temps
        dataManager.waitForInitialization().then(
            () => {
                if (this.dataManager === dataManager) this._clearLoadingBanner();
            },
            (error) => {
                if (this.dataManager === dataManager) this._onDataError(error);
            },
        );
    }

    _clearLoadingBanner() {
        if (this._loadingTimer) this.win.clearTimeout(this._loadingTimer);
        this._loadingTimer = null;
        StatusBanner.hide('loading');
    }

    /** Erreur de chargement : message visible, et graphiques depuis le cache s'il existe. */
    _onDataError(error) {
        this._clearLoadingBanner();
        Logger.warn('Chargement des données impossible :', error?.message);
        const hasCache = this._hasData();
        const isAuth = typeof AuthenticationError !== 'undefined' && error instanceof AuthenticationError;
        const message = (isAuth ? PageController.MESSAGES.AUTH : PageController.MESSAGES.API)
            + (hasCache ? PageController.MESSAGES.CACHED : '');
        StatusBanner.show(message, {
            type: 'error',
            key: 'data-error',
            actionLabel: PageController.MESSAGES.RELOAD,
            onAction: () => this.win.location.reload(),
        });
        if (hasCache) this.requestBuild();
    }

    _hasData() {
        const transactions = this.cacheStore.get('transactions');
        return Array.isArray(transactions) && transactions.length > 0;
    }

    /**
     * Demande une (re)construction. Si une construction est en cours, une seule
     * nouvelle construction est programmée à sa fin, quel que soit le nombre de demandes.
     * @param {{ onlyIfChanged?: boolean }} [options] ne rien faire si les graphiques
     *   affichés correspondent déjà aux mêmes données, réglages et page
     * @returns {Promise<void>}
     */
    requestBuild({ onlyIfChanged = false } = {}) {
        if (this._running) {
            this._pending = true;
            this._pendingForce = this._pendingForce || !onlyIfChanged;
            return this._running;
        }
        this._running = (async () => {
            let skipIfUnchanged = onlyIfChanged;
            try {
                do {
                    if (this._pending) skipIfUnchanged = !this._pendingForce;
                    this._pending = false;
                    this._pendingForce = false;
                    try {
                        await this._build({ onlyIfChanged: skipIfUnchanged });
                    } catch (error) {
                        Logger.error('Erreur pendant la construction des graphiques :', error);
                    }
                } while (this._pending);
            } finally {
                this._running = null;
            }
        })();
        return this._running;
    }

    async _build({ onlyIfChanged = false } = {}) {
        await this.settings.waitForInitialization().catch(() => {});
        await this.cacheStore.waitForInitialization();
        this.win.__pecunioIsBlurry = !!this.settings.getSetting(Config.STORAGE_KEYS.IS_BLURRY);

        const page = this.currentPage;
        this._removeStaleCharts(page);
        if (!PageController.hasCharts(page) || !this._hasData()) return;

        const signature = this._signature(page);
        if (onlyIfChanged && signature === this._lastSignature && this._chartsDisplayed(page)) {
            Logger.debug('Données inchangées : graphiques conservés');
            return;
        }

        const built = page === PageController.PAGE.ACCOUNTS
            ? await this._buildAccountsPage()
            : page === PageController.PAGE.CATEGORIES
                ? await this._buildCategoriesPage()
                : await this._buildCategoryDetailPage();
        if (!built) return;

        this._lastSignature = signature;
        this.buildCount++;
        this.win.setTimeout(() => {
            // Bouton inséré une fois ; l'état enregistré est réappliqué à chaque construction
            new AmountHider(this.settings, this.bankin);
        }, Config.INTERVALS.HIDDER_DELAY);
        ReviewPrompt.tryShow();
    }

    /**
     * Empreinte de ce qu'affichent les graphiques : page, données en cache et
     * réglages. Deux empreintes égales ⇒ reconstruire ne changerait rien.
     */
    _signature(page) {
        const transactions = this.cacheStore.get('transactions') || [];
        const categories = this.cacheStore.get('categories') || [];
        let total = 0;
        for (const t of transactions) total += Number(t?.amount) || 0;
        const s = this.settings.getAllSettings();
        const month = page === PageController.PAGE.ACCOUNTS ? null : this.bankin.activeMonthLabel();
        return JSON.stringify([
            page, this.win.location.href, month,
            transactions.length, transactions[0]?.id, transactions[transactions.length - 1]?.id, Math.round(total * 100),
            categories.length,
            s.startDate, s.endDate, s.noEndDate, s.accountsSelected, s.chartType, s.isBlurry, s.chartRange, s.chartDetailed,
        ]);
    }

    /** Les graphiques de la dernière construction sont-ils toujours dans la page ? */
    _chartsDisplayed(page) {
        if (this.charts.length === 0) return false;
        const selector = {
            [PageController.PAGE.ACCOUNTS]: '#budgetChartBlock',
            [PageController.PAGE.CATEGORIES]: '.pecunio-sankey-wrapper',
            [PageController.PAGE.CATEGORY_DETAIL]: '.pecunio-history-wrapper',
        }[page];
        return Boolean(this.document.querySelector(selector));
    }

    _chartData() {
        return {
            transactions: this.cacheStore.get('transactions'),
            categories: this.cacheStore.get('categories'),
            accountsSelected: this.settings.getSetting('accountsSelected'),
            settings: this.settings.getAllSettings(),
        };
    }

    async _buildAccountsPage() {
        const { LineBarChart, BudgetChart } = this.chartClasses;
        LoadingScreen.show(this.bankin);
        this._wireRefreshButton();

        const homeBlock = this.bankin.accountsBlock();
        if (!homeBlock) {
            Logger.debug('Bloc des comptes introuvable : page Bankin pas encore affichée');
            return false;
        }

        this._destroyCharts();
        const data = this._chartData();
        const mainContainer = LineBarChart.createMainContainer(homeBlock);

        const lineBarChart = new LineBarChart(data.transactions, data.categories, data.accountsSelected, data.settings, this.settings);
        this.charts.push(lineBarChart);
        await lineBarChart.render(lineBarChart.createContainer(mainContainer));

        const budgetBlock = this.document.createElement('div');
        budgetBlock.id = 'budgetChartBlock';
        budgetBlock.classList.add('pecunio-section');
        mainContainer.appendChild(budgetBlock);

        const budgetChart = new BudgetChart(data.transactions, data.categories, data.accountsSelected, data.settings, this.settings);
        this.charts.push(budgetChart);
        budgetChart.createUI(budgetBlock.id);
        return true;
    }

    async _buildCategoriesPage() {
        const { ExpenseTypeChart, SankeyChart } = this.chartClasses;
        this._wireMonthSelector();

        // « Septembre 2026 » → ['septembre', '2026']
        const monthParams = this.bankin.activeMonth();
        const categoryBlock = this.bankin.categoryChart();
        if (!monthParams || !categoryBlock) {
            Logger.debug('Sélecteur de mois ou graphique Bankin introuvable');
            return false;
        }

        // Changement de mois : cartes de la construction précédente retirées
        this._removeWrappers(['.pecunio-pace-wrapper']);
        this._destroyCharts();
        const data = this._chartData();
        const rowContainer = ExpenseTypeChart.prepareContainer(categoryBlock);

        const expenseTypeChart = new ExpenseTypeChart(data.transactions, data.categories, monthParams, this.settings);
        this.charts.push(expenseTypeChart);
        await expenseTypeChart.render(rowContainer);

        const sankeyChart = new SankeyChart(data.transactions, data.categories, monthParams, this.settings);
        this.charts.push(sankeyChart);
        await sankeyChart.render(categoryBlock);

        // Rythme du mois (lot UX-3a)
        const { MonthPaceChart: PaceChart } = this.chartClasses;
        if (PaceChart) {
            const paceChart = new PaceChart(data.transactions, data.categories, monthParams, this.settings);
            this.charts.push(paceChart);
            await paceChart.render(categoryBlock);
        }
        return true;
    }

    /** Page de détail d'une catégorie (et onglet Revenus) : historique sur 12 mois (lot UX-3a). */
    async _buildCategoryDetailPage() {
        const { CategoryHistoryChart: HistoryChart } = this.chartClasses;
        this._wireMonthSelector();
        const monthParams = this.bankin.activeMonth();
        const categoryBlock = this.bankin.categoryChart();
        const categoryId = BankinPage.categoryIdFromUrl(this.win.location.href);
        if (!HistoryChart || !monthParams || !categoryBlock || categoryId == null) {
            Logger.debug('Page de détail : mois, bloc ou catégorie introuvable');
            return false;
        }
        // Changement de mois ou de catégorie : historique précédent retiré
        this._removeWrappers(['.pecunio-history-wrapper']);
        this._destroyCharts();
        const data = this._chartData();
        const row = HistoryChart.prepareContainer(categoryBlock);
        const historyChart = new HistoryChart(data.transactions, data.categories, { categoryId, monthParams }, this.settings);
        this.charts.push(historyChart);
        await historyChart.render(row);
        return true;
    }

    /** Bouton ↻ de Bankin : un seul écouteur par bouton (bug B4). */
    _wireRefreshButton() {
        const icon = this.bankin.refreshButton();
        if (!icon || this._wiredElements.has(icon)) return;
        this._wiredElements.add(icon);
        icon.addEventListener('click', () => {
            this.win.setTimeout(() => this.refreshData(), PageController.REFRESH_DELAY_MS);
        });
    }

    /** Sélecteur de mois de la page Catégories : reconstruction après changement de mois. */
    _wireMonthSelector() {
        const menu = this.bankin.monthSelector();
        if (!menu || this._wiredElements.has(menu)) return;
        this._wiredElements.add(menu);
        menu.addEventListener('click', () => {
            this.win.setTimeout(() => this.requestBuild(), PageController.MONTH_CHANGE_DELAY_MS);
        });
    }

    /** Recharge les données depuis l'API (le rechargement déclenche `data_loaded`). */
    async refreshData() {
        if (!this.dataManager) return;
        try {
            await this.dataManager.refreshData();
        } catch (error) {
            this._onDataError(error);
        }
    }

    /** Détruit les graphiques Pecunio créés par la dernière construction. */
    _destroyCharts() {
        for (const chart of this.charts) {
            try {
                chart.destroy?.();
            } catch (error) {
                Logger.warn('Destruction d\'un graphique impossible :', error.message);
            }
        }
        this.charts = [];
    }

    /**
     * Retire les graphiques qui ne concernent pas la page affichée : graphiques
     * de la page Catégories ailleurs (bug B6), historique hors page de détail.
     * @param {string} page
     */
    _removeStaleCharts(page) {
        const selectors = [];
        if (page !== PageController.PAGE.CATEGORIES) selectors.push('.pecunio-expense-type-wrapper', '.pecunio-sankey-wrapper', '.pecunio-pace-wrapper');
        if (page !== PageController.PAGE.CATEGORY_DETAIL) selectors.push('.pecunio-history-wrapper');
        this._removeWrappers(selectors);
    }

    /** Retire des cartes Pecunio et détruit leurs graphiques. */
    _removeWrappers(selectors) {
        if (selectors.length === 0) return;
        const wrappers = this.document.querySelectorAll(selectors.join(', '));
        if (wrappers.length === 0) return;
        this._destroyCharts();
        wrappers.forEach((wrapper) => {
            wrapper.querySelectorAll('canvas').forEach((canvas) => {
                const chart = typeof Chart !== 'undefined' && Chart.getChart ? Chart.getChart(canvas) : null;
                chart?.destroy();
            });
            wrapper.remove();
        });
    }
}
